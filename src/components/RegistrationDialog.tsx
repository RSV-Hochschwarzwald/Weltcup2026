"use client";

import { useMemo, useState } from "react";
import { formatDateLong, formatTimeRange } from "@/lib/format";
import { config } from "@/lib/config";
import type { PublicShift } from "@/types/database";

type Step = "form" | "confirm" | "error";

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyForm: FormState = { firstName: "", lastName: "", email: "", phone: "", notes: "" };

export function RegistrationDialog({
  shifts,
  onClose,
  onSuccess,
}: {
  shifts: PublicShift[];
  onClose: () => void;
  onSuccess: (result: { editToken: string; bookedShiftIds: string[]; waitlistedShiftIds: string[] }) => void;
}) {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const contactValid = form.email.trim().length > 0 || form.phone.trim().length > 0;
  const namesValid = form.firstName.trim().length > 0 && form.lastName.trim().length > 0;
  const canContinue = namesValid && contactValid;

  const sortedShifts = useMemo(
    () => [...shifts].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [shifts]
  );

  async function submit() {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim(),
          shiftIds: sortedShifts.map((s) => s.shiftId),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message ?? "Deine Anmeldung konnte leider nicht gespeichert werden. Bitte versuche es erneut.");
        setStep("error");
        return;
      }

      onSuccess({
        editToken: data.editToken,
        bookedShiftIds: data.bookedShiftIds ?? [],
        waitlistedShiftIds: data.waitlistedShiftIds ?? [],
      });
    } catch {
      setErrorMessage("Die Verbindung ist fehlgeschlagen. Bitte überprüfe deine Internetverbindung und versuche es erneut.");
      setStep("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Helferanmeldung</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {step === "form" && (
          <FormStep
            form={form}
            setForm={setForm}
            shifts={sortedShifts}
            canContinue={canContinue}
            onContinue={() => setStep("confirm")}
          />
        )}

        {step === "confirm" && (
          <ConfirmStep
            form={form}
            shifts={sortedShifts}
            submitting={submitting}
            onBack={() => setStep("form")}
            onConfirm={submit}
          />
        )}

        {step === "error" && (
          <div className="space-y-4">
            <p className="rounded-xl bg-red-50 p-4 text-red-800">{errorMessage}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 font-semibold text-slate-700"
              >
                Zurück
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-slate-800 px-4 py-3 font-semibold text-white"
              >
                Schließen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormStep({
  form,
  setForm,
  shifts,
  canContinue,
  onContinue,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  shifts: PublicShift[];
  canContinue: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <ShiftSummaryList shifts={shifts} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Vorname *">
          <input
            className="input"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Nachname *">
          <input
            className="input"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            autoComplete="family-name"
          />
        </Field>
      </div>

      <Field label="E-Mail-Adresse">
        <input
          type="email"
          className="input"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="email"
          inputMode="email"
        />
      </Field>

      <Field label="Telefon / Handynummer">
        <input
          type="tel"
          className="input"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          autoComplete="tel"
          inputMode="tel"
        />
      </Field>

      <p className="text-sm text-slate-500">Bitte gib mindestens eine E-Mail-Adresse oder eine Telefonnummer an.</p>

      <Field label="Bemerkung (optional)">
        <textarea
          className="input min-h-[80px]"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>

      <PrivacyNotice />

      <button
        type="button"
        disabled={!canContinue}
        onClick={onContinue}
        className={`w-full rounded-xl px-4 py-4 text-base font-bold ${
          canContinue ? "bg-brand-600 text-white active:scale-[0.99]" : "cursor-not-allowed bg-slate-200 text-slate-400"
        }`}
      >
        Weiter zur Übersicht
      </button>
    </div>
  );
}

function ConfirmStep({
  form,
  shifts,
  submitting,
  onBack,
  onConfirm,
}: {
  form: FormState;
  shifts: PublicShift[];
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="font-semibold text-slate-800">Deine Helfereinsätze:</p>
      <ShiftSummaryList shifts={shifts} />

      <div className="rounded-xl bg-slate-50 p-4">
        <p className="font-semibold text-slate-800">
          {form.firstName} {form.lastName}
        </p>
        {form.email && <p className="text-sm text-slate-600">{form.email}</p>}
        {form.phone && <p className="text-sm text-slate-600">{form.phone}</p>}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="w-full rounded-xl border-2 border-slate-300 px-4 py-4 font-semibold text-slate-700"
        >
          Zurück
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="w-full rounded-xl bg-brand-600 px-4 py-4 font-bold text-white active:scale-[0.99] disabled:opacity-70"
        >
          {submitting ? "Anmeldung wird gespeichert …" : "Verbindlich anmelden"}
        </button>
      </div>
    </div>
  );
}

function ShiftSummaryList({ shifts }: { shifts: PublicShift[] }) {
  return (
    <ul className="space-y-2 rounded-xl bg-slate-50 p-4">
      {shifts.map((s) => (
        <li key={s.shiftId} className="text-sm">
          <span className="font-semibold text-slate-800">{formatDateLong(s.date)}</span>
          <br />
          <span className="text-slate-600">
            {s.name}, {formatTimeRange(s.startTime, s.endTime)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function PrivacyNotice() {
  return (
    <p className="text-xs leading-relaxed text-slate-500">
      Deine Daten werden ausschließlich zur Organisation des Helfereinsatzes bei {config.eventName}
      verwendet. Weitere Informationen findest du in unserer{" "}
      <a href="/datenschutz" target="_blank" rel="noreferrer" className="underline">
        Datenschutzerklärung
      </a>
      .
    </p>
  );
}
