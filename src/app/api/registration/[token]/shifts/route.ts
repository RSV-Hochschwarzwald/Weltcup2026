import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { sendHelperConfirmationEmail } from "@/lib/email";
import type { ShiftPublicStatus, TokenLookupResult } from "@/types/database";

export const runtime = "nodejs";

const tokenPattern = /^[a-f0-9]{64}$/;
const schema = z.object({ shiftId: z.string().uuid() });

function publicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenPattern.test(token)) {
    return NextResponse.json({ success: false, message: "Ungültiger Link." }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Ungültige Anfrage." }, { status: 400 });
  }

  const supabase = publicSupabase();
  const { data, error } = await supabase.rpc("add_registration_by_token", {
    p_token: token,
    p_shift_id: parsed.data.shiftId,
  });

  if (error) {
    console.error("[registration:add-shift]", error);
    return NextResponse.json({ success: false, message: "Schicht konnte nicht hinzugefügt werden." }, { status: 500 });
  }

  const result = data as { success: boolean; error?: string; status?: string };
  if (!result.success) {
    if (result.error === "shift_full") {
      return NextResponse.json(
        { success: false, message: "Diese Schicht ist leider gerade voll geworden." },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, message: "Dieser Link ist ungültig oder abgelaufen." }, { status: 404 });
  }

  const { data: helperData } = await supabase.rpc("get_registration_by_token", { p_token: token });
  const helper = (helperData as TokenLookupResult | null)?.helper;
  const { data: shiftRow } = await supabase
    .from("shift_public_status")
    .select("*")
    .eq("shift_id", parsed.data.shiftId)
    .maybeSingle();

  if (helper?.email && shiftRow) {
    const s = shiftRow as ShiftPublicStatus;
    await sendHelperConfirmationEmail({
      to: helper.email,
      firstName: helper.first_name,
      shifts: [{ date: s.date, name: s.name, start_time: s.start_time, end_time: s.end_time }],
      editToken: token,
    });
  }

  return NextResponse.json(result);
}
