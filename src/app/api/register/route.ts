import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import {
  sendAdminNewRegistrationNotification,
  sendHelperConfirmationEmail,
  sendShiftFullNotification,
} from "@/lib/email";
import { formatDateLong, formatTimeRange } from "@/lib/format";
import type { ShiftPublicStatus } from "@/types/database";

export const runtime = "nodejs";

const schema = z
  .object({
    firstName: z.string().trim().min(1, "Vorname ist erforderlich").max(100),
    lastName: z.string().trim().min(1, "Nachname ist erforderlich").max(100),
    email: z.string().trim().email("Ungültige E-Mail-Adresse").max(200).optional().or(z.literal("")),
    phone: z.string().trim().min(3).max(50).optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    shiftIds: z.array(z.string().uuid()).min(1, "Bitte wähle mindestens eine Schicht aus."),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: "Bitte gib entweder eine E-Mail-Adresse oder eine Telefonnummer an.",
    path: ["email"],
  });

/** Anon-Key-Client: alle Schreibzugriffe laufen über die SECURITY DEFINER RPC-Funktion. */
function publicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Ungültige Anfrage." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Eingaben prüfen." },
      { status: 400 }
    );
  }

  const { firstName, lastName, email, phone, notes, shiftIds } = parsed.data;
  const supabase = publicSupabase();

  const { data, error } = await supabase.rpc("register_helper", {
    p_first_name: firstName,
    p_last_name: lastName,
    p_email: email || null,
    p_phone: phone || null,
    p_notes: notes || null,
    p_shift_ids: shiftIds,
  });

  if (error) {
    console.error("[register] RPC-Fehler", error);
    return NextResponse.json(
      { success: false, message: "Deine Anmeldung konnte leider nicht gespeichert werden. Bitte versuche es erneut." },
      { status: 500 }
    );
  }

  const result = data as
    | { success: true; helper_id: string; edit_token: string; booked_shift_ids: string[]; waitlisted_shift_ids: string[] }
    | { success: false; error: string; failed_shift_ids?: string[] };

  if (!result.success) {
    if (result.error === "shifts_full") {
      return NextResponse.json(
        {
          success: false,
          message: "Eine oder mehrere ausgewählte Schichten wurden leider gerade vollständig belegt. Bitte wähle andere Schichten.",
          failedShiftIds: result.failed_shift_ids ?? [],
        },
        { status: 409 }
      );
    }
    if (result.error === "contact_required") {
      return NextResponse.json(
        { success: false, message: "Bitte gib entweder eine E-Mail-Adresse oder eine Telefonnummer an." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Deine Anmeldung konnte leider nicht gespeichert werden. Bitte versuche es erneut." },
      { status: 500 }
    );
  }

  const allShiftIds = [...result.booked_shift_ids, ...result.waitlisted_shift_ids];

  // Schicht-Details + aktuelle Belegung für Bestätigungs-/Benachrichtigungs-E-Mails laden.
  // Ausschließlich öffentliche, aggregierte Daten aus shift_public_status.
  const { data: shiftRows } = await supabase
    .from("shift_public_status")
    .select("*")
    .in("shift_id", allShiftIds);

  const shifts = (shiftRows ?? []) as ShiftPublicStatus[];
  const bookedShifts = shifts.filter((s) => result.booked_shift_ids.includes(s.shift_id));
  const waitlistedShifts = shifts.filter((s) => result.waitlisted_shift_ids.includes(s.shift_id));
  const shiftSummaries = bookedShifts.map((s) => ({
    date: s.date,
    name: s.name,
    start_time: s.start_time,
    end_time: s.end_time,
  }));

  const waitlistSummaries = waitlistedShifts.map((s) => ({
    date: s.date,
    name: s.name,
    start_time: s.start_time,
    end_time: s.end_time,
  }));

  if (email) {
    await sendHelperConfirmationEmail({
      to: email,
      firstName,
      shifts: shiftSummaries,
      waitlistShifts: waitlistSummaries,
      editToken: result.edit_token,
    });
  }

  const occupancySummary = shifts
    .map((s) => `${formatDateLong(s.date)} ${s.name} (${formatTimeRange(s.start_time, s.end_time)}): ${s.active_count} / ${s.capacity}`)
    .join("\n");

  await sendAdminNewRegistrationNotification({
    firstName,
    lastName,
    phone: phone || null,
    email: email || null,
    shifts: shiftSummaries,
    occupancySummary,
  });

  for (const s of shifts) {
    if (s.is_full) {
      await sendShiftFullNotification({ date: s.date, name: s.name, start_time: s.start_time, end_time: s.end_time });
    }
  }

  return NextResponse.json({
    success: true,
    editToken: result.edit_token,
    bookedShiftIds: result.booked_shift_ids,
    waitlistedShiftIds: result.waitlisted_shift_ids,
  });
}
