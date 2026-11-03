-- Viajes que vinieron del sistema anterior ya en "Pagado" / "Pendiente de pago"
-- no tienen proforma en la plataforma. Guardamos su estado e ingreso de origen
-- para que un "Ajuste de viaje" se sume sobre ese ingreso (y no lo pise), y
-- para que, si se borra el ajuste, el viaje vuelva a como estaba.

alter table public.trips
  add column if not exists legacy_billing_status text
    check (legacy_billing_status in ('paid', 'pending_payment')),
  add column if not exists legacy_income numeric not null default 0;

update public.trips t
set legacy_billing_status = t.status,
    legacy_income = coalesce(t.total_income, 0)
where t.deleted_at is null
  and t.status in ('paid', 'pending_payment')
  and t.legacy_billing_status is null
  and not exists (
    select 1
    from public.proforma_line_items li
    join public.proformas p on p.id = li.proforma_id
    where li.trip_id = t.id
      and p.deleted_at is null
  );
