-- DUCKS CRM PROFESIONAL v2.57
-- Fechas reales de nacimiento e ingreso + avisos administrativos.
-- Este script NO borra jugadores, pagos, comprobantes, adeudos ni historial.

begin;

-- 1) Fecha de nacimiento en jugadores.
alter table public.players
  add column if not exists birth_date date;

-- 2) Cargar las fechas originales del archivo CRM_Ducks_Completo_Final.xlsx.
-- Solo actualiza D001 a D046; no toca jugadores creados posteriormente.
-- En D045 el archivo mostraba 1905-07-06, pero la edad y categoría confirman 2015-07-06.
with original_dates(id, birth_date, registration_date) as (
  values
    ('D001', date '2016-11-16', date '2024-07-16'),
    ('D002', date '2015-12-19', date '2024-07-18'),
    ('D003', date '2012-04-27', date '2024-07-18'),
    ('D004', date '2017-05-06', date '2024-07-25'),
    ('D005', date '2017-09-02', date '2024-07-29'),
    ('D006', date '2017-07-22', date '2024-09-03'),
    ('D007', date '2014-05-14', date '2024-09-03'),
    ('D008', date '2013-07-24', date '2024-09-19'),
    ('D009', date '2016-07-04', date '2024-09-19'),
    ('D010', date '2018-12-29', date '2024-12-03'),
    ('D011', date '2016-05-19', date '2024-12-03'),
    ('D012', date '2015-01-22', date '2024-12-07'),
    ('D013', date '2017-04-22', date '2024-12-07'),
    ('D014', date '2013-04-15', date '2025-03-15'),
    ('D015', date '2020-08-04', date '2025-04-30'),
    ('D016', date '2014-07-16', date '2025-05-27'),
    ('D017', date '2016-01-12', date '2025-08-05'),
    ('D018', date '2018-09-08', date '2025-09-29'),
    ('D019', date '2014-01-17', date '2025-10-01'),
    ('D020', date '2014-06-02', date '2025-10-11'),
    ('D021', date '2015-05-25', date '2025-10-11'),
    ('D022', date '2015-05-25', date '2025-10-11'),
    ('D023', date '2012-12-31', date '2025-10-11'),
    ('D024', date '2016-09-06', date '2026-01-01'),
    ('D025', date '2018-01-02', date '2026-01-01'),
    ('D026', date '2011-12-30', date '2026-01-01'),
    ('D027', date '2017-10-06', date '2026-01-01'),
    ('D028', date '2018-10-21', date '2026-01-01'),
    ('D029', date '2014-12-05', date '2026-02-01'),
    ('D030', date '2018-02-28', date '2026-02-01'),
    ('D031', date '2014-09-12', date '2026-02-01'),
    ('D032', date '2019-12-05', date '2026-03-01'),
    ('D033', date '2014-11-27', date '2026-03-01'),
    ('D034', date '2017-07-01', date '2026-03-01'),
    ('D035', date '2013-11-29', date '2026-02-01'),
    ('D036', date '2013-05-17', date '2026-03-19'),
    ('D037', date '2014-01-13', date '2026-03-19'),
    ('D038', date '2013-04-07', date '2026-04-16'),
    ('D039', null::date, date '2026-04-30'),
    ('D040', date '2020-08-11', date '2026-05-09'),
    ('D041', date '2017-04-22', date '2026-05-09'),
    ('D042', date '2012-12-31', date '2026-06-09'),
    ('D043', date '2016-01-10', date '2026-06-11'),
    ('D044', date '2018-06-18', date '2026-06-11'),
    ('D045', date '2015-07-06', date '2026-07-01'),
    ('D046', date '2016-01-01', date '2026-06-15')
)
update public.players p
set
  birth_date = d.birth_date,
  registration_date = d.registration_date
from original_dates d
where p.id = d.id;

-- 3) Tabla persistente de avisos para el administrador.
create table if not exists public.admin_notifications_v257 (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('birthday','payment','evidence')),
  title text not null,
  message text not null,
  player_id text,
  payment_id text,
  event_key text not null unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists admin_notifications_v257_created_idx
  on public.admin_notifications_v257(created_at desc);
