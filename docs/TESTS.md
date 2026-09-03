# Tests

Drei Ebenen, je nachdem, was am zuverlässigsten geprüft werden kann:

1. **Unit-Tests (Vitest)** – reine Logik ohne Datenbank: `npm test`
2. **SQL-Testskript** – die tatsächliche Buchungslogik in PostgreSQL (Kapazität, Sperren, Tokens)
3. **Manuelle Race-Condition-Prüfung** – zwei echte parallele HTTP-Requests gegen die laufende Anwendung

## Zuordnung zu den Pflichttests (CLAUDE-Vorgabe Abschnitt 80)

| # | Test | Nachweis |
|---|---|---|
| 1 | 0 Helfer → Anmeldung möglich | `tests/mapShift.test.ts`, `supabase/tests/booking_tests.sql` |
| 2 | 3 Helfer → vierte Anmeldung möglich | `tests/mapShift.test.ts`, `booking_tests.sql` |
| 3 | 4 Helfer → fünfte Anmeldung unmöglich | `tests/mapShift.test.ts` (Frontend), `booking_tests.sql` (Backend) |
| 4 | Zwei gleichzeitige Anmeldungen auf letzten Platz → genau eine erfolgreich | Manuelle Race-Condition-Prüfung (unten) |
| 5 | Absage → Platz wird wieder frei | `booking_tests.sql` |
| 6 | Volle Schicht → Frontend deaktiviert | `tests/mapShift.test.ts` |
| 7 | Manuell gesperrte Schicht → keine Anmeldung | `booking_tests.sql` |
| 8 | Ungültiger Edit-Token → keine Daten sichtbar | `booking_tests.sql` |
| 9 | Öffentlicher API-Zugriff → keine personenbezogenen Helferdaten | RLS-Review (unten) + manuelle Prüfung |

## 1. Unit-Tests ausführen

```bash
npm test
```

Prüft die reine Anzeige-/Statuslogik (`src/lib/mapShift.ts`, `src/lib/format.ts`): Verfügbarkeitstexte,
Deaktivierung voller/gesperrter Schichten, deutsches Datumsformat.

## 2. SQL-Testskript (echte Buchungslogik inkl. Race-Condition-Schutz auf DB-Ebene)

Gegen eine **Test-/Staging-Datenbank** ausführen, niemals gegen die Produktivdatenbank:

```bash
supabase db reset   # spielt migrations/ + seed.sql frisch ein
psql "$DATABASE_URL" -f supabase/tests/booking_tests.sql
```

Das Skript bricht bei jedem fehlgeschlagenen Assert mit einer aussagekräftigen Exception ab und gibt bei
Erfolg `Alle SQL-Tests erfolgreich durchgelaufen.` aus.

## 3. Manuelle Race-Condition-Prüfung (Test 4)

Eine echte Race Condition lässt sich nur mit zwei tatsächlich gleichzeitigen Requests gegen die laufende
Anwendung (lokal oder Staging) nachweisen. Vorgehen:

1. Eine Schicht auf 3/4 Helfer bringen (z. B. über den Adminbereich oder dreimalige Anmeldung).
2. Zwei Terminals vorbereiten, `SHIFT_ID` durch die betroffene Schicht-ID ersetzen:

```bash
curl -s -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Race","lastName":"A","email":"race-a@example.org","shiftIds":["SHIFT_ID"]}' &
curl -s -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Race","lastName":"B","email":"race-b@example.org","shiftIds":["SHIFT_ID"]}' &
wait
```

**Erwartung:** Genau eine Antwort liefert `"success":true`, die andere `"success":false` mit
`"error":"shifts_full"`. Anschließend in der Datenbank prüfen, dass die Schicht exakt 4 aktive Anmeldungen hat
(nicht 5) – die Garantie kommt aus `SELECT … FOR UPDATE` in `lock_and_check_shifts()`
(`supabase/migrations/0003_functions.sql`), nicht aus Anwendungscode.

## RLS-Review für Test 9 (keine PII über die öffentliche API)

- `helpers` und `registrations` haben RLS aktiviert und **keine** Policies für `anon`/`authenticated` →
  jeder direkte Query mit dem `anon`-Key liefert leere Ergebnismengen.
- Öffentlich lesbar sind ausschließlich `shift_public_status`, `event_public_info` und `public_settings` –
  alle drei enthalten laut Spaltendefinition keine Namen, Kontaktdaten, Bemerkungen, Tokens oder internen IDs
  außer der (unkritischen) Schicht-`shift_id`.
- Manuelle Stichprobe:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/helpers?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# Erwartung: [] (leeres Array, RLS blockiert den Zugriff vollständig)
```
