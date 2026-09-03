-- ============================================================
-- 0002_rls.sql
-- Row Level Security. Grundprinzip:
--   - Basistabellen (helpers, registrations, events, shifts, ...)
--     sind für anon/authenticated komplett gesperrt.
--   - Öffentliche Lesezugriffe laufen ausschließlich über die
--     View "shift_public_status" (keine personenbezogenen Daten).
--   - Alle schreibenden Helfer-Aktionen (Anmeldung, Änderung,
--     Absage) laufen ausschließlich über SECURITY DEFINER
--     Funktionen (siehe 0003_functions.sql), niemals über
--     direkte Tabellenzugriffe.
--   - Der Adminbereich nutzt serverseitig den Service-Role-Key
--     (umgeht RLS) und prüft Rollen selbst gegen "profiles".
-- ============================================================

alter table events enable row level security;
alter table shifts enable row level security;
alter table helpers enable row level security;
alter table registrations enable row level security;
alter table profiles enable row level security;
alter table audit_logs enable row level security;
alter table settings enable row level security;

-- Keine Policies fuer anon/authenticated auf den Basistabellen ->
-- Standardverhalten von RLS ist "deny all" ohne passende Policy.

-- Eine eingeloggte Person darf ausschliesslich ihr eigenes Profil lesen
-- (wird von der Admin-UI genutzt, um die eigene Rolle zu bestimmen).
create policy profiles_select_own on profiles
  for select
  to authenticated
  using (id = auth.uid());

-- ------------------------------------------------------------
-- Öffentliche, sichere aggregierte Ansicht
-- ------------------------------------------------------------
-- Views laufen in PostgreSQL standardmäßig mit den Rechten des
-- Eigentümers (security_invoker = false), der Eigentümer (Migrations-
-- Rolle) besitzt auch die Basistabellen und ist daher von RLS
-- ausgenommen. So kann anon lesen, ohne dass RLS umgangen werden muss.
create or replace view shift_public_status
with (security_invoker = false)
as
select
  s.id as shift_id,
  s.event_id,
  s.date,
  s.name,
  s.start_time,
  s.end_time,
  s.capacity,
  s.status,
  s.manually_locked,
  s.sort_order,
  coalesce(active.active_count, 0)::int as active_count,
  greatest(s.capacity - coalesce(active.active_count, 0), 0)::int as available_count,
  (coalesce(active.active_count, 0) >= s.capacity) as is_full,
  coalesce(waitlist.waitlist_count, 0)::int as waitlist_count
from shifts s
left join (
  select shift_id, count(*) as active_count
  from registrations
  where status = 'active'
  group by shift_id
) active on active.shift_id = s.id
left join (
  select shift_id, count(*) as waitlist_count
  from registrations
  where status = 'waitlist'
  group by shift_id
) waitlist on waitlist.shift_id = s.id
join events e on e.id = s.event_id
where e.active = true and e.archived = false;

grant select on shift_public_status to anon, authenticated;

comment on view shift_public_status is 'Öffentliche, aggregierte Belegungsansicht ohne personenbezogene Daten. Siehe CLAUDE-Vorgabe Abschnitt 41.';

-- Öffentliche Sicht auf aktive Events (nur Titel/Datum, keine PII)
create or replace view event_public_info
with (security_invoker = false)
as
select id, title, start_date, end_date, registration_deadline
from events
where active = true and archived = false;

grant select on event_public_info to anon, authenticated;

-- Öffentlich unbedenkliche Einstellungen (keine PII, keine Secrets)
create or replace view public_settings
with (security_invoker = false)
as
select
  coalesce((select value from settings where key = 'waitlist_enabled'), 'false'::jsonb) as waitlist_enabled,
  coalesce((select value from settings where key = 'public_first_names_enabled'), 'false'::jsonb) as public_first_names_enabled,
  coalesce((select value from settings where key = 'privacy_notice_short'), '""'::jsonb) as privacy_notice_short;

grant select on public_settings to anon, authenticated;
