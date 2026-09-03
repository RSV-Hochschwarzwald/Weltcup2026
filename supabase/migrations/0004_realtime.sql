-- ============================================================
-- 0004_realtime.sql
-- Supabase Realtime "Broadcast from Database": bei jeder Änderung
-- einer Anmeldung wird der NEUE, bereits anonymisierte Belegungsstand
-- der betroffenen Schicht auf den öffentlichen Kanal "shift-status"
-- gesendet. So bekommt Nutzer A live mit, wenn Nutzer B eine Schicht
-- bucht/absagt – ohne dass anon jemals direkten (RLS-pflichtigen)
-- Lesezugriff auf die Tabelle "registrations" braucht.
-- (CLAUDE-Vorgabe Abschnitt 40)
-- ============================================================

create or replace function broadcast_shift_status(p_shift_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  select to_jsonb(s.*) into v_payload
  from shift_public_status s
  where s.shift_id = p_shift_id;

  if v_payload is not null then
    perform realtime.send(v_payload, 'status', 'shift-status', false);
  end if;
exception
  when undefined_function or invalid_schema_name then
    -- Realtime-"Broadcast from Database" ist auf diesem Supabase-Projekt
    -- (noch) nicht verfügbar. Die Buchung selbst darf dadurch niemals
    -- fehlschlagen – das Frontend nutzt dann automatisch den Polling-
    -- Fallback (siehe src/hooks/useLiveShiftStatus.ts).
    null;
end;
$$;

create or replace function trg_broadcast_shift_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform broadcast_shift_status(old.shift_id);
    return old;
  end if;

  perform broadcast_shift_status(new.shift_id);

  if tg_op = 'UPDATE' and old.shift_id is distinct from new.shift_id then
    perform broadcast_shift_status(old.shift_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_registrations_broadcast on registrations;
create trigger trg_registrations_broadcast
  after insert or update or delete on registrations
  for each row execute function trg_broadcast_shift_status();

create or replace function trg_broadcast_shift_status_on_shift()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform broadcast_shift_status(new.id);
  return new;
end;
$$;

drop trigger if exists trg_shifts_broadcast on shifts;
create trigger trg_shifts_broadcast
  after update on shifts
  for each row execute function trg_broadcast_shift_status_on_shift();
