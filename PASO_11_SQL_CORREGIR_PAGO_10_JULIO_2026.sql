-- DUCKS CRM PROFESIONAL v2.53
-- Corrección conservadora para pagos creados el 10 de julio de 2026
-- que quedaron guardados incorrectamente con fecha 11 de julio de 2026.
-- Primero muestra los registros afectados y después los corrige.

select id, player_id, student_name, payment_date, period, created_at
from public.payments
where payment_date = date '2026-07-11'
  and (created_at at time zone 'America/Mexico_City')::date = date '2026-07-10'
order by created_at desc;

update public.payments
set payment_date = date '2026-07-10',
    period = '2026-07'
where payment_date = date '2026-07-11'
  and (created_at at time zone 'America/Mexico_City')::date = date '2026-07-10';
