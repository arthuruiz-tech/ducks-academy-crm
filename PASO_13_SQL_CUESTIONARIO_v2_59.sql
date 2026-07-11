-- DUCKS CRM PROFESIONAL v2.59
-- Cuestionario digital propio + solicitudes de ingreso.
-- Este script NO elimina ni modifica jugadores, pagos, adeudos, comprobantes o historial existente.

begin;

-- 1) Solicitudes enviadas desde la página pública.
create table if not exists public.registration_applications_v259 (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  submitted_at timestamptz not null default now(),
  child_name text not null,
  birth_date date not null,
  gender text not null,
  parent_name text not null,
  parent_phone text not null,
  parent_email text,
  consent_name text not null,
  consent boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  medical_alert boolean not null default false,
  status text not null default 'Pendiente'
    check (status in ('Pendiente','En revisión','Convertida','Rechazada')),
  reviewed_at timestamptz,
  converted_player_id text
);

create index if not exists registration_applications_v259_submitted_idx
  on public.registration_applications_v259(submitted_at desc);
create index if not exists registration_applications_v259_status_idx
  on public.registration_applications_v259(status, submitted_at desc);

alter table public.registration_applications_v259 enable row level security;

drop policy if exists "admin manage registration applications v259"
  on public.registration_applications_v259;
create policy "admin manage registration applications v259"
on public.registration_applications_v259
for all
to authenticated
using (true)
with check (true);

-- La tabla NO queda abierta para lectura pública. Los padres solo pueden enviar
-- mediante la función segura definida más abajo.
revoke all on public.registration_applications_v259 from anon;
grant select, insert, update, delete on public.registration_applications_v259 to authenticated;

-- 2) Asegurar que el centro de avisos acepte solicitudes de ingreso.
create table if not exists public.admin_notifications_v257 (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  player_id text,
  payment_id text,
  event_key text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.admin_notifications_v257
  drop constraint if exists admin_notifications_v257_type_check;
alter table public.admin_notifications_v257
  add constraint admin_notifications_v257_type_check
  check (type in ('birthday','payment','evidence','registration'));

alter table public.admin_notifications_v257 enable row level security;
drop policy if exists "admin manage notifications v257" on public.admin_notifications_v257;
create policy "admin manage notifications v257"
on public.admin_notifications_v257
for all
to authenticated
using (true)
with check (true);

-- 3) Función pública segura para enviar el cuestionario.
create or replace function public.submit_ducks_registration_v259(p_payload jsonb)
returns table(id uuid, folio text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := gen_random_uuid();
  v_folio text;
  v_child_name text := trim(coalesce(p_payload->>'child_name',''));
  v_birth_date date;
  v_gender text := trim(coalesce(p_payload->>'gender',''));
  v_parent_name text := trim(coalesce(p_payload->>'parent_name',''));
  v_parent_phone text := trim(coalesce(p_payload->>'parent_phone',''));
  v_parent_email text := nullif(trim(coalesce(p_payload->>'parent_email','')),'');
  v_consent_name text := trim(coalesce(p_payload->>'consent_name',''));
  v_consent boolean := coalesce((p_payload->>'consent')::boolean,false);
  v_answers jsonb := coalesce(p_payload->'answers','{}'::jsonb);
  v_sleep integer := coalesce((v_answers->>'sleep_hours')::integer,0);
  v_activity integer := coalesce((v_answers->>'activity_days')::integer,0);
  v_medical_alert boolean := false;
begin
  if length(v_child_name) < 3 or length(v_child_name) > 140 then
    raise exception 'Captura el nombre completo del jugador.';
  end if;

  begin
    v_birth_date := (p_payload->>'birth_date')::date;
  exception when others then
    raise exception 'La fecha de nacimiento no es válida.';
  end;

  if v_birth_date > (now() at time zone 'America/Mexico_City')::date then
    raise exception 'La fecha de nacimiento no puede ser futura.';
  end if;

  if v_gender not in ('Femenino','Masculino','Prefiero no especificar') then
    raise exception 'Selecciona el género.';
  end if;

  if length(v_parent_name) < 3 or length(v_parent_name) > 140 then
    raise exception 'Captura el nombre del padre, madre o tutor.';
  end if;

  if length(regexp_replace(v_parent_phone,'[^0-9]','','g')) < 10 then
    raise exception 'Captura un WhatsApp válido.';
  end if;

  if length(v_consent_name) < 3 or not v_consent then
    raise exception 'Es necesario aceptar y firmar el consentimiento.';
  end if;

  if v_sleep < 1 or v_sleep > 10 then
    raise exception 'Selecciona las horas de sueño.';
  end if;

  if v_activity < 1 or v_activity > 7 then
    raise exception 'Selecciona los días de actividad física.';
  end if;

  -- Marca para revisión cuando existe alguna respuesta médica relevante.
  v_medical_alert :=
    coalesce((v_answers->>'chronic_condition')::boolean,false)
    or coalesce((v_answers->>'recent_injury')::boolean,false)
    or coalesce((v_answers->>'regular_medication')::boolean,false)
    or coalesce((v_answers->>'chest_pain')::boolean,false)
    or coalesce((v_answers->>'fainting_dizziness')::boolean,false)
    or coalesce((v_answers->>'physical_limitation')::boolean,false)
    or coalesce((v_answers->>'other_concern')::boolean,false);

  v_folio := 'DUCKS-' ||
    to_char(now() at time zone 'America/Mexico_City','YYYYMMDD') || '-' ||
    upper(substr(replace(v_id::text,'-',''),1,6));

  insert into public.registration_applications_v259(
    id, folio, child_name, birth_date, gender,
    parent_name, parent_phone, parent_email,
    consent_name, consent, answers, medical_alert
  ) values (
    v_id, v_folio, v_child_name, v_birth_date, v_gender,
    v_parent_name, v_parent_phone, v_parent_email,
    v_consent_name, v_consent, v_answers, v_medical_alert
  );

  insert into public.admin_notifications_v257(
    type, title, message, event_key
  ) values (
    'registration',
    'Nueva solicitud de ingreso',
    v_parent_name || ' envió el cuestionario de ingreso de ' || v_child_name ||
      case when v_medical_alert then '. Requiere revisar información médica.' else '.' end,
    'registration:' || v_id::text
  ) on conflict (event_key) do nothing;

  return query select v_id, v_folio;
end;
$$;

revoke all on function public.submit_ducks_registration_v259(jsonb) from public;
grant execute on function public.submit_ducks_registration_v259(jsonb) to anon, authenticated;

-- 4) Avisos en tiempo real para solicitudes nuevas.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'registration_applications_v259'
     ) then
    execute 'alter publication supabase_realtime add table public.registration_applications_v259';
  end if;
end $$;

commit;

select 'OK - v2.59: cuestionario digital y solicitudes instalados correctamente' as resultado;
