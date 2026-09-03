import Link from "next/link";
import { getActiveEventAdmin, getShiftsWithRegistrations, type ShiftWithRegistrations } from "@/lib/adminData";
import { formatDateShort, formatTimeRange, formatWeekday } from "@/lib/format";
import { getCurrentAdmin } from "@/lib/auth";
import { AddHelperDialog } from "@/components/admin/AddHelperDialog";
import { CancelRegistrationButton, LockShiftToggle, PromoteWaitlistButton } from "@/components/admin/RosterControls";

export const revalidate = 0;

function overlapLabel(s1: ShiftWithRegistrations, s2: ShiftWithRegistrations): string {
  const start = s1.start_time > s2.start_time ? s1.start_time : s2.start_time;
  const end = s1.end_time < s2.end_time ? s1.end_time : s2.end_time;
  return formatTimeRange(start, end);
}

export default async function AdminHelferPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q = "", tag = "alle" } = await searchParams;
  const admin = await getCurrentAdmin();
  const event = await getActiveEventAdmin();
  if (!event) return <p>Kein aktives Event gefunden.</p>;

  const shifts = await getShiftsWithRegistrations(event.id);

  const query = q.trim().toLowerCase();
  const matches = (name: string, phone: string | null, email: string | null) =>
    !query ||
    name.toLowerCase().includes(query) ||
    (phone ?? "").toLowerCase().includes(query) ||
    (email ?? "").toLowerCase().includes(query);

  const dayKeyOf = (date: string) => formatWeekday(date).toLowerCase();
  const filteredShifts = shifts.filter((s) => tag === "alle" || dayKeyOf(s.date) === tag);

  const byDate = new Map<string, ShiftWithRegistrations[]>();
  for (const s of filteredShifts) {
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Helfer &amp; Schichten</h1>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/export/csv" className="rounded-lg border-2 border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            CSV exportieren
          </a>
          <a href="/api/admin/export/xlsx" className="rounded-lg border-2 border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            Excel exportieren
          </a>
          <Link href="/admin/druck" className="rounded-lg border-2 border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            Druckansicht
          </Link>
        </div>
      </div>

      <form method="get" className="flex flex-wrap gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Suche nach Name, Telefon, E-Mail …"
          className="input max-w-xs"
        />
        <select name="tag" defaultValue={tag} className="input max-w-[160px]">
          <option value="alle">Alle Tage</option>
          <option value="freitag">Freitag</option>
          <option value="samstag">Samstag</option>
          <option value="sonntag">Sonntag</option>
        </select>
        <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          Filtern
        </button>
      </form>

      {[...byDate.entries()].map(([date, dayShifts]) => {
        const [shift1, shift2] = dayShifts;
        return (
          <section key={date} className="rounded-2xl bg-white p-4 shadow-card sm:p-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              {formatWeekday(date)}, {formatDateShort(date)}
            </h2>

            {shift1 && <ShiftBlock shift={shift1} query={query} matches={matches} canEdit={admin?.role === "admin"} />}

            {shift1 && shift2 && (
              <div className="my-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-800">
                ÜBERGABE · {overlapLabel(shift1, shift2)}
              </div>
            )}

            {shift2 && <ShiftBlock shift={shift2} query={query} matches={matches} canEdit={admin?.role === "admin"} />}
          </section>
        );
      })}
    </div>
  );
}

function ShiftBlock({
  shift,
  query,
  matches,
  canEdit,
}: {
  shift: ShiftWithRegistrations;
  query: string;
  matches: (name: string, phone: string | null, email: string | null) => boolean;
  canEdit: boolean;
}) {
  const active = shift.registrations.filter((r) => r.status === "active");
  const waitlist = shift.registrations.filter((r) => r.status === "waitlist");
  const visibleActive = query ? active.filter((r) => matches(`${r.helper.first_name} ${r.helper.last_name}`, r.helper.phone, r.helper.email)) : active;
  const isFull = active.length >= shift.capacity;

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">
            {shift.name} · {formatTimeRange(shift.start_time, shift.end_time)}
          </p>
          <p className="text-sm text-slate-500">
            {active.length} / {shift.capacity} belegt
            {shift.manually_locked && <span className="ml-2 font-semibold text-amber-700">· Manuell gesperrt</span>}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <LockShiftToggle shiftId={shift.id} locked={shift.manually_locked} />
            <AddHelperDialog shiftId={shift.id} shiftLabel={`${shift.name} · ${formatTimeRange(shift.start_time, shift.end_time)}`} disabled={isFull} />
          </div>
        )}
      </div>

      <ol className="space-y-1.5">
        {visibleActive.map((r, i) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <Link href={`/admin/helfer/${r.helper.id}`} className="font-medium text-slate-800 hover:underline">
              {i + 1}. {r.helper.first_name} {r.helper.last_name}
            </Link>
            {canEdit && <CancelRegistrationButton registrationId={r.id} />}
          </li>
        ))}
        {visibleActive.length === 0 && <li className="text-sm text-slate-400">Noch keine Helfer eingetragen.</li>}
      </ol>

      {waitlist.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3">
          <p className="mb-1 text-xs font-bold uppercase text-amber-700">Warteliste ({waitlist.length})</p>
          <ol className="space-y-1">
            {waitlist.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm text-amber-800">
                <span>
                  {r.helper.first_name} {r.helper.last_name}
                </span>
                {canEdit && <PromoteWaitlistButton registrationId={r.id} />}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
