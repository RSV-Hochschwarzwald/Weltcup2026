import { NextResponse } from "next/server";
import { AuthError, requireAdmin } from "@/lib/auth";
import { getActiveEventAdmin, getShiftsWithRegistrations } from "@/lib/adminData";
import { collectAccreditationHelpers } from "@/lib/accreditation";
import { buildAccreditationWorkbook } from "@/lib/accreditationWorkbook";
import { config } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ message: "Nicht berechtigt." }, { status: 401 });
    throw e;
  }

  const event = await getActiveEventAdmin();
  if (!event) return NextResponse.json({ message: "Kein aktives Event." }, { status: 404 });

  const shifts = await getShiftsWithRegistrations(event.id);
  const helpers = collectAccreditationHelpers(shifts);

  const buffer = await buildAccreditationWorkbook(helpers, {
    title: config.accreditationTitle,
    verein: config.organizationName,
    funktion: config.accreditationFunction,
  });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Akkreditierungsliste_Weltcup_2026.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
