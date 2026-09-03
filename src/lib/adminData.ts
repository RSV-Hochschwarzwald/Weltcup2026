import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventRow, HelperRow, RegistrationRow, ShiftRow } from "@/types/database";

export interface ShiftWithRegistrations extends ShiftRow {
  registrations: Array<RegistrationRow & { helper: HelperRow }>;
}

export type HelperWithRegistrations = HelperRow & {
  registrations: Array<RegistrationRow & { shift: ShiftRow }>;
};

export async function getActiveEventAdmin(): Promise<EventRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("events")
    .select("*")
    .eq("active", true)
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getShiftsWithRegistrations(eventId: string): Promise<ShiftWithRegistrations[]> {
  const admin = createAdminClient();

  const { data: shifts, error: shiftsError } = await admin
    .from("shifts")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (shiftsError || !shifts) return [];

  const { data: registrations } = await admin
    .from("registrations")
    .select("*, helper:helpers(*)")
    .in(
      "shift_id",
      shifts.map((s) => s.id)
    )
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  const typedRegistrations = (registrations ?? []) as Array<RegistrationRow & { helper: HelperRow }>;

  return shifts.map((shift) => ({
    ...shift,
    registrations: typedRegistrations.filter((r) => r.shift_id === shift.id),
  }));
}

export async function getAllHelpersAdmin(): Promise<HelperWithRegistrations[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("helpers")
    .select("*, registrations(*, shift:shifts(*))")
    .order("last_name", { ascending: true });

  return (data ?? []) as unknown as HelperWithRegistrations[];
}

export async function getAllShiftsAdmin(eventId: string): Promise<ShiftRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("shifts")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function getHelperByIdAdmin(id: string): Promise<HelperWithRegistrations | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("helpers")
    .select("*, registrations(*, shift:shifts(*))")
    .eq("id", id)
    .maybeSingle();
  return data as unknown as HelperWithRegistrations | null;
}
