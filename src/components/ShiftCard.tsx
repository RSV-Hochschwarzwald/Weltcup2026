"use client";

import { AvailabilityDots } from "@/components/AvailabilityDots";
import { getStatusLabel } from "@/lib/mapShift";
import { formatTimeRange } from "@/lib/format";
import type { PublicShift } from "@/types/database";

export function ShiftCard({
  shift,
  selected,
  onToggle,
  onJoinWaitlist,
}: {
  shift: PublicShift;
  selected: boolean;
  onToggle: (shiftId: string) => void;
  onJoinWaitlist?: (shiftId: string) => void;
}) {
  const statusLabel = getStatusLabel(shift);
  const disabled = !shift.isBookable;
  const isLastSpot = !shift.isFull && shift.availableCount === 1;

  return (
    <div
      className={`rounded-2xl border-2 p-4 shadow-card transition-colors sm:p-5 ${
        selected
          ? "border-brand-600 bg-brand-50"
          : disabled
            ? "border-slate-200 bg-slate-100"
            : isLastSpot
              ? "border-amber-400 bg-amber-50"
              : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-lg font-bold ${disabled ? "text-slate-400" : "text-slate-900"}`}>{shift.name}</p>
          <p className={`text-base ${disabled ? "text-slate-400" : "text-slate-700"}`}>
            {formatTimeRange(shift.startTime, shift.endTime)}
          </p>
        </div>
        <AvailabilityDots capacity={shift.capacity} activeCount={shift.activeCount} />
      </div>

      <p
        className={`mt-3 text-sm font-semibold ${
          disabled ? "text-slate-500" : isLastSpot ? "text-amber-700" : "text-emerald-700"
        }`}
      >
        {statusLabel}
      </p>

      {shift.isFull && shift.waitlistEnabled && onJoinWaitlist ? (
        <button
          type="button"
          onClick={() => onJoinWaitlist(shift.shiftId)}
          className="mt-3 w-full rounded-xl border-2 border-brand-600 bg-white px-4 py-3 text-base font-semibold text-brand-700 active:scale-[0.99]"
        >
          Auf Warteliste eintragen
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggle(shift.shiftId)}
          aria-pressed={selected}
          className={`mt-3 w-full rounded-xl px-4 py-3 text-base font-semibold active:scale-[0.99] ${
            disabled
              ? "cursor-not-allowed bg-slate-200 text-slate-400"
              : selected
                ? "bg-brand-700 text-white"
                : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {disabled ? "Voll belegt" : selected ? "Ausgewählt ✓" : "Schicht auswählen"}
        </button>
      )}
    </div>
  );
}
