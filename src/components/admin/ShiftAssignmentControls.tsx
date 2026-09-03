"use client";

import { useState, useTransition } from "react";
import { assignExistingHelperAction, moveRegistrationAction, setRegistrationNoteAction } from "@/app/admin/actions";
import { formatDateShort, formatTimeRange } from "@/lib/format";

interface ShiftOption {
  id: string;
  date: string;
  name: string;
  start_time: string;
  end_time: string;
}

function shiftLabel(s: ShiftOption): string {
  return `${formatDateShort(s.date)} · ${s.name} (${formatTimeRange(s.start_time, s.end_time)})`;
}

export function MoveRegistrationControl({
  registrationId,
  currentShiftId,
  shifts,
}: {
  registrationId: string;
  currentShiftId: string;
  shifts: ShiftOption[];
}) {
  const [target, setTarget] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const options = shifts.filter((s) => s.id !== currentShiftId);

  function submit() {
    if (!target) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await moveRegistrationAction(registrationId, target);
        setMessage("Verschoben.");
        setTarget("");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Verschieben fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
        <option value="">In andere Schicht verschieben …</option>
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {shiftLabel(s)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={!target || pending}
        className="rounded border border-brand-600 px-2 py-1 font-semibold text-brand-700 disabled:opacity-50"
      >
        Verschieben
      </button>
      {message && <span className="text-slate-500">{message}</span>}
    </div>
  );
}

export function RegistrationNoteEditor({ registrationId, initialNote }: { registrationId: string; initialNote: string }) {
  const [note, setNote] = useState(initialNote);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function submit() {
    setSaved(false);
    startTransition(async () => {
      await setRegistrationNoteAction(registrationId, note.trim());
      setSaved(true);
    });
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notiz für diese Schicht …"
        className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded border border-slate-400 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
      >
        Speichern
      </button>
      {saved && <span className="text-xs text-emerald-700">✓</span>}
    </div>
  );
}

export function AssignAdditionalShiftControl({ helperId, shifts }: { helperId: string; shifts: ShiftOption[] }) {
  const [target, setTarget] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    if (!target) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await assignExistingHelperAction(helperId, target);
        setMessage("Zugeordnet.");
        setTarget("");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Zuordnung fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={target} onChange={(e) => setTarget(e.target.value)} className="input max-w-xs">
        <option value="">Schicht auswählen …</option>
        {shifts.map((s) => (
          <option key={s.id} value={s.id}>
            {shiftLabel(s)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={!target || pending}
        className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
      >
        Weitere Schicht zuordnen
      </button>
      {message && <span className="text-sm text-slate-500">{message}</span>}
    </div>
  );
}
