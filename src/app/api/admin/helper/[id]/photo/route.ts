import { NextResponse } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { readPhotoFromRequest, saveHelperPhoto } from "@/lib/photos";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin lädt ein Foto für einen Helfer hoch (z. B. wenn der Helfer per WhatsApp zugesagt hat). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ success: false, message: "Nicht berechtigt." }, { status: e.code === "forbidden" ? 403 : 401 });
    }
    throw e;
  }

  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ success: false, message: "Ungültige Anfrage." }, { status: 400 });
  }

  const photo = await readPhotoFromRequest(request);
  if (!photo.ok) {
    return NextResponse.json({ success: false, message: photo.message }, { status: photo.status });
  }

  const admin = createAdminClient();
  const { data: helper } = await admin.from("helpers").select("id").eq("id", id).maybeSingle();
  if (!helper) {
    return NextResponse.json({ success: false, message: "Helfer nicht gefunden." }, { status: 404 });
  }

  const result = await saveHelperPhoto(id, photo.bytes);
  if (!result.ok) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status });
  }
  return NextResponse.json({ success: true });
}
