"use client";

import { formatDateLong, formatTimeRange } from "@/lib/format";
import { getEditLink } from "@/lib/config";
import type { PublicShift } from "@/types/database";

export function SuccessScreen({
  bookedShifts,
  waitlistedShifts,
  editToken,
  onClose,
}: {
  bookedShifts: PublicShift[];
  waitlistedShifts: PublicShift[];
  editToken: string;
  onClose: () => void;
}) {
  const editLink = getEditLink(editToken);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
          ✓
        </div>
        <h2 className="text-xl font-bold text-slate-900">Vielen Dank für deine Unterstützung!</h2>
        <p className="mt-2 text-slate-600">Deine Anmeldung wurde erfolgreich gespeichert.</p>

        {bookedShifts.length > 0 && (
          <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-left">
            <p className="text-sm font-semibold text-slate-700">Deine Helfereinsätze:</p>
            {bookedShifts.map((s) => (
              <p key={s.shiftId} className="text-sm text-slate-700">
                <span className="font-semibold">{formatDateLong(s.date)}</span>
                <br />
                {s.name}, {formatTimeRange(s.startTime, s.endTime)}
              </p>
            ))}
          </div>
        )}

        {waitlistedShifts.length > 0 && (
          <div className="mt-4 space-y-2 rounded-xl bg-amber-50 p-4 text-left">
            <p className="text-sm font-semibold text-amber-800">Auf der Warteliste für:</p>
            {waitlistedShifts.map((s) => (
              <p key={s.shiftId} className="text-sm text-amber-800">
                {formatDateLong(s.date)} – {s.name}, {formatTimeRange(s.startTime, s.endTime)}
              </p>
            ))}
          </div>
        )}

        <p className="mt-5 text-sm text-slate-600">
          Wir freuen uns auf deine Unterstützung beim Weltcup Skispringen in Titisee-Neustadt.
        </p>

        <div className="mt-5 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 p-4 text-left">
          <p className="text-sm font-semibold text-brand-800">Dein persönlicher Änderungslink:</p>
          <p className="mt-1 break-all text-sm text-brand-700">{editLink}</p>
          <p className="mt-2 text-xs text-brand-700">
            Speichere diesen Link – damit kannst du deine Anmeldung später ansehen, ändern oder absagen.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-4 font-bold text-white active:scale-[0.99]"
        >
          Fertig
        </button>
      </div>
    </div>
  );
}
