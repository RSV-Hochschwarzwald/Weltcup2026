"use client";

import { useState, useTransition } from "react";
import { updateSettingsAction } from "@/app/admin/actions";

export function SettingsForm({
  waitlistEnabled,
  publicFirstNamesEnabled,
  notifyOnShiftFull,
}: {
  waitlistEnabled: boolean;
  publicFirstNamesEnabled: boolean;
  notifyOnShiftFull: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function submit(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      await updateSettingsAction(formData);
      setSaved(true);
    });
  }

  return (
    <form action={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-card">
      <Toggle name="waitlistEnabled" label="Warteliste aktivieren" defaultChecked={waitlistEnabled} />
      <Toggle
        name="publicFirstNamesEnabled"
        label="Vornamen öffentlich anzeigen (derzeit ohne Frontend-Anzeige umgesetzt)"
        defaultChecked={publicFirstNamesEnabled}
      />
      <Toggle name="notifyOnShiftFull" label="Benachrichtigung senden, wenn eine Schicht voll wird" defaultChecked={notifyOnShiftFull} />

      {saved && <p className="text-sm font-semibold text-emerald-700">Gespeichert.</p>}

      <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-5 py-2.5 font-bold text-white disabled:opacity-70">
        {pending ? "Speichern …" : "Speichern"}
      </button>
    </form>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-5 w-5" />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}
