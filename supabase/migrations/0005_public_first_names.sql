-- ============================================================
-- 0005_public_first_names.sql
-- Setzt die in Abschnitt 9 der CLAUDE-Vorgabe vorgesehene Einstellung
-- "Vornamen öffentlich anzeigen" tatsächlich um. Wenn aktiviert, liefert
-- shift_public_status zusätzlich die Vornamen der aktiv angemeldeten
-- Helfer je Schicht - NIEMALS Nachnamen, Telefon, E-Mail oder Bemerkung.
-- Ist die Einstellung deaktiviert, bleibt die Spalte ein leeres Array.
-- ============================================================

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
  coalesce(waitlist.waitlist_count, 0)::int as waitlist_count,
  case
    when coalesce((select value from settings where key = 'public_first_names_enabled'), 'false'::jsonb) = 'true'::jsonb
      then coalesce(names.first_names, '{}'::text[])
    else '{}'::text[]
  end as first_names
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
left join (
  select r.shift_id, array_agg(h.first_name order by r.created_at) as first_names
  from registrations r
  join helpers h on h.id = r.helper_id
  where r.status = 'active'
  group by r.shift_id
) names on names.shift_id = s.id
join events e on e.id = s.event_id
where e.active = true and e.archived = false;

grant select on shift_public_status to anon, authenticated;

comment on view shift_public_status is 'Öffentliche, aggregierte Belegungsansicht. first_names nur gefüllt, wenn settings.public_first_names_enabled = true, siehe CLAUDE-Vorgabe Abschnitt 9/41.';
