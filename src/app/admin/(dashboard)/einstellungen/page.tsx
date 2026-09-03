import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const revalidate = 0;

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin || admin.role !== "admin") {
    redirect("/admin");
  }

  const client = createAdminClient();
  const { data } = await client.from("settings").select("key, value");
  const settingsMap = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Einstellungen</h1>
      <SettingsForm
        waitlistEnabled={settingsMap.waitlist_enabled === true}
        publicFirstNamesEnabled={settingsMap.public_first_names_enabled === true}
        notifyOnShiftFull={settingsMap.notify_on_shift_full !== false}
      />
    </div>
  );
}