create index if not exists admin_notifications_v257_unread_idx
  on public.admin_notifications_v257(read_at)
  where read_at is null;

alter table public.admin_notifications_v257 enable row level security;

drop policy if exists "admin manage notifications v257" on public.admin_notifications_v257;
create policy "admin manage notifications v257"
on public.admin_notifications_v257
for all
to authenticated
using (true)
with check (true);

-- 4) Avisos automáticos cuando un papá/tutor reporta un pago o sube evidencia.
create or replace function public.ducks_payment_notification_v257()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submitted_by text := trim(coalesce(new.submitted_by,''));
  v_is_parent boolean := lower(v_submitted_by) <> 'admin';
  v_student text := coalesce(nullif(new.student_name,''), new.player_id, 'Jugador');
begin
  if tg_op = 'INSERT' and v_is_parent then
    insert into public.admin_notifications_v257(
      type,title,message,player_id,payment_id,event_key
    ) values (
      'payment',
      'Pago reportado por un papá',
      coalesce(nullif(v_submitted_by,''),'Un papá/tutor') ||
        ' reportó un pago de $' || trim(to_char(coalesce(new.amount,0),'FM999999990.00')) ||
        ' para ' || v_student || '.',
      new.player_id,
      new.id::text,
      'payment:' || new.id::text
    ) on conflict (event_key) do nothing;

    if coalesce(new.evidence_url,'') <> '' then
      insert into public.admin_notifications_v257(
        type,title,message,player_id,payment_id,event_key
      ) values (
        'evidence',
        'Nueva evidencia de pago',
        coalesce(nullif(v_submitted_by,''),'Un papá/tutor') ||
          ' subió un comprobante de pago para ' || v_student || '.',
        new.player_id,
        new.id::text,
        'evidence:' || new.id::text
      ) on conflict (event_key) do nothing;
    end if;
  end if;

  if tg_op = 'UPDATE'
     and v_is_parent
     and coalesce(old.evidence_url,'') = ''
     and coalesce(new.evidence_url,'') <> '' then
    insert into public.admin_notifications_v257(
      type,title,message,player_id,payment_id,event_key
    ) values (
      'evidence',
      'Nueva evidencia de pago',
      coalesce(nullif(v_submitted_by,''),'Un papá/tutor') ||
        ' agregó un comprobante de pago para ' || v_student || '.',
      new.player_id,
      new.id::text,
      'evidence:' || new.id::text
    ) on conflict (event_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ducks_payment_notification_v257 on public.payments;
create trigger trg_ducks_payment_notification_v257
after insert or update of evidence_url on public.payments
for each row execute function public.ducks_payment_notification_v257();

-- 5) Crear una alerta el día del cumpleaños usando horario de Aguascalientes.
create or replace function public.ducks_refresh_birthday_notifications_v257()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Mexico_City')::date;
  v_count integer := 0;
begin
  insert into public.admin_notifications_v257(
    type,title,message,player_id,event_key
  )
  select
    'birthday',
    'Cumpleaños de ' || p.name,
    'Hoy ' || p.name || ' cumple ' ||
      extract(year from age(v_today,p.birth_date))::integer ||
      ' años. ¡No olvides felicitarle!',
    p.id,
    'birthday:' || v_today::text || ':' || p.id
  from public.players p
  where lower(coalesce(p.status,'')) = 'activo'
    and p.birth_date is not null
    and extract(month from p.birth_date) = extract(month from v_today)
    and extract(day from p.birth_date) = extract(day from v_today)
  on conflict (event_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.ducks_refresh_birthday_notifications_v257() to authenticated;

-- 6) Activar avisos en tiempo real mientras el CRM está abierto.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'admin_notifications_v257'
     ) then
    execute 'alter publication supabase_realtime add table public.admin_notifications_v257';
  end if;
end $$;

commit;

select 'OK - v2.57: fechas reales y avisos instalados correctamente' as resultado;
