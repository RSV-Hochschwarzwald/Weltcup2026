import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { buildExportRows } from "@/lib/exportData";

export const runtime = "nodejs";

function csvEscape(value: string): string {
  if (/[",;\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ message: "Nicht berechtigt." }, { status: 401 });
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const day = searchParams.get("day") ?? "alle";
  const { rows } = await buildExportRows(day);

  const header = [
    "Datum",
    "Wochentag",
    "Schicht",
    "Beginn",
    "Ende",
    "Vorname",
    "Nachname",
    "Telefon",
    "E-Mail",
    "Status",
    "Bemerkung",
    "Anmeldedatum",
  ];

  const lines = [header.join(";")];
  for (const r of rows) {
    lines.push(
      [r.date, r.weekday, r.shiftName, r.start, r.end, r.firstName, r.lastName, r.phone, r.email, r.status, r.notes, r.createdAt]
        .map((v) => csvEscape(v))
        .join(";")
    );
  }

  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="Helferplan_Weltcup_2026.csv"`,
    },
  });
}
