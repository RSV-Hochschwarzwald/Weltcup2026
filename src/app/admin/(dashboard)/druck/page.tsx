import { getActiveEventAdmin, getShiftsWithRegistrations, type ShiftWithRegistrations } from "@/lib/adminData";
import { formatDateShort, formatTimeRange, formatWeekday } from "@/lib/format";
import { PrintButton } from "@/components/admin/PrintButton";

export const revalidate = 0;

export default async function AdminDruckPage() {
  const event = await getActiveEventAdmin();
  if (!event) return <p>Kein aktives Event.</p>;

  const shifts = await getShiftsWithRegistrations(event.id);
  const byDate = new Map<string, ShiftWithRegistrations[]>();
  for (const s of shifts) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-6 print:p-0">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <h1 className="text-center text-2xl font-bold">{event.title}</h1>
      <p className="mb-6 text-center text-lg">Helferplan</p>

      {[...byDate.entries()].map(([date, dayShifts]) => (
        <div key={date} className="mb-8 break-inside-avoid">
          <h2 className="border-b-2 border-black pb-1 text-lg font-bold">
            {formatWeekday(date)}, {formatDateShort(date)}
          </h2>
          {dayShifts.map((shift) => {
            const active = shift.registrations.filter((r) => r.status === "active");
            return (
              <div key={shift.id} className="mt-3">
                <p className="font-semibold">
                  {shift.name} · {formatTimeRange(shift.start_time, shift.end_time)}
                </p>
                <ol className="ml-5 list-decimal">
                  {Array.from({ length: shift.capacity }, (_, i) => (
                    <li key={i}>
                      {active[i] ? `${active[i].helper.first_name} ${active[i].helper.last_name}` : "—"}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
