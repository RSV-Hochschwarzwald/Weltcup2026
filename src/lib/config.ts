/**
 * Zentrale, typisierte Zugriffsstelle für Konfigurationswerte aus
 * Environment Variables (CLAUDE-Vorgabe Abschnitt 65: nicht an vielen
 * Stellen im Code hart einprogrammieren).
 */
export const config = {
  eventName:
    process.env.NEXT_PUBLIC_EVENT_NAME ?? "Weltcup Skispringen Titisee-Neustadt 2026",
  organizationName: process.env.NEXT_PUBLIC_ORGANIZATION_NAME ?? "RSV Hochschwarzwald e.V.",
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
