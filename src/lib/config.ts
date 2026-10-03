/**
 * Zentrale, typisierte Zugriffsstelle für Konfigurationswerte aus
 * Environment Variables (CLAUDE-Vorgabe Abschnitt 65: nicht an vielen
 * Stellen im Code hart einprogrammieren).
 */
export const config = {
  eventName:
    process.env.NEXT_PUBLIC_EVENT_NAME ?? "Weltcup Skispringen Titisee-Neustadt 2026",
  // Kurzer, kleiner Vorspann über der großen Überschrift auf der Startseite
  // (z. B. "Weltcup Skispringen"). Für eine neue Veranstaltung einfach die
  // beiden Werte in der Umgebungskonfiguration anpassen - kein Code-Update
  // nötig.
  eventKicker: process.env.NEXT_PUBLIC_EVENT_KICKER ?? "Weltcup Skispringen",
  // Große Überschrift auf der Startseite (z. B. der Veranstaltungsort).
  eventLocation: process.env.NEXT_PUBLIC_EVENT_LOCATION ?? "Titisee-Neustadt",
  organizationName: process.env.NEXT_PUBLIC_ORGANIZATION_NAME ?? "RSV Hochschwarzwald e.V.",
  // Akkreditierungsliste (Excel-Download im Adminbereich). Überschrift und
  // "Funktion" der Helfer sind Veranstaltungs-Vorgaben; per Variable
  // überschreibbar (|| statt ??, damit auch eine leere GitHub-Variable auf
  // den Standard zurückfällt).
  accreditationTitle:
    process.env.NEXT_PUBLIC_ACCREDITATION_TITLE || "FIS Skisprung Weltcup Titisee-Neustadt 11.12-13.12.2026",
  accreditationFunction:
    process.env.NEXT_PUBLIC_ACCREDITATION_FUNCTION || "Arbeitseinsatz RSV Hochschwarzwald",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Helferteam <no-reply@example.org>",
  publicFirstNamesEnabled: process.env.NEXT_PUBLIC_PUBLIC_FIRST_NAMES_ENABLED === "true",
  notifyOnShiftFull: process.env.NOTIFY_ON_SHIFT_FULL !== "false",
  microsoftIntegrationEnabled: process.env.MICROSOFT_INTEGRATION_ENABLED === "true",
} as const;

export function getEditLink(token: string): string {
  return `${config.appUrl.replace(/\/$/, "")}/meine-anmeldung/${token}`;
}
