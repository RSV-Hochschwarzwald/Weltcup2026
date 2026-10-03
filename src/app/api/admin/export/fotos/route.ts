import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { AuthError, requireRole } from "@/lib/auth";
import { getActiveEventAdmin, getShiftsWithRegistrations } from "@/lib/adminData";
import { collectAccreditationHelpers } from "@/lib/accreditation";
import { PHOTO_BUCKET } from "@/lib/photos";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Alle Helfer-Fotos als ZIP, benannt wie in der Akkreditierungsliste
 * (Vorname_Nachname.jpg). Nur für Admins - Fotos sind personenbezogene Daten
 * und bleiben für Betrachter-Konten gesperrt.
 */
export async function GET() {
  try {
    await requireRole("admin");
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ message: "Nicht berechtigt." }, { status: e.code === "forbidden" ? 403 : 401 });
    }
    throw e;
  }

  const event = await getActiveEventAdmin();
  if (!event) return NextResponse.json({ message: "Kein aktives Event." }, { status: 404 });

  const shifts = await getShiftsWithRegistrations(event.id);
  const helpers = collectAccreditationHelpers(shifts).filter((h) => h.hasPhoto);
  if (helpers.length === 0) {
    return NextResponse.json({ message: "Es wurden noch keine Fotos hochgeladen." }, { status: 404 });
  }

  const admin = createAdminClient();
  const files: Record<string, Uint8Array> = {};
  for (const h of helpers) {
    const { data, error } = await admin.storage.from(PHOTO_BUCKET).download(`${h.id}.jpg`);
    if (error || !data) {
      console.error("[fotos] Download fehlgeschlagen", h.id, error);
      continue;
    }
    files[h.photoFileName] = new Uint8Array(await data.arrayBuffer());
  }

  // JPEGs sind bereits komprimiert -> nur ablegen (level 0), spart Rechenzeit.
  const zip = zipSync(files, { level: 0 });

  return new NextResponse(new Blob([zip as BlobPart], { type: "application/zip" }), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Helfer_Fotos_Weltcup_2026.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
