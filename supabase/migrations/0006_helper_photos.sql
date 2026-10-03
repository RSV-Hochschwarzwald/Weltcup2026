-- ============================================================
-- 0006_helper_photos.sql
-- Optionales Foto je Helfer für die Akkreditierung (Weltcup).
-- Die Bilder liegen in einem PRIVATEN Storage-Bucket ohne jede
-- Policy für anon/authenticated: Zugriff ausschließlich über die
-- Server-Routen mit dem Service-Role-Key (Upload per Edit-Token bzw.
-- durch Admins, Download nur im Adminbereich).
-- ============================================================

alter table helpers
  add column if not exists photo_path text,
  add column if not exists photo_uploaded_at timestamptz;

comment on column helpers.photo_path is 'Objektpfad im privaten Bucket helper-photos. Nie öffentlich ausliefern.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('helper-photos', 'helper-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Eigene Anmeldung über Token: zusätzlich zurückgeben, ob schon ein Foto vorliegt
-- (nur ein Ja/Nein, niemals der Pfad).
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
      'notes', v_helper.notes,
      'has_photo', v_helper.photo_path is not null
    ),
    'registrations', v_registrations
  );
end;
$$;

revoke all on function get_registration_by_token(text) from public;
grant execute on function get_registration_by_token(text) to anon, authenticated;
