-- =============================================================================
-- 020 · Tesorería: reglas para Mercado Pago
-- Sale del resumen de cuenta de Mercado Pago de octubre 2026.
-- Se puede correr más de una vez: no duplica reglas y sólo amplía los patrones
-- que siguen tal cual quedaron en la migración 019.
-- =============================================================================

-- Combustible: estaciones que aparecen como "Pago con QR ..." en Mercado Pago.
update public.treasury_rules
set pattern = '\bYPF\b|SHELL|ACA RIO TALA|RIOTALA|PUMA ENERGY|COMBUSTIBLES'
where name = 'Combustible'
  and pattern = '\bYPF\b|SHELL|ACA RIO TALA|COMBUSTIBLES'
  and deleted_at is null;

-- Peajes: Grupo Concesionario del Oeste (Acceso Oeste).
update public.treasury_rules
set pattern = 'AUTOPISTA|AUBASA|CORREDORES VIALES|CORRESUR|TELEPEAJE|PEAJE|AUTOVIA|CAMINO PQUE|CONCESIONARIO DEL OESTE'
where name = 'Peajes'
  and pattern = 'AUTOPISTA|AUBASA|CORREDORES VIALES|CORRESUR|TELEPEAJE|PEAJE|AUTOVIA|CAMINO PQUE'
  and deleted_at is null;

with r (name, match_type, pattern, direction, category_name, scope, priority) as (
  values
    -- "Pago de impuesto Impuesto a los IIBB" es un pago, no una retención: va antes que la regla de IIBB (40).
    ('Mercado Pago: pago de impuestos', 'contains', 'PAGO DE IMPUESTO', 'out', 'Impuestos', 'empresa', 35),
    ('Mercado Pago: cuota de créditos', 'contains', 'DEBITO POR DEUDA CREDITOS DE MERCADO PAGO', 'out', 'Pago de préstamos', 'empresa', 30),
    ('Farmacia', 'contains', 'FARMACIA', 'out', 'Otros gastos personales', 'personal', 70)
)
insert into public.treasury_rules (name, match_type, pattern, direction, category_id, scope, priority)
select r.name, r.match_type, r.pattern, r.direction, c.id, r.scope, r.priority
from r
join public.treasury_categories c on c.name = r.category_name and c.deleted_at is null
where not exists (
  select 1 from public.treasury_rules x where x.name = r.name and x.deleted_at is null
);
