import { describe, expect, it } from "vitest";
import { getStatusLabel, mapPublicShift } from "@/lib/mapShift";
import type { ShiftPublicStatus } from "@/types/database";

function makeRow(overrides: Partial<ShiftPublicStatus> = {}): ShiftPublicStatus {
  return {
    shift_id: "shift-1",
    event_id: "event-1",
    date: "2026-12-11",
    name: "Schicht 1",
    start_time: "11:00:00",
    end_time: "15:15:00",
    capacity: 4,
    status: "open",
    manually_locked: false,
    sort_order: 1,
    active_count: 0,
    available_count: 4,
    is_full: false,
    waitlist_count: 0,
    first_names: [],
    ...overrides,
  };
}

describe("Kapazitäts- und Statuslogik (CLAUDE-Vorgabe Abschnitt 6, 7, 70, 80)", () => {
  it("Test 1: 0 Helfer -> Anmeldung möglich, 4 Plätze frei", () => {
    const shift = mapPublicShift(makeRow({ active_count: 0, available_count: 4, is_full: false }), false);
    expect(shift.isBookable).toBe(true);
    expect(getStatusLabel(shift)).toBe("Noch 4 von 4 Plätzen frei");
  });

  it("Test 2: 3 Helfer -> vierte Anmeldung möglich, genau 1 Platz frei (hervorgehoben)", () => {
    const shift = mapPublicShift(makeRow({ active_count: 3, available_count: 1, is_full: false }), false);
    expect(shift.isBookable).toBe(true);
    expect(getStatusLabel(shift)).toBe("Noch 1 Platz frei");
  });

  it("Test 3: 4 Helfer -> fünfte Anmeldung unmöglich (Frontend deaktiviert)", () => {
    const shift = mapPublicShift(makeRow({ active_count: 4, available_count: 0, is_full: true }), false);
    expect(shift.isBookable).toBe(false);
    expect(getStatusLabel(shift)).toBe("Voll belegt");
  });

  it("Test 6: volle Schicht ohne Warteliste zeigt einfaches 'Voll belegt'", () => {
    const shift = mapPublicShift(makeRow({ active_count: 4, available_count: 0, is_full: true }), false);
    expect(shift.isBookable).toBe(false);
    expect(shift.waitlistEnabled).toBe(false);
  });

  it("volle Schicht MIT aktivierter Warteliste weist explizit darauf hin", () => {
    const shift = mapPublicShift(makeRow({ active_count: 4, available_count: 0, is_full: true }), true);
    expect(getStatusLabel(shift)).toBe("Voll belegt – Warteliste möglich");
  });

  it("Test 7: manuell gesperrte Schicht ist nicht buchbar, auch mit freien Plätzen", () => {
    const shift = mapPublicShift(
      makeRow({ active_count: 1, available_count: 3, is_full: false, manually_locked: true }),
      false
    );
    expect(shift.isBookable).toBe(false);
    expect(getStatusLabel(shift)).toBe("Nicht mehr verfügbar");
  });

  it("geschlossene Schicht (status != open) ist nicht buchbar", () => {
    const shift = mapPublicShift(makeRow({ status: "closed" }), false);
    expect(shift.isBookable).toBe(false);
  });
});
