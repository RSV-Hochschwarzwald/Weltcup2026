import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function publicSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

const tokenPattern = /^[a-f0-9]{64}$/;

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenPattern.test(token)) {
    return NextResponse.json({ success: false, message: "Ungültiger Link." }, { status: 400 });
  }

  const supabase = publicSupabase();
  const { data, error } = await supabase.rpc("get_registration_by_token", { p_token: token });

  if (error) {
    console.error("[registration:get]", error);
    return NextResponse.json({ success: false, message: "Daten konnten nicht geladen werden." }, { status: 500 });
  }

  const result = data as { success: boolean; error?: string };
  if (!result.success) {
    return NextResponse.json({ success: false, message: "Dieser Link ist ungültig oder abgelaufen." }, { status: 404 });
  }

  return NextResponse.json(result);
}

const patchSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    phone: z.string().trim().min(3).max(50).optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: "Bitte gib entweder eine E-Mail-Adresse oder eine Telefonnummer an.",
    path: ["email"],
  });

export async function PATCH(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenPattern.test(token)) {
    return NextResponse.json({ success: false, message: "Ungültiger Link." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Eingaben prüfen." },
      { status: 400 }
    );
  }

  const supabase = publicSupabase();
  const { data, error } = await supabase.rpc("update_helper_by_token", {
    p_token: token,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_email: parsed.data.email || null,
    p_phone: parsed.data.phone || null,
    p_notes: parsed.data.notes || null,
  });

  if (error) {
    console.error("[registration:patch]", error);
    return NextResponse.json({ success: false, message: "Änderung konnte nicht gespeichert werden." }, { status: 500 });
  }

  const result = data as { success: boolean; error?: string };
  if (!result.success) {
    return NextResponse.json({ success: false, message: "Dieser Link ist ungültig oder abgelaufen." }, { status: 404 });
  }

  return NextResponse.json(result);
}
