import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin, AuthError } from "@/lib/auth";
import { getActiveEventAdmin, getShiftsWithRegistrations } from "@/lib/adminData";
import { formatDateShort, formatDateTimeDe, formatTimeRange, formatWeekday } from "@/lib/format";

export const runtime = "nodejs";

const STATUS_LABEL: Record<string, string> = {
  active: "Angemeldet",
  waitlist: "Warteliste",
  cancelled: "Abgesagt",
};

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ message: "Nicht berechtigt." }, { status: 401 });
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const day = searchParams.get("day") ?? "alle";

  const event = await getActiveEventAdmin();
  if (!event) return NextResponse.json({ message: "Kein aktives Event." }, { status: 404 });

  let shifts = await getShiftsWithRegistrations(event.id);
  if (day !== "alle") {
    shifts = shifts.filter((s) => formatWeekday(s.date).toLowerCase() === day);
  }

  const byDate = new Map<string, typeof shifts>();
  for (const s of shifts) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RSV Hochschwarzwald e.V.";
  workbook.created = new Date();

  const planSheet = workbook.addWorksheet("Helferplan");
  planSheet.columns = [
    { header: "Datum", key: "date", width: 12 },
    { header: "Wochentag", key: "weekday", width: 12 },
    { header: "Schicht", key: "shift", width: 12 },
    { header: "Beginn", key: "start", width: 10 },
    { header: "Ende", key: "end", width: 10 },
    { header: "Übergabe", key: "overlap", width: 16 },
    { header: "Helfer 1", key: "h1", width: 22 },
    { header: "Helfer 2", key: "h2", width: 22 },
    { header: "Helfer 3", key: "h3", width: 22 },
    { header: "Helfer 4", key: "h4", width: 22 },
  ];
  planSheet.getRow(1).font = { bold: true };

  for (const dayShifts of byDate.values()) {
    const [s1, s2] = dayShifts;
    const overlap =
      s1 && s2
        ? formatTimeRange(
            s1.start_time > s2.start_time ? s1.start_time : s2.start_time,
            s1.end_time < s2.end_time ? s1.end_time : s2.end_time
          )
        : "";

    for (const shift of dayShifts) {
      const active = shift.registrations.filter((r) => r.status === "active");
      const names = active.map((r) => `${r.helper.first_name} ${r.helper.last_name}`);
      planSheet.addRow({
        date: formatDateShort(shift.date),
        weekday: formatWeekday(shift.date),
        shift: shift.name,
        start: shift.start_time.slice(0, 5),
        end: shift.end_time.slice(0, 5),
        overlap,
        h1: names[0] ?? "",
        h2: names[1] ?? "",
        h3: names[2] ?? "",
        h4: names[3] ?? "",
      });
    }
  }

  const allSheet = workbook.addWorksheet("Alle Helfer");
  allSheet.columns = [
    { header: "Vorname", key: "firstName", width: 16 },
    { header: "Nachname", key: "lastName", width: 16 },
    { header: "Telefon", key: "phone", width: 16 },
    { header: "E-Mail", key: "email", width: 24 },
    { header: "Datum", key: "date", width: 12 },
    { header: "Schicht", key: "shift", width: 12 },
    { header: "Beginn", key: "start", width: 10 },
    { header: "Ende", key: "end", width: 10 },
    { header: "Status", key: "status", width: 14 },
    { header: "Bemerkung", key: "notes", width: 28 },
    { header: "Anmeldedatum", key: "createdAt", width: 20 },
  ];
  allSheet.getRow(1).font = { bold: true };

  for (const shift of shifts) {
    for (const r of shift.registrations) {
      allSheet.addRow({
        firstName: r.helper.first_name,
        lastName: r.helper.last_name,
        phone: r.helper.phone ?? "",
        email: r.helper.email ?? "",
        date: formatDateShort(shift.date),
        shift: shift.name,
        start: shift.start_time.slice(0, 5),
        end: shift.end_time.slice(0, 5),
        status: STATUS_LABEL[r.status] ?? r.status,
        notes: r.helper.notes ?? "",
        createdAt: formatDateTimeDe(r.created_at),
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Helferplan_Weltcup_2026.xlsx"`,
    },
  });
}
