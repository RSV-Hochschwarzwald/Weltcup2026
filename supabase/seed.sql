-- ============================================================
-- seed.sql
-- Initialdaten für den Weltcup Skispringen Titisee-Neustadt 2026.
-- Zeiten sind FEST vorgegeben (CLAUDE-Vorgabe Abschnitt 67) und
-- dürfen nicht automatisch berechnet werden.
-- ============================================================

insert into events (id, title, start_date, end_date, active)
values (
  '00000000-0000-0000-0000-000000000001',
  'Weltcup Skispringen Titisee-Neustadt 2026',
  '2026-12-11',
  '2026-12-13',
  true
)
on conflict (id) do nothing;

insert into shifts (event_id, date, name, start_time, end_time, capacity, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', '2026-12-11', 'Schicht 1', '11:00', '15:15', 4, 1),
  ('00000000-0000-0000-0000-000000000001', '2026-12-11', 'Schicht 2', '15:00', '19:15', 4, 2),
  ('00000000-0000-0000-0000-000000000001', '2026-12-12', 'Schicht 1', '09:00', '13:45', 4, 3),
  ('00000000-0000-0000-0000-000000000001', '2026-12-12', 'Schicht 2', '13:30', '18:15', 4, 4),
  ('00000000-0000-0000-0000-000000000001', '2026-12-13', 'Schicht 1', '11:00', '15:15', 4, 5),
  ('00000000-0000-0000-0000-000000000001', '2026-12-13', 'Schicht 2', '15:00', '19:15', 4, 6)
on conflict do nothing;

insert into settings (key, value) values
  ('waitlist_enabled', 'false'),
  ('public_first_names_enabled', 'false'),
  ('notify_on_shift_full', 'true'),
  ('email_confirmation_subject', '"Deine Helferanmeldung – Weltcup Skispringen 2026"'),
  ('email_confirmation_intro', '"vielen Dank für deine Unterstützung beim Weltcup Skispringen in Titisee-Neustadt."'),
  ('privacy_notice_short', '"Deine Daten werden ausschließlich zur Organisation des Helfereinsatzes beim Weltcup Skispringen verwendet."')
on conflict (key) do nothing;
