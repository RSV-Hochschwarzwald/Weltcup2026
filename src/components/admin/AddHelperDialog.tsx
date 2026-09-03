"use client";

import { useRef, useState, useTransition } from "react";
import { addNewHelperAction } from "@/app/admin/actions";

export function AddHelperDialog({ shiftId, shiftLabel, disabled }: { shiftId: string; shiftLabel: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addNewHelperAction(formData);
        setOpen(false);
        formRef.current?.reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border-2 border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-700"
      >
        + Helfer hinzufügen
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-lg font-bold text-slate-900">Helfer hinzufügen</h3>
            <p className="mb-4 text-sm text-slate-500">{shiftLabel}</p>
            <form ref={formRef} action={submit} className="space-y-3">
              <input type="hidden" name="shiftId" value={shiftId} />
              <div className="grid grid-cols-2 gap-3">
                <input name="firstName" required placeholder="Vorname" className="input" />
                <input name="lastName" required placeholder="Nachname" className="input" />
              </div>
              <input name="email" type="email" placeholder="E-Mail" className="input" />
              <input name="phone" type="tel" placeholder="Telefon" className="input" />
              <textarea name="notes" placeholder="Bemerkung" className="input min-h-[60px]" />
              {disabled && (
                <label className="flex items-center gap-2 text-sm text-amber-700">
                  <input type="checkbox" name="force" value="true" />
                  Trotz voller Schicht eintragen (überschreitet die Kapazität)
                </label>
              )}
              {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-xl border-2 border-slate-300 px-4 py-2.5 font-semibold text-slate-700"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-xl bg-brand-600 px-4 py-2.5 font-bold text-white disabled:opacity-70"
                >
                  {pending ? "Speichern …" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
