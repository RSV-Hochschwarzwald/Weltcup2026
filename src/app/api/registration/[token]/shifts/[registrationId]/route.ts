import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAdminCancellationNotification, sendHelperCancellationEmail } from "@/lib/email";
import type { ShiftPublicStatus, TokenLookupResult } from "@/types/database";

export const runtime = "nodejs";

const tokenPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function publicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ token: string; registrationId: string }> }
) {
  const { token, registrationId } = await params;
  if (!tokenPattern.test(token) || !uuidPattern.test(registrationId)) {
    return NextResponse.json({ success: false, message: "Ungültige Anfrage." }, { status: 400 });
  }

  const supabase = publicSupabase();

  const { data: helperData } = await supabase.rpc("get_registration_by_token", { p_token: token });
  const helperResult = helperData as TokenLookupResult | null;
  const cancelledInfo = helperResult?.registrations?.find((r) => r.registration_id === registrationId);

  const { data, error } = await supabase.rpc("cancel_registration_by_token", {
    p_token: token,
    p_registration_id: registrationId,
  });

  if (error) {
    console.error("[registration:cancel]", error);
    return NextResponse.json({ success: false, message: "Absage konnte nicht gespeichert werden." }, { status: 500 });
  }

  const result = data as { success: boolean; error?: string; shift_id?: string };
  if (!result.success) {
    return NextResponse.json({ success: false, message: "Diese Anmeldung wurde nicht gefunden." }, { status: 404 });
  }

  if (helperResult?.helper && cancelledInfo) {
    const { data: shiftRow } = await supabase
      .from("shift_public_status")
      .select("*")
      .eq("shift_id", result.shift_id)
      .maybeSingle();

    const shiftSummary = {
      date: cancelledInfo.date,
      name: cancelledInfo.name,
      start_time: cancelledInfo.start_time,
      end_time: cancelledInfo.end_time,
    };

    if (helperResult.helper.email) {
      await sendHelperCancellationEmail({
        to: helperResult.helper.email,
        firstName: helperResult.helper.first_name,
        cancelledShift: shiftSummary,
        editToken: token,
      });
    }

    const s = shiftRow as ShiftPublicStatus | null;
    await sendAdminCancellationNotification({
      firstName: helperResult.helper.first_name,
      lastName: helperResult.helper.last_name,
      cancelledShift: shiftSummary,
      occupancySummary: s ? `${s.active_count} / ${s.capacity}` : "unbekannt",
    });
  }

  return NextResponse.json({ success: true });
}
