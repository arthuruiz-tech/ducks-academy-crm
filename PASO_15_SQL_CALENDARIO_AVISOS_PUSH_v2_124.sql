-- DUCKS CRM v2.124
-- CALENDARIO Y AVISOS PARA PAPÁS + CAMPANITA + SUSCRIPCIONES PUSH
-- Ejecutar UNA SOLA VEZ en Supabase > SQL Editor antes de publicar la v2.124.
-- Es idempotente: puede volver a ejecutarse si una ejecución se interrumpe.
-- NO borra jugadores, pagos, comprobantes, cuentas, contraseñas ni relaciones familiares.

begin;

create extension if not exists pgcrypto;

-- 1) Publicaciones creadas por el administrador.
create table if not exists public.portal_announcements_v124 (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'notice' check (kind in ('notice','event')),
  title text not null,
  message text not null,
  event_date date,
  event_time time,
  location text,
  priority text not null default 'normal' check (priority in ('normal','important','urgent')),
  active boolean not null default true,
  publish_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_announcements_v124_created_idx
  on public.portal_announcements_v124(created_at desc);
create index if not exists portal_announcements_v124_event_idx
  on public.portal_announcements_v124(event_date, event_time);
create index if not exists portal_announcements_v124_visible_idx
  on public.portal_announcements_v124(active, publish_at, expires_at);

alter table public.portal_announcements_v124 enable row level security;

drop policy if exists "admin manage portal announcements v124" on public.portal_announcements_v124;
create policy "admin manage portal announcements v124"
on public.portal_announcements_v124
for all
to authenticated
using (true)
with check (true);

-- Los avisos son información general para las familias. Esta lectura permite
-- que Supabase Realtime avise al portal mientras la aplicación está abierta.
drop policy if exists "parents read active portal announcements v124" on public.portal_announcements_v124;
create policy "parents read active portal announcements v124"
on public.portal_announcements_v124
for select
to anon
using (
  active = true
  and publish_at <= now()
  and (expires_at is null or expires_at >= now())
);

grant select on public.portal_announcements_v124 to anon;
grant select, insert, update, delete on public.portal_announcements_v124 to authenticated;

-- 2) Estado leído/no leído por cuenta familiar.
create table if not exists public.parent_announcement_reads_v124 (
  announcement_id uuid not null references public.portal_announcements_v124(id) on delete cascade,
  parent_account_id text not null,
  read_at timestamptz not null default now(),
  primary key (announcement_id, parent_account_id)
);

create index if not exists parent_announcement_reads_v124_parent_idx
  on public.parent_announcement_reads_v124(parent_account_id, read_at desc);

alter table public.parent_announcement_reads_v124 enable row level security;

drop policy if exists "admin manage parent announcement reads v124" on public.parent_announcement_reads_v124;
create policy "admin manage parent announcement reads v124"
on public.parent_announcement_reads_v124
for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.parent_announcement_reads_v124 to authenticated;

-- 3) Suscripciones Push de los dispositivos de los papás.
create table if not exists public.parent_push_subscriptions_v124 (
  id uuid primary key default gen_random_uuid(),
  parent_account_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  subscription jsonb not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists parent_push_subscriptions_v124_parent_idx
  on public.parent_push_subscriptions_v124(parent_account_id, active);

alter table public.parent_push_subscriptions_v124 enable row level security;

drop policy if exists "admin manage parent push subscriptions v124" on public.parent_push_subscriptions_v124;
create policy "admin manage parent push subscriptions v124"
on public.parent_push_subscriptions_v124
for all
to authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.parent_push_subscriptions_v124 to authenticated;

-- 4) Obtener avisos en el Portal de Papás validando la sesión privada.
create or replace function public.ducks_parent_announcements_v124(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base jsonb;
  v_account_id text;
  v_rows jsonb := '[]'::jsonb;
begin
  v_base := public.ducks_parent_portal_v213(p_token);
  if v_base is null or coalesce((v_base->>'ok')::boolean,false)=false then
    return coalesce(v_base,jsonb_build_object('ok',false,'message','Sesión inválida'));
  end if;

  v_account_id := v_base->'account'->>'id';
  if coalesce(v_account_id,'')='' then
    return jsonb_build_object('ok',false,'message','La sesión no contiene una cuenta válida.');
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by
           case x.priority when 'urgent' then 1 when 'important' then 2 else 3 end,
           x.event_date asc nulls last,
           x.publish_at desc),'[]'::jsonb)
    into v_rows
  from (
    select a.*, r.read_at
    from public.portal_announcements_v124 a
    left join public.parent_announcement_reads_v124 r
      on r.announcement_id=a.id and r.parent_account_id=v_account_id
    where a.active=true
      and a.publish_at<=now()
      and (a.expires_at is null or a.expires_at>=now())
  ) x;

  return jsonb_build_object('ok',true,'announcements',v_rows);
