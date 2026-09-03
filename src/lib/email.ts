import "server-only";
import { Resend } from "resend";
import { config, getEditLink } from "@/lib/config";
import { formatDateLong, formatTimeRange } from "@/lib/format";

export interface ShiftSummary {
  date: string;
  name: string;
  start_time: string;
  end_time: string;
}

function shiftListText(shifts: ShiftSummary[]): string {
  return shifts
    .map((s) => `${formatDateLong(s.date)}\n${formatTimeRange(s.start_time, s.end_time)}`)
    .join("\n\n");
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

async function sendMail(to: string, subject: string, text: string) {
  const resend = getResend();
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY nicht gesetzt – E-Mail an ${to} wurde NICHT versendet. Betreff: ${subject}`
    );
    return { sent: false as const };
  }

  try {
    await resend.emails.send({
      from: config.emailFrom,
      to,
      subject,
      text,
    });
    return { sent: true as const };
  } catch (err) {
    console.error("[email] Versand fehlgeschlagen", err);
    return { sent: false as const, error: err };
  }
}

export async function sendHelperConfirmationEmail(params: {
  to: string;
  firstName: string;
  shifts: ShiftSummary[];
  waitlistShifts?: ShiftSummary[];
  editToken: string;
}) {
  const subject = `Deine Helferanmeldung – ${config.eventName}`;
  const waitlistBlock =
    params.waitlistShifts && params.waitlistShifts.length > 0
      ? `\n\nFür folgende Schichten stehst du zusätzlich auf der Warteliste (du rückst automatisch nach, sobald ein Platz frei wird):\n\n${shiftListText(params.waitlistShifts)}`
      : "";
  const text = `Hallo ${params.firstName},

vielen Dank für deine Unterstützung beim Weltcup Skispringen in Titisee-Neustadt.

Du bist für folgende Helfereinsätze angemeldet:

${shiftListText(params.shifts)}${waitlistBlock}

Über folgenden Link kannst du deine Anmeldung später ansehen oder ändern:

${getEditLink(params.editToken)}

Viele Grüße
${config.organizationName}`;

  return sendMail(params.to, subject, text);
}

export async function sendHelperCancellationEmail(params: {
  to: string;
  firstName: string;
  cancelledShift: ShiftSummary;
  editToken: string;
}) {
  const subject = `Deine Schichtabsage – ${config.eventName}`;
  const text = `Hallo ${params.firstName},

wir haben deine Absage für folgende Schicht erhalten:

${shiftListText([params.cancelledShift])}

Du kannst deine übrigen Helfereinsätze jederzeit über deinen persönlichen Link ansehen oder ändern:

${getEditLink(params.editToken)}

Vielen Dank für deine Unterstützung!
${config.organizationName}`;

  return sendMail(params.to, subject, text);
}

export async function sendAdminNewRegistrationNotification(params: {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  shifts: ShiftSummary[];
  occupancySummary: string;
}) {
  if (!config.adminNotificationEmail) return { sent: false as const };

  const subject = `Neue Helferanmeldung – ${config.eventName}`;
  const text = `Neue Helferanmeldung

Name:
${params.firstName} ${params.lastName}

Telefon:
${params.phone ?? "-"}

E-Mail:
${params.email ?? "-"}

Angemeldete Schichten:

${shiftListText(params.shifts)}

Aktuelle Belegung:

${params.occupancySummary}`;

  return sendMail(config.adminNotificationEmail, subject, text);
}

export async function sendAdminCancellationNotification(params: {
  firstName: string;
  lastName: string;
  cancelledShift: ShiftSummary;
  occupancySummary: string;
}) {
  if (!config.adminNotificationEmail) return { sent: false as const };

  const subject = `Helferschicht abgesagt – ${config.eventName}`;
  const text = `Name:
${params.firstName} ${params.lastName}

Abgesagte Schicht:

${shiftListText([params.cancelledShift])}

Aktuelle Belegung:

${params.occupancySummary}`;

  return sendMail(config.adminNotificationEmail, subject, text);
}

export async function sendShiftFullNotification(shift: ShiftSummary) {
  if (!config.adminNotificationEmail || !config.notifyOnShiftFull) return { sent: false as const };

  const subject = `Schicht vollständig besetzt – ${config.eventName}`;
  const text = `Schicht vollständig besetzt

${shiftListText([shift])}

Alle Plätze sind belegt.`;

  return sendMail(config.adminNotificationEmail, subject, text);
}
