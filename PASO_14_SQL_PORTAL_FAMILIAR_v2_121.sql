-- DUCKS CRM PROFESIONAL v2.121
-- PORTAL FAMILIAR: TODOS LOS JUGADORES LIGADOS + REPARACION ARELY/EMILY
-- Ejecutar UNA SOLA VEZ en Supabase > SQL Editor antes de publicar la carpeta v2.121.
-- Este script NO borra jugadores, pagos, comprobantes, historial ni cuentas.

begin;

-- 1) Elimina solamente relaciones duplicadas exactas, conservando la más reciente.
with ranked as (
  select id,
         row_number() over (
           partition by parent_account_id, player_id
           order by active desc, created_at desc nulls last, id desc
         ) as rn
  from public.parent_player_links_v213
)
delete from public.parent_player_links_v213 l
using ranked r
where l.id=r.id and r.rn>1;

-- 2) Evita que vuelvan a crearse relaciones duplicadas.
create unique index if not exists parent_player_links_v213_account_player_uidx
  on public.parent_player_links_v213(parent_account_id, player_id);

-- 3) Reparación dirigida para Arely (D013) y Emily (D012).
-- Si cualquiera de las dos ya está ligada a una cuenta, ambas quedarán activas en esa misma cuenta.
with selected_account as (
  select parent_account_id
  from public.parent_player_links_v213
  where player_id in ('D012','D013')
  group by parent_account_id
  order by count(*) desc,
           bool_or(active) desc,
           max(created_at) desc nulls last
  limit 1
)
update public.parent_player_links_v213 l
set active=true
from selected_account a
where l.parent_account_id=a.parent_account_id
  and l.player_id in ('D012','D013');

with selected_account as (
  select parent_account_id
  from public.parent_player_links_v213
  where player_id in ('D012','D013')
  group by parent_account_id
  order by count(*) desc,
           bool_or(active) desc,
           max(created_at) desc nulls last
  limit 1
), required_players(player_id) as (
  values ('D012'::text),('D013'::text)
)
insert into public.parent_player_links_v213(parent_account_id,player_id,active)
select a.parent_account_id,p.player_id,true
from selected_account a
cross join required_players p
where not exists (
  select 1 from public.parent_player_links_v213 l
  where l.parent_account_id=a.parent_account_id and l.player_id=p.player_id
);

-- 4) Portal v2.121. Reutiliza la autenticación existente de v2.13,
-- pero reconstruye "players" y "payments" con TODAS las relaciones activas.
create or replace function public.ducks_parent_portal_v2121(p_token text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_base jsonb;
  v_account_id text;
  v_players jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
begin
  v_base := public.ducks_parent_portal_v213(p_token);

  if v_base is null or coalesce((v_base->>'ok')::boolean,false)=false then
    return coalesce(v_base,jsonb_build_object('ok',false,'message','Sesión inválida'));
  end if;

  v_account_id := v_base->'account'->>'id';
  if coalesce(v_account_id,'')='' then
    return jsonb_build_object('ok',false,'message','La sesión no contiene una cuenta válida.');
  end if;

  select coalesce(jsonb_agg(to_jsonb(p) order by p.name,p.id),'[]'::jsonb)
    into v_players
  from public.parent_player_links_v213 l
  join public.players p on p.id=l.player_id
  where l.parent_account_id::text=v_account_id
    and l.active=true;

  select coalesce(jsonb_agg(to_jsonb(py) order by py.payment_date desc,py.created_at desc),'[]'::jsonb)
    into v_payments
  from public.payments py
  where exists (
    select 1
    from public.parent_player_links_v213 l
    where l.parent_account_id::text=v_account_id
      and l.active=true
      and l.player_id=py.player_id
  );

  return jsonb_set(
           jsonb_set(v_base,'{players}',v_players,true),
           '{payments}',v_payments,true
         );
end;
$$;

grant execute on function public.ducks_parent_portal_v2121(text) to anon, authenticated;

commit;

-- 5) DIAGNOSTICO: ejecutar esta consulta después del script.
-- Debe mostrar una fila por cuenta y todos sus jugadores activos.
select
  a.display_name,
  a.login,
  count(l.player_id) filter (where l.active) as jugadores_ligados,
  string_agg(case when l.active then l.player_id || ' · ' || coalesce(p.name,'') end, E'\n' order by p.name)
    filter (where l.active) as jugadores
from public.parent_accounts_v213 a
left join public.parent_player_links_v213 l on l.parent_account_id=a.id
left join public.players p on p.id=l.player_id
group by a.id,a.display_name,a.login
order by a.display_name;
