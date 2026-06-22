alter table public.trips
  add column if not exists unit_price numeric,
  add column if not exists proforma_unit_price numeric;
