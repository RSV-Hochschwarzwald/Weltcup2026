import { describe, expect, it } from "vitest";
import { formatDateLong, formatDateShort, formatTimeRange, formatWeekday } from "@/lib/format";

describe("format.ts – deutsches Datums-/Zeitformat", () => {
  it("formatiert Datum als TT.MM.JJJJ", () => {
    expect(formatDateShort("2026-12-11")).toBe("11.12.2026");
    expect(formatDateShort("2026-12-13")).toBe("13.12.2026");
  });

  it("ermittelt den korrekten deutschen Wochentag ohne Zeitzonen-Verschiebung", () => {
    // 11.12.2026 ist ein Freitag, 12.12. ein Samstag, 13.12. ein Sonntag.
    expect(formatWeekday("2026-12-11")).toBe("Freitag");
    expect(formatWeekday("2026-12-12")).toBe("Samstag");
    expect(formatWeekday("2026-12-13")).toBe("Sonntag");
  });

  it("formatiert Langdatum inkl. Wochentag", () => {
    expect(formatDateLong("2026-12-11")).toBe("Freitag, 11. Dezember 2026");
  });

  it("formatiert Zeitspannen ohne Sekunden, mit 'Uhr'-Suffix", () => {
    expect(formatTimeRange("11:00:00", "15:15:00")).toBe("11:00 – 15:15 Uhr");
    expect(formatTimeRange("15:00", "19:15")).toBe("15:00 – 19:15 Uhr");
  });
});
