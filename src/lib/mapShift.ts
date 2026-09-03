import { formatWeekday } from "@/lib/format";
import type { PublicShift, ShiftPublicStatus } from "@/types/database";

export function mapPublicShift(row: ShiftPublicStatus, waitlistEnabled: boolean): PublicShift {
  const isLocked = row.status !== "open" || row.manually_locked;
  return {
    shiftId: row.shift_id,
    date: row.date,
    dayLabel: formatWeekday(row.date).toUpperCase(),
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    capacity: row.capacity,
    activeCount: row.active_count,
    availableCount: row.available_count,
    isFull: row.is_full,
    isLocked,
    isBookable: !isLocked && !row.is_full,
    waitlistCount: row.waitlist_count,
    waitlistEnabled,
  };
}

export function getStatusLabel(shift: PublicShift): string {
  if (shift.isLocked) return "Nicht mehr verfügbar";
  if (shift.isFull) {
    return shift.waitlistEnabled ? "Voll belegt – Warteliste möglich" : "Voll belegt";
  }
  if (shift.availableCount === 1) return "Noch 1 Platz frei";
  return `Noch ${shift.availableCount} von ${shift.capacity} Plätzen frei`;
}

export function groupByDate(shifts: PublicShift[]): Map<string, PublicShift[]> {
  const map = new Map<string, PublicShift[]>();
  for (const shift of shifts) {
    const list = map.get(shift.date) ?? [];
    list.push(shift);
    map.set(shift.date, list);
  }
  return map;
}
