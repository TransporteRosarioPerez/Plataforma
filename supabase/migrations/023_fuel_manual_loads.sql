-- Combustible: carga manual (reemplaza la importación de Edenred / YPF / Shell)
--
-- Se reutiliza fuel_transactions. Cada carga manual guarda:
--   patente (vinculada a vehicles si existe), chofer, fecha, litros,
--   monto total pagado (puede quedar en 0 = "precio pendiente"), km del odómetro (opcional)
--   y la forma de pago, para conciliar después contra el extracto bancario.
-- Idempotente: se puede volver a correr.

alter table public.fuel_transactions drop constraint if exists fuel_transactions_provider_check;
alter table public.fuel_transactions
  add constraint fuel_transactions_provider_check check (provider in ('ypf', 'shell', 'manual'));

alter table public.fuel_import_batches drop constraint if exists fuel_import_batches_provider_check;
alter table public.fuel_import_batches
  add constraint fuel_import_batches_provider_check check (provider in ('ypf', 'shell', 'manual'));

alter table public.fuel_transactions
  add column if not exists vehicle_id uuid references public.vehicles (id) on delete set null,
  add column if not exists driver_id uuid references public.drivers (id) on delete set null,
  add column if not exists odometer_km numeric,
  add column if not exists payment_method text,
  add column if not exists notes text,
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.fuel_transactions drop constraint if exists fuel_transactions_payment_method_check;
alter table public.fuel_transactions
  add constraint fuel_transactions_payment_method_check
  check (payment_method is null or payment_method in ('cuenta_corriente', 'contado', 'tarjeta', 'otro'));

create index if not exists fuel_transactions_vehicle_id_idx on public.fuel_transactions (vehicle_id);
create index if not exists fuel_transactions_driver_id_idx on public.fuel_transactions (driver_id);
create index if not exists fuel_transactions_provider_idx on public.fuel_transactions (provider);
