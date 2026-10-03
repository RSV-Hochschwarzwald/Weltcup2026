/**
 * Reine Hilfsfunktionen für die Akkreditierung (ohne Server-/Excel-Abhängigkeit,
 * damit sie auch in Tests und Server-Komponenten bequem nutzbar sind).
 */

export interface AccreditationHelper {
  id: string;
  firstName: string;
  lastName: string;
  hasPhoto: boolean;
  /** Dateiname des Fotos, z. B. "Max_Mustermann.jpg" (eindeutig innerhalb der Liste). */
  photoFileName: string;
}

interface HelperLike {
  id: string;
  first_name: string;
  last_name: string;
  photo_path: string | null;
}

interface ShiftLike {
  registrations: Array<{ status: string; helper: HelperLike }>;
}

/**
 * Macht aus einem Namen einen dateisystem-tauglichen Teil: Umlaute werden
 * transliteriert (Müller -> Mueller), Leerzeichen zu "_", alles andere
 * Unübliche entfernt.
 */
export function sanitizeNamePart(value: string): string {
  return value
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .replace(/_+/g, "_");
}

/** Dateiname "Vorname_Nachname.jpg" - bei gleichen Namen mit Zähler (_2, _3 ...). */
export function buildPhotoFileNames(
  people: Array<{ id: string; firstName: string; lastName: string }>
): Map<string, string> {
  const used = new Map<string, number>();
  const result = new Map<string, string>();

  for (const p of people) {
    const base = [sanitizeNamePart(p.firstName), sanitizeNamePart(p.lastName)].filter(Boolean).join("_") || "Helfer";
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    result.set(p.id, count === 1 ? `${base}.jpg` : `${base}_${count}.jpg`);
  }
  return result;
}

/**
 * Alle Personen mit mindestens einer AKTIVEN Schicht (je Person eine Zeile,
 * auch bei mehreren Schichten), sortiert nach Nachname, Vorname.
 */
export function collectAccreditationHelpers(shifts: ShiftLike[]): AccreditationHelper[] {
  const byId = new Map<string, HelperLike>();
  for (const shift of shifts) {
    for (const reg of shift.registrations) {
      if (reg.status === "active") byId.set(reg.helper.id, reg.helper);
    }
  }

  const sorted = [...byId.values()].sort(
    (a, b) =>
      a.last_name.localeCompare(b.last_name, "de") || a.first_name.localeCompare(b.first_name, "de")
  );

  const fileNames = buildPhotoFileNames(
    sorted.map((h) => ({ id: h.id, firstName: h.first_name, lastName: h.last_name }))
  );

  return sorted.map((h) => ({
    id: h.id,
    firstName: h.first_name,
    lastName: h.last_name,
    // Boolean() statt "!== null": Solange die Foto-Migration noch nicht
    // eingespielt ist, fehlt das Feld ganz (undefined) und zählt als "kein Foto".
    hasPhoto: Boolean(h.photo_path),
    photoFileName: fileNames.get(h.id) ?? "Helfer.jpg",
  }));
}
