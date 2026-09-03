# Architektur & Entscheidung

## Phase 1–3: Microsoft 365 vs. Supabase + GitHub

| Kriterium | Microsoft 365 / SharePoint Lists | Supabase + GitHub |
|---|---|---|
| Öffentlicher Link ohne Konto | Nur mit erheblichem Zusatzaufwand (SharePoint-Listen sind standardmäßig an ein M365-Konto/Entra-ID gebunden; ein wirklich anonymer, öffentlicher Schreibzugriff erfordert eine vorgeschaltete Power-Automate-/Power-Apps-Portal-Lösung) | Nativ: anon-Key + RLS + SECURITY DEFINER-Funktionen |
| Überbuchungsschutz bei Gleichzeitigkeit | SharePoint Lists haben kein transaktionssicheres Row-Locking; Power Automate-Flows laufen asynchron und sind für harte Kapazitätsgrenzen ungeeignet (Race Conditions praktisch nicht sicher vermeidbar) | PostgreSQL-Transaktion mit `SELECT … FOR UPDATE` – exakt und getestet (siehe `supabase/migrations/0003_functions.sql`) |
| Realtime-Aktualisierung für viele gleichzeitige Handynutzer | Nicht vorgesehen, nur Polling via Graph API praktikabel | Supabase Realtime (Broadcast from Database) nativ |
| Datenschutz / Row Level Security | Listen-Berechtigungen sind grob granular (Item-Level Permissions sind bei Skalierung fehleranfällig und schwer wartbar) | PostgreSQL RLS, feingranular pro Tabelle/View |
| Wartungsaufwand für ein Vereinsteam | Erfordert M365-Admin-Kenntnisse (Power Automate, Entra-App-Registrierung) | Ein Supabase-Projekt, SQL-Migrationen, Standard-Webhosting |
| Kosten | In der vorhandenen Lizenz enthalten, aber Power-Automate-Premium-Konnektoren ggf. kostenpflichtig | Supabase Free/Pro-Tier ausreichend für diese Veranstaltungsgröße |
| Excel-Integration | Nativ (Excel Online) | Eigener XLSX-Export (ExcelJS), bei Bedarf zusätzlich in OneDrive/SharePoint ablegbar |
| E-Mail-Integration | Nativ (Exchange Online), aber SMTP-Basic-Auth ist von Microsoft abgeschaltet → Versand nur noch über Graph API mit App-Registrierung + Admin-Consent | Externer Transaktions-E-Mail-Dienst (Resend), einfache API-Key-Konfiguration |

**Entscheidung (CLAUDE-Vorgabe Abschnitt 89 folgend):** Die öffentliche, kontofreie Live-Anmeldung mit hartem
Überbuchungsschutz bei echter Gleichzeitigkeit lässt sich mit SharePoint Lists nicht ohne unverhältnismäßigen
Zusatzaufwand und Restrisiko umsetzen. Es wird **Supabase + GitHub** verwendet (in der Vorgabe ausdrücklich ohne
weitere Rückfrage freigegeben).

Microsoft 365 bleibt optional nutzbar für:
- Weiterleitung der Benachrichtigungs-E-Mails an ein Vereins-Postfach (Outlook-Regel auf `ADMIN_NOTIFICATION_EMAIL`)
- Ablage des exportierten `Helferplan_Weltcup_2026.xlsx` in SharePoint/OneDrive (manuelles Hochladen des Admin-Exports)

## Technologie-Stack

- **Frontend/Backend:** Next.js 16 (App Router, TypeScript), Tailwind CSS
- **Datenbank/API/Auth/Realtime:** Supabase (PostgreSQL)
- **Repository/CI:** GitHub, automatisches Deployment via GitHub Actions
- **Hosting:** Cloudflare Workers über den OpenNext-Adapter (`@opennextjs/cloudflare`) – serverless, kein
  eigener Server nötig. Alternativ ohne Codeänderung auf Vercel deploybar (siehe README).
- **E-Mail:** Resend (alternativ: Microsoft 365 SMTP, siehe README)
- **Export:** ExcelJS (XLSX), eingebauter CSV-Writer

## Theme/Plugin- bzw. Schichten-Grenze

- **Datenbank (Supabase):** einzige Quelle der Wahrheit für Events, Schichten, Helfer, Anmeldungen. Sämtliche
  Kapazitätslogik lebt in PostgreSQL-Funktionen (`supabase/migrations/0003_functions.sql`), nicht im Frontend.
- **Next.js Server (API-Routen/Server Actions):** Validierung, Autorisierung (Admin-Rolle), E-Mail-Versand,
  Exporte. Nutzt für Helfer-Selfservice ausschließlich die SECURITY-DEFINER-RPCs (nie direkte Tabellenzugriffe
  mit dem Service-Role-Key für öffentliche Anfragen).
- **Frontend (React-Komponenten):** reine Darstellung + Interaktion. Enthält keine Kapazitäts- "Wahrheit" –
  jede Anzeige basiert auf Daten, die serverseitig/DB-seitig bereits geprüft wurden.

## Datenfluss einer Anmeldung

1. Browser lädt `shift_public_status` (öffentliche, aggregierte View) – keine PII.
2. Nutzer wählt Schichten, füllt Formular aus → `POST /api/register`.
3. API-Route validiert Eingaben (zod) und ruft `register_helper(...)` per RPC auf.
4. Die RPC sperrt die betroffenen `shifts`-Zeilen (`SELECT … FOR UPDATE`), zählt aktive Anmeldungen und
   entscheidet atomar: buchen, ablehnen oder (falls aktiviert) Warteliste.
5. Bei Erfolg: Bestätigungs-E-Mail an Helfer, Benachrichtigungs-E-Mail an Verein, ggf. "Schicht voll"-Hinweis.
6. Ein Datenbank-Trigger sendet den neuen, anonymisierten Belegungsstand per Realtime-Broadcast an alle
   verbundenen Browser (`shift-status`-Kanal) – andere Nutzer sehen die Änderung ohne Neuladen.

## Bekannte, bewusst in Kauf genommene Einschränkungen

- Der `uuid`-Paket-Hinweis in `npm audit` (moderate, transitive Abhängigkeit von `exceljs`) betrifft ausschließlich
  den internen XLSX-Schreibvorgang mit ausschließlich serverseitig erzeugten, nicht direkt nutzergesteuerten
  Werten – kein bekannter Ausnutzungspfad in diesem Anwendungsfall. Wird bei einem kompatiblen `exceljs`-Update
  ohne Breaking Change aktualisiert.
