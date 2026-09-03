import { config } from "@/lib/config";

export const metadata = { title: "Datenschutz" };

export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-slate-700">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Datenschutzerklärung</h1>

      <p className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
        [PLATZHALTER] Diese Seite ist technisch vorbereitet. Die folgenden Angaben müssen vor dem produktiven
        Einsatz durch {config.organizationName} inhaltlich final geprüft bzw. ergänzt werden.
      </p>

      <Section title="1. Verantwortlicher">
        <p>[PLATZHALTER: Name, Anschrift und Kontaktdaten des Vereins]</p>
        <p>{config.organizationName}</p>
      </Section>

      <Section title="2. Zweck der Datenverarbeitung">
        <p>
          Die im Rahmen dieser Helferanmeldung erhobenen Daten (Name, Kontaktdaten, ausgewählte Schichten,
          optionale Bemerkung) werden ausschließlich zur Organisation und Durchführung des Helfereinsatzes beim
          Weltcup Skispringen in Titisee-Neustadt verwendet.
        </p>
      </Section>

      <Section title="3. Speicherdauer">
        <p>
          [PLATZHALTER] Die Daten werden für die Dauer der Veranstaltungsvorbereitung und -durchführung
          gespeichert und nach Abschluss der Veranstaltung gelöscht bzw. anonymisiert, sofern keine gesetzliche
          Aufbewahrungspflicht entgegensteht.
        </p>
      </Section>

      <Section title="4. Verwendete Dienste">
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase (Datenbank/Hosting der Anmeldedaten)</li>
          <li>E-Mail-Versanddienst zur Bestätigung deiner Anmeldung</li>
          <li>[PLATZHALTER: ggf. Microsoft 365 für interne Ablage/Export]</li>
        </ul>
      </Section>

      <Section title="5. Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung deiner
          personenbezogenen Daten. Über deinen persönlichen Änderungslink kannst du deine Angaben jederzeit selbst
          einsehen, ändern oder deine Anmeldung absagen.
        </p>
      </Section>

      <Section title="6. Kontakt">
        <p>[PLATZHALTER: Kontakt für Datenschutzanfragen]</p>
        <p>{config.adminNotificationEmail || "[PLATZHALTER: E-Mail-Adresse]"}</p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-bold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
