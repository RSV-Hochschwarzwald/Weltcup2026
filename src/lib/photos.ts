import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const PHOTO_BUCKET = "helper-photos";
/** Der Browser verkleinert Fotos vor dem Upload (ca. 200-500 KB); das hier ist nur die harte Obergrenze. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export type PhotoResult = { ok: true } | { ok: false; status: number; message: string };

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** Liest das Feld "photo" aus einem Multipart-Request und prüft Größe + JPEG-Signatur. */
export async function readPhotoFromRequest(
  request: Request
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; status: number; message: string }> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, status: 400, message: "Ungültige Anfrage." };
  }

  const file = form.get("photo");
  if (!(file instanceof File)) {
    return { ok: false, status: 400, message: "Bitte wähle ein Foto aus." };
  }
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    return { ok: false, status: 413, message: "Das Foto ist zu groß. Bitte wähle ein kleineres Bild." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isJpeg(bytes)) {
    return { ok: false, status: 415, message: "Bitte lade ein Foto im Format JPG, PNG oder HEIC hoch." };
  }
  return { ok: true, bytes };
}

/** Speichert (bzw. ersetzt) das Foto eines Helfers im privaten Bucket und vermerkt es in der Datenbank. */
export async function saveHelperPhoto(helperId: string, bytes: Uint8Array): Promise<PhotoResult> {
  const admin = createAdminClient();
  const path = `${helperId}.jpg`;

  const { error: uploadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (uploadError) {
    console.error("[photo] Upload fehlgeschlagen", uploadError);
    return { ok: false, status: 500, message: "Das Foto konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }

  const { error: dbError } = await admin
    .from("helpers")
    .update({ photo_path: path, photo_uploaded_at: new Date().toISOString() })
    .eq("id", helperId);
  if (dbError) {
    console.error("[photo] DB-Update fehlgeschlagen", dbError);
    return { ok: false, status: 500, message: "Das Foto konnte nicht gespeichert werden. Bitte versuche es erneut." };
  }

  return { ok: true };
}

export async function deleteHelperPhoto(photoPath: string | null): Promise<void> {
  if (!photoPath) return;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(PHOTO_BUCKET).remove([photoPath]);
  if (error) console.error("[photo] Löschen fehlgeschlagen", error);
}
