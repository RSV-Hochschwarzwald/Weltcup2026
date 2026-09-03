import { notFound } from "next/navigation";
import { getActiveEventAdmin, getAllShiftsAdmin, getHelperByIdAdmin } from "@/lib/adminData";
import { formatDateLong, formatDateTimeDe, formatTimeRange } from "@/lib/format";
import { getCurrentAdmin } from "@/lib/auth";
import { HelperEditForm } from "@/components/admin/HelperEditForm";
import {
  AssignAdditionalShiftControl,
  MoveRegistrationControl,
  RegistrationNoteEditor,
} from "@/components/admin/ShiftAssignmentControls";

export const revalidate = 0;

export default async function HelperDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getCurrentAdmin();
  const helper = await getHelperByIdAdmin(id);
  if (!helper) notFound();

  const event = await getActiveEventAdmin();
  const allShifts = event ? await getAllShiftsAdmin(event.id) : [];

  const activeRegs = helper.registrations.filter((r) => r.status !== "cancelled");
  const cancelledRegs = helper.registrations.filter((r) => r.status === "cancelled");
  const bookedShiftIds = new Set(activeRegs.map((r) => r.shift_id));
  const assignableShifts = allShifts.filter((s) => !bookedShiftIds.has(s.id));

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">
        {helper.first_name} {helper.last_name}
      </h1>

      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="mb-3 font-bold text-slate-900">Gebuchte Schichten</h2>
        <ul className="space-y-2">
          {activeRegs.map((r) => (
            <li key={r.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-800">
                {formatDateLong(r.shift.date)} – {r.shift.name}
              </p>
              <p className="text-slate-600">
                {formatTimeRange(r.shift.start_time, r.shift.end_time)}
                {r.status === "waitlist" && <span className="ml-2 font-semibold text-amber-700">(Warteliste)</span>}
              </p>
              {admin?.role === "admin" ? (
                <>
                  <RegistrationNoteEditor registrationId={r.id} initialNote={r.admin_note ?? ""} />
                  <MoveRegistrationControl registrationId={r.id} currentShiftId={r.shift_id} shifts={allShifts} />
                </>
              ) : (
                r.admin_note && <p className="mt-1 text-xs text-slate-500">Notiz: {r.admin_note}</p>
              )}
            </li>
          ))}
          {activeRegs.length === 0 && <p className="text-sm text-slate-400">Keine aktiven Schichten.</p>}
        </ul>

        {admin?.role === "admin" && assignableShifts.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Weitere Schicht zuordnen</p>
            <AssignAdditionalShiftControl helperId={helper.id} shifts={assignableShifts} />
          </div>
        )}

        {cancelledRegs.length > 0 && (
          <details className="mt-4 text-sm text-slate-500">
            <summary className="cursor-pointer font-semibold">Abgesagte Schichten ({cancelledRegs.length})</summary>
            <ul className="mt-2 space-y-1">
              {cancelledRegs.map((r) => (
                <li key={r.id}>
                  {formatDateLong(r.shift.date)} – {r.shift.name}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="mb-3 font-bold text-slate-900">Kontaktdaten</h2>
        {admin?.role === "admin" ? (
          <HelperEditForm helper={helper} />
        ) : (
          <dl className="space-y-2 text-sm">
            <Row label="Telefon" value={helper.phone} />
            <Row label="E-Mail" value={helper.email} />
            <Row label="Bemerkung" value={helper.notes} />
          </dl>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-card">
        <p>Angemeldet am: {formatDateTimeDe(helper.created_at)} Uhr</p>
        <p>Letzte Änderung: {formatDateTimeDe(helper.updated_at)} Uhr</p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value || "–"}</dd>
    </div>
  );
}
