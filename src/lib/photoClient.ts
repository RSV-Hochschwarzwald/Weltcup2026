/**
 * Browser-seitige Foto-Helfer: verkleinert Handy-Fotos (oft 5-10 MB) vor dem
 * Upload auf ein JPEG mit max. 1400 px Kantenlänge und lädt es hoch.
 */

export async function prepareJpeg(file: File, maxEdge = 1400, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("decode"));
      image.src = url;
    });

    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    // Weißer Hintergrund, falls das Bild Transparenz hat (PNG).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("encode");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadPhoto(url: string, photo: Blob): Promise<{ ok: true } | { ok: false; message: string }> {
  const form = new FormData();
  form.append("photo", photo, "foto.jpg");

  try {
    const res = await fetch(url, { method: "POST", body: form });
    const data = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    if (res.ok && data?.success) return { ok: true };
    return { ok: false, message: data?.message ?? "Das Foto konnte nicht gespeichert werden. Bitte versuche es erneut." };
  } catch {
    return { ok: false, message: "Die Verbindung ist fehlgeschlagen. Bitte überprüfe deine Internetverbindung und versuche es erneut." };
  }
}
