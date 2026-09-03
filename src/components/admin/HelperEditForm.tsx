"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteHelperAction, updateHelperAction } from "@/app/admin/actions";
import type { HelperRow } from "@/types/database";

export function HelperEditForm({ helper }: { helper: HelperRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateHelperAction(helper.id, formData);
        setMessage("Gespeichert.");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  function remove() {
    if (!confirm(`${helper.first_name} ${helper.last_name} inkl. aller Anmeldungen endgültig löschen?`)) return;
    startTransition(async () => {
      await deleteHelperAction(helper.id);
      router.push("/admin/helfer");
    });
  }

  return (
    <form action={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input name="firstName" defaultValue={helper.first_name} required className="input" placeholder="Vorname" />
        <input name="lastName" defaultValue={helper.last_name} required className="input" placeholder="Nachname" />
      </div>
      <input name="email" type="email" defaultValue={helper.email ?? ""} className="input" placeholder="E-Mail" />
      <input name="phone" type="tel" defaultValue={helper.phone ?? ""} className="input" placeholder="Telefon" />
      <textarea name="notes" defaultValue={helper.notes ?? ""} className="input min-h-[70px]" placeholder="Bemerkung" />

      {message && <p className="text-sm font-semibold text-brand-700">{message}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-70">
          Speichern
        </button>
        <button type="button" onClick={remove} disabled={pending} className="rounded-lg border-2 border-red-300 px-4 py-2 font-semibold text-red-700">
          Helfer löschen
        </button>
      </div>
    </form>
  );
}
