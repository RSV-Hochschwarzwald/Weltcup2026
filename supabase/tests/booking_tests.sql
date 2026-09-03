-- ============================================================
-- booking_tests.sql
-- Manuelles/automatisierbares SQL-Testskript für die kritische
-- Buchungslogik (siehe docs/TESTS.md, CLAUDE-Vorgabe Abschnitt 80).
--
-- Ausführen gegen eine Supabase-/Postgres-Testumgebung (NICHT gegen
-- die Produktivdatenbank!), z. B.:
--
--   supabase db reset            -- lädt migrations/ + seed.sql neu
--   psql "$DATABASE_URL" -f supabase/tests/booking_tests.sql
--
-- Das Skript bricht bei jedem fehlgeschlagenen Test mit einer
-- Exception ab ("Test X fehlgeschlagen: ...").
-- ============================================================

do $$
declare
  v_shift_id uuid;
  v_result jsonb;
  v_count int;
  v_token1 text;
  v_token2 text;
  v_token3 text;
  v_token4 text;
  v_helper_id uuid;
begin
  select id into v_shift_id from shifts
  where date = '2026-12-11' and name = 'Schicht 1';

  if v_shift_id is null then
    raise exception 'Testvoraussetzung fehlt: Seed-Daten (seed.sql) wurden nicht geladen.';
  end if;

  -- Sicherstellen, dass die Schicht zu Testbeginn leer ist
  delete from registrations where shift_id = v_shift_id;

  -- ---------------- Test 1: 0 Helfer -> Anmeldung möglich ----------------
  v_result := register_helper('Test', 'Eins', 'test1@example.org', null, null, array[v_shift_id]);
  if not (v_result->>'success')::boolean then
    raise exception 'Test 1 fehlgeschlagen: Anmeldung bei 0 Helfern sollte möglich sein. Ergebnis: %', v_result;
  end if;
  v_token1 := v_result->>'edit_token';
  raise notice 'Test 1 OK: Anmeldung bei 0 Helfern erfolgreich.';

  -- ---------------- weitere zwei Helfer eintragen (jetzt 3) ----------------
  v_result := register_helper('Test', 'Zwei', 'test2@example.org', null, null, array[v_shift_id]);
  v_token2 := v_result->>'edit_token';
  v_result := register_helper('Test', 'Drei', 'test3@example.org', null, null, array[v_shift_id]);
  v_token3 := v_result->>'edit_token';

  select count(*) into v_count from registrations where shift_id = v_shift_id and status = 'active';
  if v_count <> 3 then
    raise exception 'Testvoraussetzung fehlgeschlagen: erwartet 3 aktive Anmeldungen, gefunden %', v_count;
  end if;

  -- ---------------- Test 2: 3 Helfer -> vierte Anmeldung möglich ----------------
  v_result := register_helper('Test', 'Vier', 'test4@example.org', null, null, array[v_shift_id]);
  if not (v_result->>'success')::boolean then
    raise exception 'Test 2 fehlgeschlagen: vierte Anmeldung sollte möglich sein. Ergebnis: %', v_result;
  end if;
  v_token4 := v_result->>'edit_token';
  raise notice 'Test 2 OK: vierte Anmeldung erfolgreich.';

  -- ---------------- Test 3: 4 Helfer -> fünfte Anmeldung unmöglich ----------------
  v_result := register_helper('Test', 'Fuenf', 'test5@example.org', null, null, array[v_shift_id]);
  if (v_result->>'success')::boolean then
    raise exception 'Test 3 fehlgeschlagen: fünfte Anmeldung wurde fälschlich gespeichert!';
  end if;
  if v_result->>'error' <> 'shifts_full' then
    raise exception 'Test 3 fehlgeschlagen: erwarteter Fehlercode shifts_full, erhalten %', v_result->>'error';
  end if;

  select count(*) into v_count from registrations where shift_id = v_shift_id and status = 'active';
  if v_count <> 4 then
    raise exception 'Test 3 fehlgeschlagen: Kapazität wurde überschritten! Aktive Anmeldungen: %', v_count;
  end if;
  raise notice 'Test 3 OK: fünfte Anmeldung korrekt abgelehnt, Kapazität bleibt bei 4.';

  -- ---------------- Test 5: Absage -> Platz wird wieder frei ----------------
  select helper_id into v_helper_id from helpers where edit_token = v_token1;
  v_result := cancel_registration_by_token(
    v_token1,
    (select id from registrations where helper_id = (select id from helpers where edit_token = v_token1) and shift_id = v_shift_id)
  );
  if not (v_result->>'success')::boolean then
    raise exception 'Test 5 fehlgeschlagen: Absage sollte erfolgreich sein. Ergebnis: %', v_result;
  end if;

  select count(*) into v_count from registrations where shift_id = v_shift_id and status = 'active';
  if v_count <> 3 then
    raise exception 'Test 5 fehlgeschlagen: nach Absage erwartet 3 aktive Anmeldungen, gefunden %', v_count;
  end if;
  raise notice 'Test 5 OK: Absage gibt den Platz wieder frei (jetzt 3/4).';

  -- Platz wieder auffüllen für nachfolgende Tests
  perform register_helper('Test', 'Sechs', 'test6@example.org', null, null, array[v_shift_id]);

  -- ---------------- Test 7: manuell gesperrte Schicht -> keine Anmeldung ----------------
  update shifts set manually_locked = true where id = v_shift_id;
  -- Schicht künstlich leeren, um sicherzustellen, dass NICHT die Kapazität, sondern die Sperre greift
  delete from registrations where shift_id = v_shift_id;

  v_result := register_helper('Test', 'Sieben', 'test7@example.org', null, null, array[v_shift_id]);
  if (v_result->>'success')::boolean then
    raise exception 'Test 7 fehlgeschlagen: Anmeldung bei manuell gesperrter Schicht wurde fälschlich gespeichert!';
  end if;
  raise notice 'Test 7 OK: manuell gesperrte Schicht lehnt Anmeldung korrekt ab.';

  update shifts set manually_locked = false where id = v_shift_id;

  -- ---------------- Test 8: ungültiger Edit-Token -> keine Daten sichtbar ----------------
  v_result := get_registration_by_token('0000000000000000000000000000000000000000000000000000000000000000');
  if (v_result->>'success')::boolean then
    raise exception 'Test 8 fehlgeschlagen: ungültiger Token lieferte Daten zurück!';
  end if;
  raise notice 'Test 8 OK: ungültiger Edit-Token liefert keine Daten.';

  -- Aufräumen
  delete from registrations where shift_id = v_shift_id;
  delete from helpers where email in (
    'test1@example.org','test2@example.org','test3@example.org',
    'test4@example.org','test5@example.org','test6@example.org','test7@example.org'
  );

  raise notice 'Alle SQL-Tests erfolgreich durchgelaufen.';
end;
$$;
