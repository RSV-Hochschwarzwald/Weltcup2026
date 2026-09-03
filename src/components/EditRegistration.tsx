"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateLong, formatTimeRange } from "@/lib/format";
import { mapPublicShift } from "@/lib/mapShift";
import type { PublicShift, ShiftPublicStatus, TokenHelperInfo, TokenRegistrationEntry } from "@/types/database";

export function EditRegistration({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [helper, setHelper] = useState<TokenHelperInfo | null>(null);
  const [registrations, setRegistrations] = useState<TokenRegistrationEntry[]>([]);
  const [availableShifts, setAvailableShifts] = useState<PublicShift[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/registration/${token}`, { cache: "no-store" });
    if (!res.ok) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setHelper(data.helper);
    setRegistrations(data.registrations ?? []);
    setLoading(false);
  }, [token]);

  const loadAvailableShifts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("shift_public_status").select("*").order("sort_order", { ascending: true });
    if (data) {
      setAvailableShifts((data as ShiftPublicStatus[]).map((s) => mapPublicShift(s, false)));
    }
  }, []);

  useEffect(() => {
    // Erstladen der Anmeldedaten beim Öffnen des persönlichen Links.
    void (async () => {
      await Promise.all([load(), loadAvailableShifts()]);
    })();
  }, [load, loadAvailableShifts]);

  async function saveContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!helper) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/registration/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: helper.first_name,
        lastName: helper.last_name,
        email: helper.email ?? "",
        phone: helper.phone ?? "",
        notes: helper.notes ?? "",
      }),
    });
    const data = await res.json();
    setSaving(false);
    setMessage(data.success ? "Deine Angaben wurden gespeichert." : data.message ?? "Speichern fehlgeschlagen.");
  }

  async function cancelRegistration(registrationId: string) {
    if (!confirm("Möchtest du diese Schicht wirklich absagen?")) return;
    setCancellingId(registrationId);
    const res = await fetch(`/api/registration/${token}/shifts/${registrationId}`, { method: "DELETE" });
    setCancellingId(null);
    if (res.ok) {
      await load();
      await loadAvailableShifts();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.message ?? "Absage fehlgeschlagen.");
    }
  }

  async function addShift(shiftId: string) {
    setMessage(null);
    const res = await fetch(`/api/registration/${token}/shifts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId }),
    });
    const data = await res.json();
    if (data.success) {
      await load();
      await loadAvailableShifts();
    } else {
      setMessage(data.message ?? "Schicht konnte nicht hinzugefügt werden.");
    }
  }

  if (loading) {
    return <p className="text-center text-slate-500">Lade deine Anmeldung …</p>;
  }

  if (notFound || !helper) {
    return (
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-800">Dieser Link ist ungültig oder abgelaufen.</p>
      </div>
    );
  }

  const activeRegistrations = registrations.filter((r) => r.status !== "cancelled");
  const bookedShiftIds = new Set(activeRegistrations.map((r) => r.shift_id));
  const addableShifts = availableShifts.filter((s) => s.isBookable && !bookedShiftIds.has(s.shiftId));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Deine Helferanmeldung</h1>
        <p className="text-slate-600">
          {helper.first_name} {helper.last_name}
        </p>
      </header>

      {message && <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{message}</p>}

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Deine Schichten</h2>
        {activeRegistrations.length === 0 && <p className="text-slate-600">Aktuell keine Schichten gebucht.</p>}
        <ul className="space-y-3">
          {activeRegistrations.map((r) => (
            <li key={r.registration_id} className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <div>
                <p className="font-semibold text-slate-800">{formatDateLong(r.date)}</p>
                <p className="text-sm text-slate-600">
                  {r.name}, {formatTimeRange(r.start_time, r.end_time)}
                  {r.status === "waitlist" && <span className="ml-2 text-amber-700">(Warteliste)</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => cancelRegistration(r.registration_id)}
                disabled={cancellingId === r.registration_id}
                className="rounded-lg border-2 border-red-300 px-3 py-2 text-sm font-semibold text-red-700"
              >
                {cancellingId === r.registration_id ? "…" : "Absagen"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {addableShifts.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-slate-900">Weitere Schicht hinzufügen</h2>
          <ul className="space-y-3">
            {addableShifts.map((s) => (
              <li key={s.shiftId} className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="font-semibold text-slate-800">{formatDateLong(s.date)}</p>
                  <p className="text-sm text-slate-600">
                    {s.name}, {formatTimeRange(s.startTime, s.endTime)} · {s.availableCount} frei
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addShift(s.shiftId)}
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
                >
                  Hinzufügen
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Kontaktdaten</h2>
        <form onSubmit={saveContact} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              value={helper.first_name}
              onChange={(e) => setHelper({ ...helper, first_name: e.target.value })}
              placeholder="Vorname"
            />
            <input
              className="input"
              value={helper.last_name}
              onChange={(e) => setHelper({ ...helper, last_name: e.target.value })}
              placeholder="Nachname"
            />
          </div>
          <input
            className="input"
            type="email"
            value={helper.email ?? ""}
            onChange={(e) => setHelper({ ...helper, email: e.target.value })}
            placeholder="E-Mail-Adresse"
          />
          <input
            className="input"
            type="tel"
            value={helper.phone ?? ""}
            onChange={(e) => setHelper({ ...helper, phone: e.target.value })}
            placeholder="Telefon"
          />
          <textarea
            className="input min-h-[80px]"
            value={helper.notes ?? ""}
            onChange={(e) => setHelper({ ...helper, notes: e.target.value })}
            placeholder="Bemerkung (optional)"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 font-bold text-white disabled:opacity-70"
          >
            {saving ? "Wird gespeichert …" : "Speichern"}
          </button>
        </form>
      </section>
    </div>
  );
}
