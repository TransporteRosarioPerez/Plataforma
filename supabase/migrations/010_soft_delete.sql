-- Soft delete: deleted_at en lugar de borrado físico

alter table public.clients add column if not exists deleted_at timestamptz;
alter table public.arcor_clients add column if not exists deleted_at timestamptz;
alter table public.vehicles add column if not exists deleted_at timestamptz;
alter table public.drivers add column if not exists deleted_at timestamptz;
alter table public.trips add column if not exists deleted_at timestamptz;
alter table public.proformas add column if not exists deleted_at timestamptz;
alter table public.entity_documents add column if not exists deleted_at timestamptz;
alter table public.trip_expenses add column if not exists deleted_at timestamptz;
alter table public.trip_documents add column if not exists deleted_at timestamptz;
alter table public.expense_categories add column if not exists deleted_at timestamptz;
alter table public.invoices add column if not exists deleted_at timestamptz;

alter table public.inventory_items add column if not exists deleted_at timestamptz;
alter table public.inventory_movements add column if not exists deleted_at timestamptz;

-- Índices para filtrar activos
create index if not exists clients_deleted_at_idx on public.clients (deleted_at);
create index if not exists arcor_clients_deleted_at_idx on public.arcor_clients (deleted_at);
create index if not exists vehicles_deleted_at_idx on public.vehicles (deleted_at);
create index if not exists drivers_deleted_at_idx on public.drivers (deleted_at);
create index if not exists trips_deleted_at_idx on public.trips (deleted_at);
create index if not exists proformas_deleted_at_idx on public.proformas (deleted_at);
create index if not exists entity_documents_deleted_at_idx on public.entity_documents (deleted_at);
create index if not exists trip_expenses_deleted_at_idx on public.trip_expenses (deleted_at);
create index if not exists trip_documents_deleted_at_idx on public.trip_documents (deleted_at);
create index if not exists expense_categories_deleted_at_idx on public.expense_categories (deleted_at);
create index if not exists inventory_items_deleted_at_idx on public.inventory_items (deleted_at);
create index if not exists inventory_movements_deleted_at_idx on public.inventory_movements (deleted_at);

-- Unicidad solo entre registros no eliminados (permite reutilizar patente/número tras baja)
alter table public.vehicles drop constraint if exists vehicles_plate_key;
create unique index if not exists vehicles_plate_active_idx
  on public.vehicles (plate) where deleted_at is null;

alter table public.proformas drop constraint if exists proformas_proforma_number_key;
create unique index if not exists proformas_number_active_idx
  on public.proformas (proforma_number) where deleted_at is null;

alter table public.expense_categories drop constraint if exists expense_categories_code_key;
create unique index if not exists expense_categories_code_active_idx
  on public.expense_categories (code) where deleted_at is null;

alter table public.invoices drop constraint if exists invoices_invoice_number_key;
create unique index if not exists invoices_number_active_idx
  on public.invoices (invoice_number) where deleted_at is null;
