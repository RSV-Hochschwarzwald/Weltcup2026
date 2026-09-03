const WEEKDAYS_DE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** Parst ein "YYYY-MM-DD" Datum ohne Zeitzonen-Verschiebung. */
export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function formatDateShort(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

export function formatWeekday(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  return WEEKDAYS_DE[d.getDay()] ?? "";
}

export function formatDateLong(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  return `${formatWeekday(dateStr)}, ${d.getDate()}. ${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}`;
}

/** "11:00:00" oder "11:00" -> "11:00" */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)} Uhr`;
}

export function formatDateTimeDe(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
