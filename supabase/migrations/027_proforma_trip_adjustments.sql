-- Ajustes de viaje: una línea de proforma puede ser un ajuste (diferencia de
-- tarifa, retroactivo, etc.) sobre un viaje que ya fue facturado/cobrado en
-- otra proforma. El ingreso del viaje sigue siendo la suma de todas sus líneas
-- activas, así que el ajuste se suma (o resta) solo.

alter table public.proforma_line_items
  add column if not exists is_adjustment boolean not null default false,
  add column if not exists adjustment_reason text;

-- Los ajustes pueden ser negativos (baja de tarifa); las líneas normales no.
alter table public.proforma_line_items
  drop constraint if exists proforma_line_items_amount_check;

alter table public.proforma_line_items
  add constraint proforma_line_items_amount_check
  check (amount >= 0 or is_adjustment);

create index if not exists proforma_line_items_trip_adjustment_idx
  on public.proforma_line_items (trip_id)
  where is_adjustment;
