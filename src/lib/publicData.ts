import { createClient } from "@supabase/supabase-js";
import type { EventRow, ShiftPublicStatus } from "@/types/database";

function anonServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function getActiveEvent(): Promise<Pick<EventRow, "id" | "title" | "start_date" | "end_date" | "registration_deadline"> | null> {
  const supabase = anonServerClient();
  const { data } = await supabase.from("event_public_info").select("*").limit(1).maybeSingle();
  return data;
}

export async function getPublicShifts(): Promise<ShiftPublicStatus[]> {
  const supabase = anonServerClient();
  const { data, error } = await supabase
    .from("shift_public_status")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getPublicShifts]", error);
    return [];
  }
  return (data ?? []) as ShiftPublicStatus[];
}

export async function getWaitlistEnabled(): Promise<boolean> {
  const supabase = anonServerClient();
  const { data } = await supabase.from("public_settings").select("waitlist_enabled").maybeSingle();
  return data?.waitlist_enabled === true;
}
