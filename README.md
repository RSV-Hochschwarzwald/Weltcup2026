# Helfereinteilung – Weltcup Skispringen Titisee-Neustadt 2026

Öffentliche, kontofreie Helferanmeldung für den Weltcup Skispringen Titisee-Neustadt (11.–13.12.2026),
RSV Hochschwarzwald e.V. Mobil optimiert, mit sicherem Überbuchungsschutz, Admin-Bereich, E-Mail-
Benachrichtigungen sowie CSV-/Excel-Export.

Architekturentscheidung (Microsoft 365 vs. Supabase) und Begründung: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Inhalt

- [Technik](#technik)
- [Lokale Installation](#lokale-installation)
- [Environment Variables](#environment-variables)
- [Supabase-Einrichtung](#supabase-einrichtung)
- [Admin-Konto anlegen](#admin-konto-anlegen)
- [E-Mail-Konfiguration](#e-mail-konfiguration)
- [Deployment](#deployment)
- [Supabase Keep-Alive (Free-Tier)](#supabase-keep-alive-free-tier)
- [Tests](#tests)
- [Backup](#backup)
- [Excel-/CSV-Export](#excel-csv-export)
- [Microsoft-365-Integration](#microsoft-365-integration-optional)
- [Neue Veranstaltung einrichten](#neue-veranstaltung-einrichten)
- [Projektstruktur](#projektstruktur)

## Technik

- **Next.js 16** (App Router, TypeScript, Server Actions)
- **Supabase** (PostgreSQL, Auth, Realtime, Row Level Security)
- **Tailwind CSS**
- **ExcelJS** (XLSX-Export), eingebauter CSV-Export
- **Resend** (Transaktions-E-Mails), alternativ Microsoft-365-SMTP
- **Hosting:** Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`),
  automatisches Deployment über GitHub Actions bei jedem Push auf `main`

## Lokale Installation

Voraussetzungen: Node.js ≥ 18.18, ein Supabase-Projekt (siehe unten).

```bash
npm install
cp .env.example .env.local
# .env.local mit den Werten aus dem Supabase-Projekt befüllen
npm run dev
```

Anwendung läuft danach unter `http://localhost:3000`, Adminbereich unter `http://localhost:3000/admin`.

## Environment Variables

Siehe [.env.example](.env.example) für die vollständige Liste. Wichtig:

| Variable | Sichtbarkeit | Zweck |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | öffentlich | Frontend-Zugriff, vollständig RLS-beschränkt |
| `SUPABASE_SERVICE_ROLE_KEY` | **geheim, nur Server** | Admin-Operationen, umgeht RLS – niemals im Frontend |
| `RESEND_API_KEY`, `EMAIL_FROM` | Server | Bestätigungs-/Benachrichtigungs-E-Mails |
| `ADMIN_NOTIFICATION_EMAIL` | Server | Empfänger für neue Anmeldungen/Absagen |
| `NEXT_PUBLIC_APP_URL` | öffentlich | Basis-URL für Änderungslinks in E-Mails |
| `WAITLIST_ENABLED` u. a. Flags | – | siehe Admin-Einstellungen; steuerbar auch direkt in der `settings`-Tabelle |

## Supabase-Einrichtung

1. Neues Projekt auf [supabase.com](https://supabase.com) anlegen (Region: Frankfurt (`eu-central-1`) empfohlen).
2. Projekt-URL und `anon`-Key aus **Project Settings → API** in `.env.local` eintragen.
3. Den `service_role`-Key ebenfalls aus **Project Settings → API** entnehmen – **niemals** in `.env.example`
   oder Git, nur in `.env.local` bzw. als verschlüsselte Variable beim Hosting-Anbieter.
4. Migrationen einspielen (empfohlen: [Supabase CLI](https://supabase.com/docs/guides/cli)):

   ```bash
   npx supabase login
   npx supabase link --project-ref <dein-projekt-ref>
   npx supabase db push
   ```

   Alternativ die Dateien aus `supabase/migrations/` in der angegebenen Reihenfolge (0001 → 0004) im
   Supabase-Dashboard unter **SQL Editor** manuell ausführen.
5. Seed-Daten laden (Event + 6 Schichten für den Weltcup 2026):

   ```bash
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```

   oder den Inhalt von `supabase/seed.sql` im SQL Editor ausführen.
6. Realtime: **Broadcast from Database** ist Teil der Migration `0004_realtime.sql` und benötigt keine
   zusätzliche manuelle Konfiguration auf aktuellen Supabase-Projekten.

## Admin-Konto anlegen

Es gibt bewusst **keine öffentliche Registrierung**. Vorgehen:

1. Supabase-Dashboard → **Authentication → Users → Add user** (E-Mail + Passwort setzen, „Auto Confirm" aktivieren).
2. Im SQL Editor die Rolle vergeben (ersetze `<user-id>` durch die eben erzeugte User-ID):

   ```sql
   insert into profiles (id, role, display_name)
   values ('<user-id>', 'admin', 'Vorname Nachname');
   ```

   Für einen reinen Lesezugriff (Export, keine Änderungen) `role` auf `'viewer'` setzen.
3. Login unter `/admin/login`.

## E-Mail-Konfiguration

**Standard: [Resend](https://resend.com)** – einfaches API-Key-Setup, funktioniert zuverlässig ohne
OAuth-Konfiguration:

1. Konto bei Resend anlegen, Absender-Domain verifizieren (z. B. `rsv-hochschwarzwald.de`).
2. `RESEND_API_KEY` und `EMAIL_FROM` in den Environment Variables setzen.

**Alternative: Microsoft 365** – da Microsoft klassische SMTP-Basic-Authentifizierung deaktiviert hat, ist
direkter SMTP-Versand über ein Vereinspostfach nur noch mit einem App-Passwort (falls von der
Tenant-Richtlinie erlaubt) oder über die Microsoft Graph API (App-Registrierung in Entra ID +
`Mail.Send`-Berechtigung mit Admin-Consent) möglich. Der `src/lib/email.ts`-Service ist bewusst als
austauschbares Modul gebaut – für einen Graph-basierten Versand dort `sendMail()` durch einen Aufruf von
`POST https://graph.microsoft.com/v1.0/users/{postfach}/sendMail` ersetzen. Ohne gesetzten `RESEND_API_KEY`
protokolliert die Anwendung E-Mails nur in die Server-Logs, ohne den Anmeldeprozess zu blockieren.

## Deployment

**Gewählter Weg: GitHub + Cloudflare Workers**, automatisch bei jedem Push auf `main` via GitHub Actions
(`.github/workflows/deploy.yml`). Die Next.js-App wird dafür mit dem
[OpenNext-Cloudflare-Adapter](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`) gebaut – das ist
der aktuelle, offizielle Weg, eine vollständige Next.js-App (inkl. Server Actions, API-Routen mit
Node.js-Laufzeit für den Excel-Export, Middleware) auf Cloudflare zu betreiben. Die reine
`@cloudflare/next-on-pages`-Integration reicht dafür nicht aus, da sie keine Node.js-Laufzeit unterstützt.

> **Hinweis für Windows:** `npm run cf:build` / `npm run cf:preview` lokal auf Windows benötigt entweder
> aktivierten **Entwicklermodus** (Einstellungen → Datenschutz und Sicherheit → Für Entwickler) oder WSL, da der
> Build-Prozess symbolische Links anlegt. Für den produktiven Betrieb ist das irrelevant, weil das automatische
> Deployment über GitHub Actions auf Linux-Runnern läuft und davon nicht betroffen ist. Lokale Entwicklung mit
> `npm run dev` funktioniert auf Windows ohne Einschränkung.

### 1. Cloudflare-Konto & API-Token

1. Kostenloses Konto auf [dash.cloudflare.com](https://dash.cloudflare.com) anlegen.
2. **Account-ID** notieren (Cloudflare-Dashboard, rechte Seitenleiste).
3. **API-Token** erstellen: Mein Profil → API-Tokens → „Token erstellen" → Vorlage „Edit Cloudflare Workers"
   verwenden (oder ein Custom-Token mit den Berechtigungen `Account.Workers Scripts:Edit`,
   `Account.Workers R2 Storage:Edit`, `Account.Workers KV Storage:Edit` sowie `Zone.Workers Routes:Edit`, falls
   eine eigene Domain angebunden wird).

### 2. Einmalige Einrichtung des Workers (lokal, per Wrangler)

```bash
npm install
npx wrangler login
```

Server-seitige Secrets/Variablen einmalig im Worker hinterlegen (werden dort dauerhaft gespeichert, unabhängig
vom Deployment):

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ADMIN_NOTIFICATION_EMAIL
npx wrangler secret put EMAIL_FROM
```

(Jeder Befehl fragt interaktiv nach dem Wert.) Weitere, unkritische Variablen (`WAITLIST_ENABLED`,
`NOTIFY_ON_SHIFT_FULL`, `MICROSOFT_INTEGRATION_ENABLED` …) können stattdessen direkt im `vars`-Block von
`wrangler.jsonc` gepflegt werden, wenn sie kein Geheimnis sind.

### 3. GitHub Actions einrichten (automatisches Deployment bei Push auf `main`)

Im GitHub-Repository unter **Settings → Secrets and variables → Actions**:

- **Secrets:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Variables** (öffentliche `NEXT_PUBLIC_*`-Werte, werden fest ins Frontend-Bundle kompiliert):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_EVENT_NAME`,
  `NEXT_PUBLIC_ORGANIZATION_NAME`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PUBLIC_FIRST_NAMES_ENABLED`

Danach reicht ein einfacher `git push origin main` – der Workflow baut die App, führt die Tests aus und
deployed automatisch auf Cloudflare Workers.

### 4. Manuelles Deployment (Alternative/Erstlauf ohne GitHub Actions)

```bash
npm run cf:build
npx wrangler deploy
```

### Nach dem ersten Deployment

`NEXT_PUBLIC_APP_URL` (GitHub-Actions-Variable) auf die endgültige `*.workers.dev`-Adresse bzw. eigene Domain
setzen und neu deployen – dieser Wert wird für die persönlichen Änderungslinks in E-Mails benötigt.

### Alternative: Vercel

Falls doch Vercel statt Cloudflare bevorzugt wird, funktioniert die App dort ohne Zusatzkonfiguration
(`next build` direkt, kein OpenNext-Adapter nötig): Repository verbinden, Environment Variables aus
`.env.example` hinterlegen, fertig – jeder Push auf `main` deployed automatisch.

## Supabase Keep-Alive (Free-Tier)

Der kostenlose Supabase-Plan **pausiert ein Projekt automatisch nach 7 Tagen ohne API-Zugriff** – die Daten
bleiben zwar erhalten, das Projekt muss dann aber manuell im Dashboard reaktiviert werden. Da die
Helferanmeldung bis zum Event im Dezember 2026 über Wochen kaum Datenverkehr hat, übernimmt
`.github/workflows/keep-alive.yml` das automatisch:

- Läuft **täglich** (GitHub Actions Cron) und schickt eine harmlose, rein lesende Anfrage an die öffentliche
  `event_public_info`-Ansicht – das zählt bei Supabase als Aktivität und verhindert die Pausierung.
- Schreibt danach einen Zeitstempel in `keep-alive/last-ping.txt` und committet ihn. Das ist kein Zufall:
  GitHub deaktiviert zeitgesteuerte Workflows selbst automatisch, wenn ein Repository **60 Tage** ohne echten
  Commit bleibt – ein reiner Workflow-Lauf ohne Commit zählt dafür nicht. Der tägliche Commit hält also nicht
  nur Supabase, sondern auch den Keep-Alive-Workflow selbst am Leben.
- Schlägt der Workflow fehl (z. B. weil das Supabase-Projekt tatsächlich pausiert oder gelöscht wurde), bekommt
  der GitHub-Account, der den Workflow zuletzt geändert hat, automatisch eine Fehler-E-Mail von GitHub.

**Einmalige Einrichtung:**

1. Die Actions-Variablen `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` sind ohnehin schon für
   `deploy.yml` nötig (siehe oben) – für `keep-alive.yml` wird nichts zusätzlich benötigt.
2. Unter **Settings → Actions → General → Workflow permissions** die Option **„Read and write permissions"**
   aktivieren, damit der Workflow den täglichen Zeitstempel-Commit pushen darf (ohne diese Einstellung schlägt
   nur der Commit-Schritt fehl, der Supabase-Ping selbst funktioniert trotzdem).

**Sobald ihr auf einen kostenpflichtigen Supabase-Plan wechselt** (kein Auto-Pause mehr), kann
`.github/workflows/keep-alive.yml` gelöscht oder unter der Actions-Oberfläche deaktiviert werden.

## Tests

```bash
npm test
```

Ausführliche Test-Dokumentation inkl. SQL-Testskript für die Buchungslogik und Anleitung zur manuellen
Race-Condition-Prüfung: [docs/TESTS.md](docs/TESTS.md).

## Backup

- **Automatisch:** Supabase erstellt auf kostenpflichtigen Plänen tägliche Backups (Dashboard → **Database →
  Backups**). Für den Free-Plan empfiehlt sich ein regelmäßiger manueller Export.
- **Manuell (SQL-Dump):**

  ```bash
  npx supabase db dump --file backup_$(date +%Y%m%d).sql
  ```

- **Manuell (Daten-Export):** Admin-Bereich → „CSV exportieren" / „Excel exportieren" – reicht für eine
  redaktionelle Sicherung des aktuellen Helferplans, ersetzt aber kein vollständiges Datenbank-Backup.

## Excel-/CSV-Export

Im Adminbereich unter **Helfer & Schichten**:

- **CSV exportieren** (`/api/admin/export/csv`) – UTF-8 mit BOM, Semikolon-getrennt (öffnet in Excel mit
  korrekten Umlauten), optional gefiltert nach Tag (`?day=freitag`).
- **Excel exportieren** (`/api/admin/export/xlsx`) – `Helferplan_Weltcup_2026.xlsx` mit den Arbeitsblättern
  „Helferplan" (eine Zeile pro Schicht mit bis zu 4 Helfern) und „Alle Helfer" (eine Zeile pro Anmeldung).

Die Excel-Datei ist ein Export-Artefakt – Supabase bleibt die alleinige Datenquelle (siehe
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

## Microsoft-365-Integration (optional)

- **E-Mail:** siehe oben.
- **Ablage in SharePoint/OneDrive:** Der Admin lädt den exportierten `Helferplan_Weltcup_2026.xlsx` manuell in
  den gewünschten Vereinsordner hoch. Eine automatische Ablage per Microsoft Graph API kann bei Bedarf ergänzt
  werden (`MICROSOFT_INTEGRATION_ENABLED`, `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`,
  `MICROSOFT_CLIENT_SECRET` sind in `.env.example` bereits vorbereitet).

## Neue Veranstaltung einrichten

Die Anwendung ist bewusst generisch gebaut: Veranstaltungsname, Ort und Schichten sind reine Konfiguration,
nicht in den Code einprogrammiert. Für eine **neue Veranstaltung** (z. B. den Weltcup im nächsten Jahr, oder
eine ganz andere Vereinsveranstaltung) reicht eine eigene Kopie mit angepasster Konfiguration – kein Programmieren
nötig. Jede Veranstaltung bekommt dabei ihr **eigenes** Supabase-Projekt und ihren **eigenen** Cloudflare-Worker
(sauber getrennte Daten, kein Risiko für alte Anmeldungen).

**Empfehlung:** Das GitHub-Repository einmalig als **Template-Repository** markieren
(Repo → Settings → allgemein → Häkchen bei „Template repository"). Danach genügt für jede neue Veranstaltung
ein Klick auf **„Use this template"** auf der Repo-Startseite, statt manuell zu klonen.

### Schritt für Schritt

1. **Neues Repository** aus der Vorlage erstellen (**„Use this template"**, oder Repo klonen und neu
   pushen), z. B. `weltcup-helfer-2027`.
2. **Neues, leeres Supabase-Projekt** anlegen (siehe [Supabase-Einrichtung](#supabase-einrichtung) oben) –
   niemals das bestehende Projekt einer laufenden/vergangenen Veranstaltung wiederverwenden.
3. Migrationen **0001 bis 0005** (`supabase/migrations/`) der Reihe nach im SQL Editor ausführen.
4. **`supabase/seed.sql` anpassen**, bevor du sie ausführst – das ist der einzige Ort, an dem die Schichten
   definiert werden:
   - `title`, `start_date`, `end_date` des Events
   - die `insert into shifts (...)`-Zeilen: Datum, Bezeichnung, Start-/Endzeit, Kapazität, Reihenfolge.
     Beliebig viele **Tage** sind möglich; die Admin-Übersicht und der Excel-Export gehen aber von genau
     **zwei Schichten pro Tag** mit sichtbarer Übergabe aus (wie beim Weltcup) – bei einer abweichenden
     Anzahl Schichten pro Tag müssten `src/app/admin/(dashboard)/helfer/page.tsx`,
     `src/lib/exportData.ts` und die XLSX-Route entsprechend angepasst werden
   - Danach die angepasste `seed.sql` im SQL Editor ausführen.
5. Admin-Konto für das neue Projekt anlegen (siehe [Admin-Konto anlegen](#admin-konto-anlegen)).
6. **Environment Variables** für die neue Veranstaltung anpassen (lokal in `.env.local`, produktiv als
   GitHub-Actions-Variablen/-Secrets – siehe [Environment Variables](#environment-variables)):
   - `NEXT_PUBLIC_EVENT_NAME`, `NEXT_PUBLIC_EVENT_KICKER`, `NEXT_PUBLIC_EVENT_LOCATION`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (vom neuen
     Supabase-Projekt)
   - `ADMIN_NOTIFICATION_EMAIL`, `NEXT_PUBLIC_APP_URL` (wird nach Schritt 8 final gesetzt)
7. In `wrangler.jsonc` den `name` (und den `service`-Wert im `WORKER_SELF_REFERENCE`-Binding) auf einen neuen,
   noch nicht verwendeten Worker-Namen ändern, z. B. `weltcup2027`.
8. Wie unter [Deployment](#deployment) beschrieben: Cloudflare-API-Token + Account-ID als GitHub-Secrets
   hinterlegen, Workflow laufen lassen, danach `NEXT_PUBLIC_APP_URL` auf die echte `*.workers.dev`-Adresse
   setzen und erneut deployen.
9. Logo (`public/rsv-logo.jpg`) kann unverändert bleiben, solange es weiterhin eine RSV-Hochschwarzwald-
   Veranstaltung ist.

Das war's – kein einziger dieser Schritte erfordert eine Codeänderung.

## Projektstruktur

```
src/
  app/
    page.tsx                  Öffentliche Startseite (Schichtübersicht)
    meine-anmeldung/[token]/  Persönlicher Änderungslink
    datenschutz/              Datenschutzseite (Platzhalter)
    admin/                    Geschützter Adminbereich (Dashboard, Roster, Druck, Einstellungen)
    api/
      register/                        Neuanmeldung (RPC register_helper)
      registration/[token]/            Ansehen/Ändern per Edit-Token
      admin/export/{csv,xlsx}/         Admin-Exporte
  components/                 Öffentliche UI-Komponenten
  components/admin/           Admin-UI-Komponenten
  lib/                        Supabase-Clients, E-Mail, Formatierung, Config
  hooks/                      useLiveShiftStatus (Realtime + Polling-Fallback)
  types/                      Gemeinsame TypeScript-Typen
supabase/
  migrations/                 Schema, RLS, Buchungslogik (RPCs), Realtime-Trigger
  seed.sql                    Weltcup-2026-Event + 6 Schichten
  tests/booking_tests.sql     SQL-Testskript für die Buchungslogik
docs/                         Architektur, Sicherheit, Tests
.github/workflows/deploy.yml  Automatisches Deployment auf Cloudflare Workers bei Push auf main
wrangler.jsonc                 Cloudflare-Worker-Konfiguration (OpenNext-Adapter)
open-next.config.ts            OpenNext-Cloudflare-Adapter-Konfiguration
```
