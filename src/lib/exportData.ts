import "server-only";
import { getActiveEventAdmin, getShiftsWithRegistrations } from "@/lib/adminData";
import { formatDateShort, formatDateTimeDe, formatTimeRange, formatWeekday } from "@/lib/format";

export interface ExportRow {
  date: string;
  weekday: string;
  shiftName: string;
  start: string;
  end: string;
  overlap: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  status: string;
  notes: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Angemeldet",
  waitlist: "Warteliste",
  cancelled: "Abgesagt",
};

export async function buildExportRows(dayFilter?: string): Promise<{ rows: ExportRow[]; shiftOverlaps: Map<string, string> }> {
  const event = await getActiveEventAdmin();
  if (!event) return { rows: [], shiftOverlaps: new Map() };

  let shifts = await getShiftsWithRegistrations(event.id);
  if (dayFilter && dayFilter !== "alle") {
    shifts = shifts.filter((s) => formatWeekday(s.date).toLowerCase() === dayFilter);
  }

  const byDate = new Map<string, typeof shifts>();
  for (const s of shifts) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);

  const overlaps = new Map<string, string>();
  for (const dayShifts of byDate.values()) {
    const [s1, s2] = dayShifts;
    if (s1 && s2) {
      const overlapStart = s1.start_time > s2.start_time ? s1.start_time : s2.start_time;
      const overlapEnd = s1.end_time < s2.end_time ? s1.end_time : s2.end_time;
      const label = formatTimeRange(overlapStart, overlapEnd);
      overlaps.set(s1.id, label);
      overlaps.set(s2.id, label);
    }
  }

  const rows: ExportRow[] = [];
  for (const shift of shifts) {
    const regs = shift.registrations.length > 0 ? shift.registrations : [null];
    for (const r of regs) {
      rows.push({
        date: formatDateShort(shift.date),
        weekday: formatWeekday(shift.date),
        shiftName: shift.name,
        start: shift.start_time.slice(0, 5),
        end: shift.end_time.slice(0, 5),
        overlap: overlaps.get(shift.id) ?? "",
        firstName: r?.helper.first_name ?? "",
        lastName: r?.helper.last_name ?? "",
        phone: r?.helper.phone ?? "",
        email: r?.helper.email ?? "",
        status: r ? (STATUS_LABEL[r.status] ?? r.status) : "",
        notes: r?.helper.notes ?? "",
        createdAt: r ? formatDateTimeDe(r.created_at) : "",
      });
    }
  }

  return { rows, shiftOverlaps: overlaps };
}
