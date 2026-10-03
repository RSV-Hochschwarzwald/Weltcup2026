import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPhotoFromRequest, saveHelperPhoto } from "@/lib/photos";

export const runtime = "nodejs";

const tokenPattern = /^[a-f0-9]{64}$/;

/**
 * Foto zur eigenen Anmeldung hochladen/ersetzen. Der geheime Edit-Token ist
 * der einzige Zugriffsschlüssel (wie bei allen Funktionen unter
 * /meine-anmeldung). Das Foto landet in einem privaten Bucket und wird
 * nirgends öffentlich ausgeliefert.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenPattern.test(token)) {
    return NextResponse.json({ success: false, message: "Ungültiger Link." }, { status: 400 });
  }

  const photo = await readPhotoFromRequest(request);
  if (!photo.ok) {
    return NextResponse.json({ success: false, message: photo.message }, { status: photo.status });
  }

  const admin = createAdminClient();
  const { data: helper } = await admin.from("helpers").select("id").eq("edit_token", token).maybeSingle();
  if (!helper) {
    return NextResponse.json({ success: false, message: "Dieser Link ist ungültig oder abgelaufen." }, { status: 404 });
  }

  const result = await saveHelperPhoto(helper.id, photo.bytes);
  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
