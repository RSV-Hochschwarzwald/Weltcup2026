"use client";

import { useTransition } from "react";
import { cancelRegistrationAdminAction, promoteWaitlistAction, setShiftLockAction } from "@/app/admin/actions";

export function CancelRegistrationButton({ registrationId }: { registrationId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Diesen Helfer aus der Schicht entfernen?")) return;
        startTransition(() => cancelRegistrationAdminAction(registrationId));
      }}
      className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
    >
      Entfernen
    </button>
  );
}

export function PromoteWaitlistButton({ registrationId }: { registrationId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => promoteWaitlistAction(registrationId))}
      className="text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
    >
      Nachrücken lassen
    </button>
  );
}

export function LockShiftToggle({ shiftId, locked }: { shiftId: string; locked: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setShiftLockAction(shiftId, !locked))}
      className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
        locked ? "border-emerald-600 text-emerald-700" : "border-amber-600 text-amber-700"
      }`}
    >
      {locked ? "Schicht öffnen" : "Schicht sperren"}
    </button>
  );
}
