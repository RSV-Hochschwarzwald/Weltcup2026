import { PublicShiftsBoard } from "@/components/PublicShiftsBoard";
import { getActiveEvent, getPublicShifts, getWaitlistEnabled } from "@/lib/publicData";
import { formatDateShort } from "@/lib/format";

export const revalidate = 0;

export default async function HomePage() {
  const [event, shifts, waitlistEnabled] = await Promise.all([
    getActiveEvent(),
    getPublicShifts(),
    getWaitlistEnabled(),
  ]);

  if (!event) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Die Helferanmeldung ist geschlossen.</h1>
        <p className="mt-3 text-slate-600">Vielen Dank für eure Unterstützung.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:pt-12">
      <header className="mb-8 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-brand-700">Weltcup Skispringen</p>
        <h1 className="mt-1 text-3xl font-extrabold text-slate-900 sm:text-4xl">Titisee-Neustadt</h1>
        <p className="mt-3 text-lg font-semibold text-slate-800">Helfereinteilung</p>
        <p className="text-slate-600">
          {formatDateShort(event.start_date)} – {formatDateShort(event.end_date)}
        </p>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          Vielen Dank für deine Unterstützung beim Weltcup Skispringen in Titisee-Neustadt. Wähle einfach die
          Schicht oder Schichten aus, bei denen du uns unterstützen kannst.
        </p>
      </header>

      <PublicShiftsBoard initialShifts={shifts} waitlistEnabled={waitlistEnabled} />

      <footer className="no-print mt-12 text-center text-xs text-slate-400">
        <a href="/datenschutz" className="underline">
          Datenschutz
        </a>
      </footer>
    </main>
  );
}
