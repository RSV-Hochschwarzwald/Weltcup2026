-- ============================================================
-- 0003_functions.sql
-- Transaktionssichere Buchungslogik (RPC) + Self-Service über
-- Edit-Token + Admin-Hilfsfunktionen mit Kapazitätsprüfung.
--
-- Jede Funktion läuft als SECURITY DEFINER (Eigentümer = Migrations-
-- rolle, besitzt die Tabellen -> RLS-unabhängig) und ist damit die
-- EINZIGE Möglichkeit für anon/authenticated, Helfer- und
-- Registrierungsdaten zu schreiben. Kapazitätsprüfung + Schreiben
-- passieren innerhalb derselben Funktion = derselben Transaktion,
-- mit "SELECT ... FOR UPDATE" auf die betroffenen shifts-Zeilen, um
-- Race Conditions bei gleichzeitigen Anmeldungen zu verhindern
-- (CLAUDE-Vorgabe Abschnitt 13/14/54).
-- ============================================================

create or replace function current_is_admin()
returns boolean
language sql
stable
as $$
  select
    auth.role() = 'service_role'
    or exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    );
$$;

create or replace function current_is_staff()
returns boolean
language sql
stable
as $$
  select
    auth.role() = 'service_role'
    or exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('admin', 'viewer')
    );
$$;

