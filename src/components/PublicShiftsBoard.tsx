"use client";

import { useMemo, useState } from "react";
import { ShiftCard } from "@/components/ShiftCard";
import { RegistrationDialog } from "@/components/RegistrationDialog";
import { SuccessScreen } from "@/components/SuccessScreen";
import { useLiveShiftStatus } from "@/hooks/useLiveShiftStatus";
import { formatDateLong } from "@/lib/format";
import { groupByDate, mapPublicShift } from "@/lib/mapShift";
import type { PublicShift, ShiftPublicStatus } from "@/types/database";

export function PublicShiftsBoard({
  initialShifts,
  waitlistEnabled,
}: {
  initialShifts: ShiftPublicStatus[];
  waitlistEnabled: boolean;
}) {
  const { shifts: liveShifts, connectionError, refetch } = useLiveShiftStatus(initialShifts);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [waitlistShiftId, setWaitlistShiftId] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    editToken: string;
    bookedShiftIds: string[];
    waitlistedShiftIds: string[];
  } | null>(null);

  const mappedShifts = useMemo(
    () => liveShifts.map((s) => mapPublicShift(s, waitlistEnabled)),
    [liveShifts, waitlistEnabled]
  );
  const byDate = useMemo(() => groupByDate(mappedShifts), [mappedShifts]);
  const shiftsById = useMemo(() => new Map(mappedShifts.map((s) => [s.shiftId, s])), [mappedShifts]);

  function toggleShift(shiftId: string) {
    setSelectedIds((prev) => (prev.includes(shiftId) ? prev.filter((id) => id !== shiftId) : [...prev, shiftId]));
  }

  function openWaitlistDialog(shiftId: string) {
    setWaitlistShiftId(shiftId);
    setDialogOpen(true);
  }

  const dialogShifts: PublicShift[] = useMemo(() => {
    if (waitlistShiftId) {
      const s = shiftsById.get(waitlistShiftId);
      return s ? [s] : [];
    }
    return selectedIds.map((id) => shiftsById.get(id)).filter((s): s is PublicShift => Boolean(s));
  }, [waitlistShiftId, selectedIds, shiftsById]);

  function closeDialog() {
    setDialogOpen(false);
    setWaitlistShiftId(null);
  }

  const bookedShifts = successResult
    ? mappedShifts.filter((s) => successResult.bookedShiftIds.includes(s.shiftId))
    : [];
  const waitlistedShifts = successResult
    ? mappedShifts.filter((s) => successResult.waitlistedShiftIds.includes(s.shiftId))
    : [];

  if (connectionError && mappedShifts.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-800">
          Die Helferplätze konnten gerade nicht geladen werden. Bitte überprüfe deine Internetverbindung und
          versuche es erneut.
        </p>
        <button
          type="button"
          onClick={refetch}
          className="mt-4 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="space-y-8">
        {[...byDate.entries()].map(([date, dayShifts]) => (
          <section key={date}>
            <div className="mb-3 border-b-4 border-brand-600 pb-1">
              <p className="text-sm font-bold uppercase tracking-wide text-brand-700">{dayShifts[0]?.dayLabel}</p>
              <p className="text-lg font-bold text-slate-900">{formatDateLong(date).split(", ")[1]}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {dayShifts.map((shift) => (
                <ShiftCard
                  key={shift.shiftId}
                  shift={shift}
                  selected={selectedIds.includes(shift.shiftId)}
                  onToggle={toggleShift}
                  onJoinWaitlist={openWaitlistDialog}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {selectedIds.length > 0 && !dialogOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <p className="font-semibold text-slate-800">
              {selectedIds.length} {selectedIds.length === 1 ? "Schicht" : "Schichten"} ausgewählt
            </p>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="rounded-xl bg-brand-600 px-6 py-3 font-bold text-white active:scale-[0.99]"
            >
              Weiter zur Anmeldung
            </button>
          </div>
        </div>
      )}

      {dialogOpen && dialogShifts.length > 0 && (
        <RegistrationDialog
          shifts={dialogShifts}
          onClose={closeDialog}
          onSuccess={(result) => {
            setDialogOpen(false);
            setWaitlistShiftId(null);
            setSelectedIds([]);
            setSuccessResult(result);
            refetch();
          }}
        />
      )}

      {successResult && (
        <SuccessScreen
          bookedShifts={bookedShifts}
          waitlistedShifts={waitlistedShifts}
          editToken={successResult.editToken}
          onClose={() => setSuccessResult(null)}
        />
      )}
    </div>
  );
}
