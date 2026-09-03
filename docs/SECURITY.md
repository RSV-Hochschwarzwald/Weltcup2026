# Sicherheitskonzept

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` existiert ausschließlich als Server-Environment-Variable (Vercel/Cloudflare
  „Encrypted"-Variable). Er wird nur in `src/lib/supabase/admin.ts` verwendet, das mit `import "server-only"`
  markiert ist – ein versehentlicher Import aus einer Client-Komponente führt zu einem Build-Fehler.
- Kein Secret befindet sich in `.env.example`, im Git-Repository oder im JavaScript-Bundle.
- `RESEND_API_KEY`, `SMTP_PASSWORD`, `MICROSOFT_CLIENT_SECRET` – ausschließlich Server-Env.

## Überbuchungsschutz (Kern der Anwendung)

- Einzige Schreibwege für Helfer-Daten: die SECURITY-DEFINER-Funktionen in
  `supabase/migrations/0003_functions.sql`. Direkte `INSERT`/`UPDATE` auf `registrations` sind für `anon` und
  `authenticated` durch RLS ohne Policy vollständig gesperrt.
- Jede Buchungsfunktion sperrt die betroffenen `shifts`-Zeilen mit `SELECT … FOR UPDATE` **innerhalb derselben
  Transaktion**, bevor die aktuelle Belegung gezählt wird. Zwei gleichzeitige Aufrufe für dieselbe Schicht werden
  von PostgreSQL serialisiert – der zweite Aufruf sieht bereits die vom ersten aktualisierten Zeilen.
- Zusätzliches Sicherheitsnetz auf Datenbankebene: `uq_registrations_active_helper_shift` (Unique Index)
  verhindert doppelte aktive Anmeldungen derselben Person für dieselbe Schicht unabhängig von der
  Anwendungslogik.
- Die Kapazitätsgrenze (`capacity`) wird nirgends redundant gespeichert – `available_count` wird immer live aus
  `count(active registrations)` berechnet (`shift_public_status`-View), kann also nicht inkonsistent werden.

## Row Level Security

Siehe `supabase/migrations/0002_rls.sql`. Grundprinzip: RLS ist auf allen Tabellen aktiv; es existieren keine
Policies für `anon`/`authenticated` auf `helpers`, `registrations`, `events`, `shifts`, `audit_logs`,
`settings` (Standardverhalten = alles verweigert). Der einzige öffentliche Lesezugriff läuft über die Views
`shift_public_status`, `event_public_info`, `public_settings`, die bewusst keine personenbezogenen Daten
enthalten.

## Adminbereich

- Supabase Auth (E-Mail + Passwort). Keine öffentliche Registrierung – Konten werden ausschließlich manuell im
  Supabase-Dashboard angelegt (siehe README).
- Rollenmodell über `profiles.role` (`admin`/`viewer`). `viewer` kann lesen/exportieren, aber keine
  schreibenden Server Actions ausführen (`requireRole("admin")` in `src/app/admin/actions.ts`).
- `src/app/admin/(dashboard)/layout.tsx` prüft serverseitig bei jedem Aufruf über `getCurrentAdmin()`, ob eine
  gültige Session existiert, und leitet sonst zu `/admin/login` um. Bewusst keine Middleware dafür (siehe
  docs/ARCHITECTURE.md, Abschnitt "Cloudflare-Bundle-Größe") – die Layout-Prüfung ist die alleinige,
  ausreichende Sicherheitsgrenze, da sie vor jedem Rendern des geschützten Bereichs läuft.
- Admin-Server-Actions prüfen die Rolle serverseitig erneut (`requireRole`), bevor der Service-Role-Client
  verwendet wird – ein manipulierter Client-Request kann die Prüfung nicht umgehen.

## Eingabevalidierung

- Alle öffentlichen API-Routen validieren Eingaben mit `zod`, bevor sie an die Datenbank weitergereicht werden.
- Zusätzlich erzwingt die Datenbank über `CHECK`-Constraints (`helpers_contact_required`,
  `helpers_first_name_not_blank`, …), dass ungültige Daten selbst bei einem Bug in der API-Schicht nicht
  gespeichert werden können.

## Edit-Token (persönlicher Änderungslink)

- 256 Bit Zufall (`gen_random_bytes(32)`, hex-codiert) – praktisch nicht erratbar.
- Der Token ist der einzige Zugriffsschlüssel; es gibt keinen Nutzernamen/Passwort-Login für Helfer.
- Alle Token-Operationen laufen über SECURITY-DEFINER-Funktionen, die den Token serverseitig gegen `helpers`
  abgleichen – ein falscher Token liefert `{"success": false}`, niemals Daten anderer Helfer.

## Rate-Limiting / Missbrauch

- Für die Registrierungs-API empfiehlt sich zusätzlich ein Edge-seitiges Rate-Limiting (z. B. Vercel Firewall
  Rules oder Cloudflare Rate Limiting) auf `/api/register`, um automatisierte Massenanfragen zu bremsen. Dies
  ist eine reine Infrastruktur-Einstellung im jeweiligen Hosting-Dashboard und erfordert keine Codeänderung.

## Bekannter, akzeptierter Befund

- `npm audit`: moderate Advisory für `uuid` als transitive Abhängigkeit von `exceljs` (nur für den
  serverseitigen XLSX-Export verwendet, keine nutzergesteuerten Eingaben erreichen diesen Code-Pfad). Wird mit
  einem kompatiblen `exceljs`-Update behoben, sobald verfügbar.