create or replace function get_setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
as $$
  select coalesce((select (value#>>'{}')::boolean from settings where key = p_key), p_default);
$$;

-- ------------------------------------------------------------
-- Interne Hilfsfunktion: prüft + sperrt eine Liste von Schichten
-- und liefert je Schicht die aktuelle aktive Belegung.
-- Muss innerhalb einer Transaktion (also innerhalb einer anderen
-- Funktion) aufgerufen werden.
-- ------------------------------------------------------------
create or replace function lock_and_check_shifts(p_shift_ids uuid[])
returns table (
  shift_id uuid,
  capacity int,
  active_count int,
  is_bookable boolean
)
language plpgsql
as $$
begin
  -- Deterministische Sperr-Reihenfolge (nach id) verhindert Deadlocks,
  -- wenn zwei Anfragen unterschiedliche Schicht-Kombinationen buchen.
  perform s.id
  from shifts s
  where s.id = any(p_shift_ids)
  order by s.id
  for update;

  return query
  select
    s.id,
    s.capacity,
    coalesce(cnt.active_count, 0)::int,
    (
      s.status = 'open'
      and s.manually_locked = false
      and coalesce(cnt.active_count, 0) < s.capacity
    ) as is_bookable
  from shifts s
  left join (
    select shift_id, count(*) as active_count
    from registrations
    where status = 'active'
    group by shift_id
  ) cnt on cnt.shift_id = s.id
  where s.id = any(p_shift_ids);
end;
$$;

-- ------------------------------------------------------------
-- Öffentliche Neuanmeldung (ein neuer Helfer, 1..n Schichten)
-- Alles-oder-nichts: Sind einzelne Schichten inzwischen voll,
-- wird NICHTS gespeichert; das Frontend erhält die betroffenen
-- Schicht-IDs zurück, um dem Benutzer gezielt Bescheid zu geben.
-- ------------------------------------------------------------
create or replace function register_helper(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_notes text,
  p_shift_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper_id uuid;
  v_edit_token text;
  v_check record;
  v_failed uuid[] := '{}';
  v_waitlisted uuid[] := '{}';
  v_booked uuid[] := '{}';
  v_waitlist_enabled boolean;
begin
  if p_shift_ids is null or array_length(p_shift_ids, 1) is null then
    return jsonb_build_object('success', false, 'error', 'no_shifts');
  end if;

  if btrim(coalesce(p_first_name, '')) = '' or btrim(coalesce(p_last_name, '')) = '' then
    return jsonb_build_object('success', false, 'error', 'name_required');
  end if;

  if btrim(coalesce(p_email, '')) = '' and btrim(coalesce(p_phone, '')) = '' then
    return jsonb_build_object('success', false, 'error', 'contact_required');
  end if;

  -- Auch prüfen, ob übergebene IDs überhaupt existierende Schichten sind
  if (select count(*) from shifts where id = any(p_shift_ids)) <> array_length(p_shift_ids, 1) then
    return jsonb_build_object('success', false, 'error', 'invalid_shift');
  end if;

  v_waitlist_enabled := get_setting_bool('waitlist_enabled', false);

  -- Schichten sperren + prüfen. Volle Schichten werden NUR dann nicht als
  -- Fehler behandelt, wenn die Warteliste aktiviert ist (Abschnitt 29) –
  -- der Aufrufer bekommt in jedem Fall explizit mitgeteilt, was passiert ist.
  for v_check in select * from lock_and_check_shifts(p_shift_ids) loop
    if v_check.is_bookable then
      v_booked := array_append(v_booked, v_check.shift_id);
    elsif v_waitlist_enabled and v_check.active_count >= v_check.capacity then
      v_waitlisted := array_append(v_waitlisted, v_check.shift_id);
    else
      v_failed := array_append(v_failed, v_check.shift_id);
    end if;
  end loop;

  if array_length(v_failed, 1) is not null then
    return jsonb_build_object('success', false, 'error', 'shifts_full', 'failed_shift_ids', to_jsonb(v_failed));
  end if;

  v_edit_token := encode(gen_random_bytes(32), 'hex');

  insert into helpers (first_name, last_name, email, phone, notes, edit_token)
  values (
    btrim(p_first_name),
    btrim(p_last_name),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_edit_token
  )
  returning id into v_helper_id;

  insert into registrations (helper_id, shift_id, status)
  select v_helper_id, s, 'active' from unnest(v_booked) as s;

  insert into registrations (helper_id, shift_id, status)
  select v_helper_id, s, 'waitlist' from unnest(v_waitlisted) as s;

  return jsonb_build_object(
    'success', true,
    'helper_id', v_helper_id,
    'edit_token', v_edit_token,
    'booked_shift_ids', to_jsonb(v_booked),
    'waitlisted_shift_ids', to_jsonb(v_waitlisted)
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'duplicate');
end;
$$;

revoke all on function register_helper(text, text, text, text, text, uuid[]) from public;
grant execute on function register_helper(text, text, text, text, text, uuid[]) to anon, authenticated;

-- ------------------------------------------------------------
-- Zusätzliche Schicht über bestehenden Edit-Token buchen
-- ------------------------------------------------------------
create or replace function add_registration_by_token(p_token text, p_shift_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper_id uuid;
  v_check record;
  v_waitlist boolean;
begin
  select id into v_helper_id from helpers where edit_token = p_token;
  if v_helper_id is null then
    return jsonb_build_object('success', false, 'error', 'invalid_token');
  end if;

  select * into v_check from lock_and_check_shifts(array[p_shift_id]) limit 1;
  if v_check is null then
    return jsonb_build_object('success', false, 'error', 'invalid_shift');
  end if;

  if not v_check.is_bookable then
    v_waitlist := get_setting_bool('waitlist_enabled', false);
    if v_waitlist and v_check.active_count >= v_check.capacity then
      insert into registrations (helper_id, shift_id, status)
      values (v_helper_id, p_shift_id, 'waitlist')
      on conflict do nothing;
      return jsonb_build_object('success', true, 'status', 'waitlist');
    end if;
    return jsonb_build_object('success', false, 'error', 'shift_full');
  end if;

  insert into registrations (helper_id, shift_id, status)
  values (v_helper_id, p_shift_id, 'active')
  on conflict (helper_id, shift_id) where (status = 'active') do nothing;

  return jsonb_build_object('success', true, 'status', 'active');
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'duplicate');
end;
$$;

revoke all on function add_registration_by_token(text, uuid) from public;
grant execute on function add_registration_by_token(text, uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Eigene Anmeldung ansehen (Edit-Token = Zugriffsschlüssel)
-- ------------------------------------------------------------
create or replace function get_registration_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_helper record;
  v_registrations jsonb;
begin
  select * into v_helper from helpers where edit_token = p_token;
  if v_helper is null then
    return jsonb_build_object('success', false, 'error', 'invalid_token');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'registration_id', r.id,
    'status', r.status,
    'shift_id', s.id,
    'date', s.date,
    'name', s.name,
    'start_time', s.start_time,
    'end_time', s.end_time,
    'created_at', r.created_at
  ) order by s.date, s.start_time), '[]'::jsonb)
  into v_registrations
  from registrations r
  join shifts s on s.id = r.shift_id
  where r.helper_id = v_helper.id and r.status <> 'cancelled';

  return jsonb_build_object(
    'success', true,
    'helper', jsonb_build_object(
      'first_name', v_helper.first_name,
      'last_name', v_helper.last_name,
      'email', v_helper.email,
      'phone', v_helper.phone,
      'notes', v_helper.notes
    ),
    'registrations', v_registrations
  );
end;
$$;

revoke all on function get_registration_by_token(text) from public;
grant execute on function get_registration_by_token(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Kontaktdaten über Edit-Token aktualisieren
-- ------------------------------------------------------------
create or replace function update_helper_by_token(
  p_token text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper_id uuid;
begin
  select id into v_helper_id from helpers where edit_token = p_token;
  if v_helper_id is null then
    return jsonb_build_object('success', false, 'error', 'invalid_token');
  end if;

  if btrim(coalesce(p_first_name, '')) = '' or btrim(coalesce(p_last_name, '')) = '' then
    return jsonb_build_object('success', false, 'error', 'name_required');
  end if;

  if btrim(coalesce(p_email, '')) = '' and btrim(coalesce(p_phone, '')) = '' then
    return jsonb_build_object('success', false, 'error', 'contact_required');
  end if;

  update helpers set
    first_name = btrim(p_first_name),
    last_name = btrim(p_last_name),
    email = nullif(btrim(coalesce(p_email, '')), ''),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = v_helper_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function update_helper_by_token(text, text, text, text, text, text) from public;
grant execute on function update_helper_by_token(text, text, text, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Schicht über Edit-Token absagen
-- ------------------------------------------------------------
create or replace function cancel_registration_by_token(p_token text, p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper_id uuid;
  v_shift_id uuid;
  v_rows int;
begin
  select id into v_helper_id from helpers where edit_token = p_token;
  if v_helper_id is null then
    return jsonb_build_object('success', false, 'error', 'invalid_token');
  end if;

  update registrations
  set status = 'cancelled'
  where id = p_registration_id and helper_id = v_helper_id and status in ('active', 'waitlist')
  returning shift_id into v_shift_id;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('success', true, 'shift_id', v_shift_id);
end;
$$;

revoke all on function cancel_registration_by_token(text, uuid) from public;
grant execute on function cancel_registration_by_token(text, uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- ADMIN: Helfer manuell einer Schicht hinzufügen (kapazitätssicher)
-- ------------------------------------------------------------
create or replace function admin_add_registration(
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_notes text,
  p_shift_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_helper_id uuid;
  v_edit_token text;
  v_check record;
begin
  if not current_is_admin() then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select * into v_check from lock_and_check_shifts(array[p_shift_id]) limit 1;
  if v_check is null then
    return jsonb_build_object('success', false, 'error', 'invalid_shift');
  end if;

  if not v_check.is_bookable and not p_force then
    return jsonb_build_object('success', false, 'error', 'shift_full');
  end if;

  v_edit_token := encode(gen_random_bytes(32), 'hex');

  insert into helpers (first_name, last_name, email, phone, notes, edit_token)
  values (btrim(p_first_name), btrim(p_last_name),
          nullif(btrim(coalesce(p_email, '')), ''),
          nullif(btrim(coalesce(p_phone, '')), ''),
          nullif(btrim(coalesce(p_notes, '')), ''),
          v_edit_token)
  returning id into v_helper_id;

  insert into registrations (helper_id, shift_id, status)
  values (v_helper_id, p_shift_id, 'active');

  return jsonb_build_object('success', true, 'helper_id', v_helper_id, 'edit_token', v_edit_token);
end;
$$;

revoke all on function admin_add_registration(text, text, text, text, text, uuid, boolean) from public;
grant execute on function admin_add_registration(text, text, text, text, text, uuid, boolean) to authenticated, service_role;

-- ------------------------------------------------------------
-- ADMIN: bestehenden Helfer einer weiteren Schicht zuordnen
-- ------------------------------------------------------------
create or replace function admin_assign_existing_helper(
  p_helper_id uuid,
  p_shift_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check record;
begin
  if not current_is_admin() then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select * into v_check from lock_and_check_shifts(array[p_shift_id]) limit 1;
  if v_check is null then
    return jsonb_build_object('success', false, 'error', 'invalid_shift');
  end if;

  if not v_check.is_bookable and not p_force then
    return jsonb_build_object('success', false, 'error', 'shift_full');
  end if;

  insert into registrations (helper_id, shift_id, status)
  values (p_helper_id, p_shift_id, 'active')
  on conflict (helper_id, shift_id) where (status = 'active') do nothing;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function admin_assign_existing_helper(uuid, uuid, boolean) from public;
grant execute on function admin_assign_existing_helper(uuid, uuid, boolean) to authenticated, service_role;

-- ------------------------------------------------------------
-- ADMIN: Helfer in eine andere Schicht verschieben (atomar)
-- ------------------------------------------------------------
create or replace function admin_move_registration(
  p_registration_id uuid,
  p_new_shift_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check record;
  v_helper_id uuid;
begin
  if not current_is_admin() then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select helper_id into v_helper_id from registrations where id = p_registration_id;
  if v_helper_id is null then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  select * into v_check from lock_and_check_shifts(array[p_new_shift_id]) limit 1;
  if v_check is null then
    return jsonb_build_object('success', false, 'error', 'invalid_shift');
  end if;

  if not v_check.is_bookable and not p_force then
    return jsonb_build_object('success', false, 'error', 'shift_full');
  end if;

  update registrations set shift_id = p_new_shift_id, status = 'active'
  where id = p_registration_id;

  return jsonb_build_object('success', true);
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'duplicate');
end;
$$;

revoke all on function admin_move_registration(uuid, uuid, boolean) from public;
grant execute on function admin_move_registration(uuid, uuid, boolean) to authenticated, service_role;

-- ------------------------------------------------------------
-- ADMIN: Warteliste manuell nachrücken lassen
-- ------------------------------------------------------------
create or replace function admin_promote_waitlist(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift_id uuid;
  v_check record;
begin
  if not current_is_admin() then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select shift_id into v_shift_id from registrations
  where id = p_registration_id and status = 'waitlist';

  if v_shift_id is null then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  select * into v_check from lock_and_check_shifts(array[v_shift_id]) limit 1;

  if not v_check.is_bookable then
    return jsonb_build_object('success', false, 'error', 'shift_full');
  end if;

  update registrations set status = 'active' where id = p_registration_id;

  return jsonb_build_object('success', true);
end;
$$;

revoke all on function admin_promote_waitlist(uuid) from public;
grant execute on function admin_promote_waitlist(uuid) to authenticated, service_role;