end;
$$;

grant execute on function public.ducks_parent_announcements_v124(text) to anon, authenticated;

-- 5) Marcar una publicación como leída para una familia.
create or replace function public.ducks_parent_mark_announcement_read_v124(
  p_token text,
  p_announcement_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base jsonb;
  v_account_id text;
begin
  v_base := public.ducks_parent_portal_v213(p_token);
  if v_base is null or coalesce((v_base->>'ok')::boolean,false)=false then
    return coalesce(v_base,jsonb_build_object('ok',false,'message','Sesión inválida'));
  end if;

  v_account_id := v_base->'account'->>'id';
  if not exists(select 1 from public.portal_announcements_v124 where id=p_announcement_id) then
    return jsonb_build_object('ok',false,'message','Aviso no encontrado.');
  end if;

  insert into public.parent_announcement_reads_v124(announcement_id,parent_account_id,read_at)
  values(p_announcement_id,v_account_id,now())
  on conflict(announcement_id,parent_account_id)
  do update set read_at=excluded.read_at;

  return jsonb_build_object('ok',true);
end;
$$;

grant execute on function public.ducks_parent_mark_announcement_read_v124(text,uuid) to anon, authenticated;

-- 6) Registrar el dispositivo para Push en segundo plano.
create or replace function public.ducks_parent_save_push_subscription_v124(
  p_token text,
  p_subscription jsonb,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base jsonb;
  v_account_id text;
  v_endpoint text;
  v_p256dh text;
  v_auth text;
begin
  v_base := public.ducks_parent_portal_v213(p_token);
  if v_base is null or coalesce((v_base->>'ok')::boolean,false)=false then
    return coalesce(v_base,jsonb_build_object('ok',false,'message','Sesión inválida'));
  end if;

  v_account_id := v_base->'account'->>'id';
  v_endpoint := p_subscription->>'endpoint';
  v_p256dh := p_subscription->'keys'->>'p256dh';
  v_auth := p_subscription->'keys'->>'auth';

  if coalesce(v_endpoint,'')='' or coalesce(v_p256dh,'')='' or coalesce(v_auth,'')='' then
    return jsonb_build_object('ok',false,'message','Suscripción Push incompleta.');
  end if;

  insert into public.parent_push_subscriptions_v124(
    parent_account_id,endpoint,p256dh,auth,subscription,user_agent,active,last_seen_at
  ) values(
    v_account_id,v_endpoint,v_p256dh,v_auth,p_subscription,left(coalesce(p_user_agent,''),1000),true,now()
  )
  on conflict(endpoint) do update set
    parent_account_id=excluded.parent_account_id,
    p256dh=excluded.p256dh,
    auth=excluded.auth,
    subscription=excluded.subscription,
    user_agent=excluded.user_agent,
    active=true,
    last_seen_at=now();

  return jsonb_build_object('ok',true);
end;
$$;

grant execute on function public.ducks_parent_save_push_subscription_v124(text,jsonb,text) to anon, authenticated;

-- 7) Realtime para que los avisos aparezcan inmediatamente mientras el portal está abierto.
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname='supabase_realtime'
         and schemaname='public'
         and tablename='portal_announcements_v124'
     ) then
    execute 'alter publication supabase_realtime add table public.portal_announcements_v124';
  end if;
end $$;

commit;

select 'OK - v2.124: calendario, avisos, campanita y suscripciones Push instaladas' as resultado;
