-- ============================================================
-- 0001_init.sql
-- Grundschema: Events, Schichten, Helfer, Anmeldungen, Profile,
-- Audit-Log, Einstellungen.
-- ============================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid(), gen_random_bytes()

-- ------------------------------------------------------------
-- events
-- ------------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_date date not null,
  end_date date not null,
  active boolean not null default true,
  registration_deadline timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint events_dates_valid check (end_date >= start_date)
);

comment on table events is 'Eine Helfer-Veranstaltung, z. B. der Weltcup 2026.';
comment on column events.registration_deadline is 'Optionaler Anmeldeschluss. Technisch vorbereitet, siehe CLAUDE-Vorgabe Abschnitt 73.';

-- ------------------------------------------------------------
-- shifts
-- ------------------------------------------------------------
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  date date not null,
  name text not null,
  start_time time not null,
  end_time time not null,
  capacity int not null default 4,
  status text not null default 'open',
  manually_locked boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_capacity_positive check (capacity > 0),
  constraint shifts_status_valid check (status in ('open', 'closed', 'cancelled')),
  constraint shifts_time_valid check (end_time > start_time)
);

create index if not exists idx_shifts_event_id on shifts (event_id);
create index if not exists idx_shifts_date on shifts (date);

comment on table shifts is 'Feste Schichtzeiten pro Tag, siehe CLAUDE-Vorgabe Abschnitt 2 und 67 (Zeiten sind fest, nicht berechnen).';
comment on column shifts.manually_locked is 'Admin kann eine Schicht sperren, auch wenn Kapazität nicht erreicht ist.';

-- ------------------------------------------------------------
-- helpers
-- ------------------------------------------------------------
create table if not exists helpers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  notes text,
  edit_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint helpers_first_name_not_blank check (btrim(first_name) <> ''),
  constraint helpers_last_name_not_blank check (btrim(last_name) <> ''),
  constraint helpers_contact_required check (
    (email is not null and btrim(email) <> '') or (phone is not null and btrim(phone) <> '')
  )
);

create unique index if not exists idx_helpers_edit_token on helpers (edit_token);
create index if not exists idx_helpers_last_name on helpers (last_name);
create index if not exists idx_helpers_email on helpers (email);
create index if not exists idx_helpers_phone on helpers (phone);

comment on column helpers.edit_token is 'Zufälliger, nicht erratbarer Token (256 Bit) für den persönlichen Änderungslink.';

-- ------------------------------------------------------------
-- registrations
-- ------------------------------------------------------------
create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  helper_id uuid not null references helpers(id) on delete cascade,
  shift_id uuid not null references shifts(id) on delete cascade,
  status text not null default 'active',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint registrations_status_valid check (status in ('active', 'cancelled', 'waitlist'))
);

create index if not exists idx_registrations_shift_id on registrations (shift_id);
create index if not exists idx_registrations_helper_id on registrations (helper_id);
create index if not exists idx_registrations_status on registrations (status);

-- Verhindert doppelte AKTIVE Anmeldung derselben Person für dieselbe Schicht
-- (CLAUDE-Vorgabe Abschnitt 54). Cancelled-Einträge blockieren eine erneute
-- Anmeldung bewusst nicht.
create unique index if not exists uq_registrations_active_helper_shift
  on registrations (helper_id, shift_id)
  where (status = 'active');

comment on table registrations is 'Buchung eines Helfers für eine Schicht. Absage setzt status=cancelled statt Löschung.';

-- ------------------------------------------------------------
-- profiles (Rollen für Adminbereich, verknüpft mit auth.users)
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  constraint profiles_role_valid check (role in ('admin', 'viewer'))
);

comment on table profiles is 'Rollenzuordnung für Supabase-Auth-Benutzer im Adminbereich. admin=voller Zugriff, viewer=nur lesen/exportieren.';

-- ------------------------------------------------------------
-- audit_logs
-- ------------------------------------------------------------
create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  admin_user text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on audit_logs (created_at desc);

-- ------------------------------------------------------------
-- settings (zentrale Konfiguration, redaktionell änderbar)
-- ------------------------------------------------------------
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table settings is 'Zentrale Konfigurationswerte (Feature-Flags, Texte), siehe CLAUDE-Vorgabe Abschnitt 65.';

-- ------------------------------------------------------------
-- updated_at Trigger
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_shifts_updated_at on shifts;
create trigger trg_shifts_updated_at before update on shifts
  for each row execute function set_updated_at();

drop trigger if exists trg_helpers_updated_at on helpers;
create trigger trg_helpers_updated_at before update on helpers
  for each row execute function set_updated_at();

drop trigger if exists trg_registrations_updated_at on registrations;
create trigger trg_registrations_updated_at before update on registrations
  for each row execute function set_updated_at();
