import Link from "next/link";
import { getActiveEventAdmin, getShiftsWithRegistrations } from "@/lib/adminData";
import { formatDateShort, formatTimeRange, formatWeekday } from "@/lib/format";

export const revalidate = 0;

export default async function AdminDashboardPage() {
  const event = await getActiveEventAdmin();
  if (!event) {
    return <p className="text-slate-600">Kein aktives Event gefunden.</p>;
  }

  const shifts = await getShiftsWithRegistrations(event.id);
  const totalCapacity = shifts.reduce((sum, s) => sum + s.capacity, 0);
  const totalActive = shifts.reduce(
    (sum, s) => sum + s.registrations.filter((r) => r.status === "active").length,
    0
  );

  const byDate = new Map<string, typeof shifts>();
  for (const s of shifts) {
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{event.title}</h1>
        <p className="text-slate-600">Helfereinteilung – Übersicht</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Helferplätze insgesamt" value={totalCapacity} />
        <StatCard label="Belegt" value={totalActive} tone="brand" />
        <StatCard label="Frei" value={totalCapacity - totalActive} tone="emerald" />
      </div>

      <div className="space-y-6">
        {[...byDate.entries()].map(([date, dayShifts]) => (
          <div key={date} className="rounded-2xl bg-white p-4 shadow-card">
            <p className="mb-3 font-bold text-slate-900">
              {formatWeekday(date)}, {formatDateShort(date)}
            </p>
            <div className="space-y-2">
              {dayShifts.map((s) => {
                const active = s.registrations.filter((r) => r.status === "active").length;
                const full = active >= s.capacity;
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {s.name} · {formatTimeRange(s.start_time, s.end_time)}
                      </p>
                      {s.manually_locked && <p className="text-xs font-semibold text-amber-700">Manuell gesperrt</p>}
                    </div>
                    <span className={`font-bold ${full ? "text-red-600" : "text-emerald-700"}`}>
                      {active} / {s.capacity}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/admin/helfer"
        className="inline-block rounded-xl bg-brand-600 px-5 py-3 font-bold text-white"
      >
        Alle Helfer ansehen →
      </Link>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "brand" | "emerald" }) {
  const color = tone === "brand" ? "text-brand-700" : tone === "emerald" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-2xl bg-white p-5 text-center shadow-card">
      <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </div>
  );
}
