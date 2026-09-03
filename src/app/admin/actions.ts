"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

async function logAction(adminEmail: string, action: string, entityType: string, entityId: string, details?: object) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    admin_user: adminEmail,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details ?? null,
  });
}

export async function addNewHelperAction(formData: FormData) {
  const me = await requireRole("admin");
  const admin = createAdminClient();

  const shiftId = String(formData.get("shiftId"));
  const payload = {
    p_first_name: String(formData.get("firstName") ?? "").trim(),
    p_last_name: String(formData.get("lastName") ?? "").trim(),
    p_email: (formData.get("email") ? String(formData.get("email")).trim() : null) || null,
    p_phone: (formData.get("phone") ? String(formData.get("phone")).trim() : null) || null,
    p_notes: (formData.get("notes") ? String(formData.get("notes")).trim() : null) || null,
    p_shift_id: shiftId,
    p_force: formData.get("force") === "true",
  };

  const { data, error } = await admin.rpc("admin_add_registration", payload);
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string; helper_id?: string };
  if (!result.success) {
    throw new Error(result.error === "shift_full" ? "Diese Schicht ist bereits voll." : "Helfer konnte nicht gespeichert werden.");
  }

  await logAction(me.email ?? me.userId, "helper_added", "helper", result.helper_id ?? "", { shiftId });
  revalidatePath("/admin/helfer");
  revalidatePath("/admin");
}

export async function assignExistingHelperAction(helperId: string, shiftId: string, force = false) {
  const me = await requireRole("admin");
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("admin_assign_existing_helper", {
    p_helper_id: helperId,
    p_shift_id: shiftId,
    p_force: force,
  });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string };
  if (!result.success) {
    throw new Error(result.error === "shift_full" ? "Diese Schicht ist bereits voll." : "Zuordnung fehlgeschlagen.");
  }

  await logAction(me.email ?? me.userId, "helper_assigned", "registration", `${helperId}:${shiftId}`);
  revalidatePath("/admin/helfer");
  revalidatePath("/admin");
}

export async function moveRegistrationAction(registrationId: string, newShiftId: string, force = false) {
  const me = await requireRole("admin");
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("admin_move_registration", {
    p_registration_id: registrationId,
    p_new_shift_id: newShiftId,
    p_force: force,
  });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string };
  if (!result.success) {
    throw new Error(result.error === "shift_full" ? "Ziel-Schicht ist bereits voll." : "Verschieben fehlgeschlagen.");
  }

  await logAction(me.email ?? me.userId, "registration_moved", "registration", registrationId, { newShiftId });
  revalidatePath("/admin/helfer");
  revalidatePath("/admin");
}

export async function cancelRegistrationAdminAction(registrationId: string) {
  const me = await requireRole("admin");
  const admin = createAdminClient();

  const { error } = await admin.from("registrations").update({ status: "cancelled" }).eq("id", registrationId);
  if (error) throw new Error(error.message);

  await logAction(me.email ?? me.userId, "registration_cancelled", "registration", registrationId);
  revalidatePath("/admin/helfer");
  revalidatePath("/admin");
}

export async function promoteWaitlistAction(registrationId: string) {
  const me = await requireRole("admin");
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("admin_promote_waitlist", { p_registration_id: registrationId });
  if (error) throw new Error(error.message);

  const result = data as { success: boolean; error?: string };
  if (!result.success) throw new Error("Nachrücken fehlgeschlagen (Schicht evtl. bereits voll).");

  await logAction(me.email ?? me.userId, "waitlist_promoted", "registration", registrationId);
  revalidatePath("/admin/helfer");
}

export async function updateHelperAction(helperId: string, formData: FormData) {
  const me = await requireRole("admin");
  const admin = createAdminClient();

  const { error } = await admin
    .from("helpers")
    .update({
      first_name: String(formData.get("firstName") ?? "").trim(),
      last_name: String(formData.get("lastName") ?? "").trim(),
      email: (formData.get("email") ? String(formData.get("email")).trim() : null) || null,
      phone: (formData.get("phone") ? String(formData.get("phone")).trim() : null) || null,
      notes: (formData.get("notes") ? String(formData.get("notes")).trim() : null) || null,
    })
    .eq("id", helperId);

  if (error) throw new Error(error.message);

  await logAction(me.email ?? me.userId, "helper_updated", "helper", helperId);
  revalidatePath(`/admin/helfer/${helperId}`);
  revalidatePath("/admin/helfer");
}

export async function deleteHelperAction(helperId: string) {
  const me = await requireRole("admin");
  const admin = createAdminClient();

  const { error } = await admin.from("helpers").delete().eq("id", helperId);
  if (error) throw new Error(error.message);

  await logAction(me.email ?? me.userId, "helper_deleted", "helper", helperId);
  revalidatePath("/admin/helfer");
  revalidatePath("/admin");
}

export async function setShiftLockAction(shiftId: string, locked: boolean) {
  const me = await requireRole("admin");
  const admin = createAdminClient();

  const { error } = await admin.from("shifts").update({ manually_locked: locked }).eq("id", shiftId);
  if (error) throw new Error(error.message);

  await logAction(me.email ?? me.userId, locked ? "shift_locked" : "shift_unlocked", "shift", shiftId);
  revalidatePath("/admin/helfer");
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function setRegistrationNoteAction(registrationId: string, note: string) {
  const me = await requireRole("admin");
  const admin = createAdminClient();

  const { error } = await admin.from("registrations").update({ admin_note: note || null }).eq("id", registrationId);
  if (error) throw new Error(error.message);

  await logAction(me.email ?? me.userId, "registration_note_set", "registration", registrationId);
  revalidatePath("/admin/helfer");
}

export async function updateSettingsAction(formData: FormData) {
  const me = await requireRole("admin");
  const admin = createAdminClient();

  const entries: Array<[string, unknown]> = [
    ["waitlist_enabled", formData.get("waitlistEnabled") === "on"],
    ["public_first_names_enabled", formData.get("publicFirstNamesEnabled") === "on"],
    ["notify_on_shift_full", formData.get("notifyOnShiftFull") === "on"],
  ];

  for (const [key, value] of entries) {
    const { error } = await admin.from("settings").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }

  await logAction(me.email ?? me.userId, "settings_updated", "settings", "global");
  revalidatePath("/admin/einstellungen");
  revalidatePath("/");
}
