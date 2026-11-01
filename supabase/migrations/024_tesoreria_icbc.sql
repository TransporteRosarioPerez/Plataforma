-- =============================================================================
-- 023 · Tesorería: cuenta ICBC (caja de ahorro en pesos) y sus reglas.
-- El resumen de ICBC llega en PDF; lo lee lib/tesoreria/icbc.ts.
-- Se puede correr más de una vez.
-- =============================================================================

alter table public.treasury_accounts drop constraint if exists treasury_accounts_provider_check;
alter table public.treasury_accounts
  add constraint treasury_accounts_provider_check
  check (provider in ('macro', 'nacion', 'mercadopago', 'icbc'));

insert into public.treasury_accounts (code, name, kind, provider, sort_order)
values ('icbc', 'ICBC', 'bank', 'icbc', 3)
on conflict (code) do nothing;

-- Mercado Pago y Efectivo quedan después de ICBC en los listados.
update public.treasury_accounts set sort_order = 4 where code = 'mercadopago' and sort_order = 3;
update public.treasury_accounts set sort_order = 5 where code = 'efectivo' and sort_order = 4;

with r (name, match_type, pattern, direction, category_name, scope, priority) as (
  values
    ('ICBC: cuota de préstamo', 'contains', 'PAGO CUOTA PRESTAMO', 'out', 'Pago de préstamos', 'empresa', 30),
    ('Punitorios de préstamos', 'contains', 'PUNITORIOS', 'out', 'Intereses y costo financiero', 'empresa', 30),
    ('ICBC: mantenimiento de cuenta', 'contains', 'MANTENIMIENTO CAJA', 'out', 'Comisiones bancarias', 'empresa', 50),
    ('ICBC: intereses', 'contains', 'LIQUIDACION DE INTERESES', 'in', 'Intereses ganados', 'empresa', 70)
)
insert into public.treasury_rules (name, match_type, pattern, direction, category_id, scope, priority)
select r.name, r.match_type, r.pattern, r.direction, c.id, r.scope, r.priority
from r
join public.treasury_categories c on c.name = r.category_name and c.deleted_at is null
where not exists (
  select 1 from public.treasury_rules x where x.name = r.name and x.deleted_at is null
);
