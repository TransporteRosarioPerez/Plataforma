-- ========== 001_initial_schema.sql ==========
-- RemitoListo single-tenant schema

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'ops' check (role in ('superadmin', 'admin', 'ops', 'accounting')),
  created_at timestamptz not null default now()
);

-- Single company row
create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi Empresa',
  cuit text,
  address text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.company_settings (name)
select 'Mi Empresa de Transporte'
where not exists (select 1 from public.company_settings limit 1);

-- Maestros
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cuit text,
  address text,
  phone text,
  email text,
  contact_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  brand text not null,
  model text not null,
  year int not null,
  type text not null check (type in ('truck', 'semi', 'trailer')),
  status text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  vtv_expiry date,
  ruta_expiry date,
  insurance_expiry date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dni text not null,
  license_number text,
  license_expiry date,
  linti_expiry date,
  psychophysical_expiry date,
  art_expiry date,
  phone text,
  email text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Config
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  entity_type text not null check (entity_type in ('vehicle', 'driver', 'company')),
  renewal_frequency text not null,
  days_before_warning int not null default 7,
  description text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (code, entity_type)
);

create table if not exists public.entity_documents (
  id uuid primary key default gen_random_uuid(),
  document_type_id uuid not null references public.document_types (id),
  entity_id uuid not null,
  entity_type text not null check (entity_type in ('vehicle', 'driver', 'company')),
  file_name text,
  file_url text,
  issue_date date,
  expiry_date date,
  status text not null default 'missing' check (status in ('valid', 'expiring_soon', 'expired', 'missing')),
  notes text,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trips skeleton (contract TBD in lib/domain/trips)
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'pending_contract',
  trip_type text,
  client_id uuid references public.clients (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  trailer_id uuid references public.vehicles (id) on delete set null,
  driver_id uuid references public.drivers (id) on delete set null,
  origin text,
  cargo_type text,
  cargo_description text,
  departure_date timestamptz,
  arrival_date timestamptz,
  total_kilometers numeric,
  total_income numeric not null default 0,
  total_expenses numeric not null default 0,
  profit numeric not null default 0,
  notes text,
  metadata jsonb not null default '{}',
  external_id text,
  legacy_source text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  document_type text not null,
  document_number text,
  client_id uuid references public.clients (id) on delete set null,
  client_name text,
  destination text,
  file_name text,
  file_url text,
  storage_path text,
  status text not null default 'ok' check (status in ('ok', 'observado')),
  observation_notes text,
  observed_file_name text,
  observed_file_url text,
  metadata jsonb not null default '{}',
  uploaded_at timestamptz not null default now()
);

create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  category_id uuid references public.expense_categories (id),
  category_name text,
  description text,
  amount numeric not null,
  paid_by text not null default 'empresa' check (paid_by in ('empresa', 'chofer')),
  receipt_file_name text,
  receipt_file_url text,
  receipt_storage_path text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.proformas (
  id uuid primary key default gen_random_uuid(),
  proforma_number text not null unique,
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null,
  trip_ids uuid[] not null default '{}',
  subtotal numeric not null default 0,
  taxes numeric not null default 0,
  total numeric not null default 0,
  file_name text,
  file_url text,
  status text not null default 'pendiente' check (status in ('pendiente', 'facturada', 'cobrada')),
  received_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  invoice_type text not null default 'A' check (invoice_type in ('A', 'B', 'C')),
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null,
  client_cuit text,
  proforma_id uuid references public.proformas (id) on delete set null,
  trip_ids uuid[] not null default '{}',
  subtotal numeric not null default 0,
  iva numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'emitida' check (status in ('emitida', 'cobrada', 'anulada')),
  issue_date date not null default current_date,
  paid_date date,
  file_name text,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: authenticated users full access (single-tenant)
alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.clients enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.expense_categories enable row level security;
alter table public.document_types enable row level security;
alter table public.entity_documents enable row level security;
alter table public.trips enable row level security;
alter table public.trip_documents enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.proformas enable row level security;
alter table public.invoices enable row level security;

create policy "authenticated_all" on public.profiles for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.company_settings for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.clients for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.vehicles for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.drivers for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.expense_categories for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.document_types for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.entity_documents for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.trips for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.trip_documents for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.trip_expenses for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.proformas for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.invoices for all to authenticated using (true) with check (true);

-- Profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'superadmin')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated before update on public.clients
  for each row execute procedure public.set_updated_at();
create trigger vehicles_updated before update on public.vehicles
  for each row execute procedure public.set_updated_at();
create trigger drivers_updated before update on public.drivers
  for each row execute procedure public.set_updated_at();
create trigger trips_updated before update on public.trips
  for each row execute procedure public.set_updated_at();
create trigger proformas_updated before update on public.proformas
  for each row execute procedure public.set_updated_at();
create trigger invoices_updated before update on public.invoices
  for each row execute procedure public.set_updated_at();
create trigger entity_documents_updated before update on public.entity_documents
  for each row execute procedure public.set_updated_at();
create trigger company_settings_updated before update on public.company_settings
  for each row execute procedure public.set_updated_at();


-- ========== 002_seed_config.sql ==========
-- Expense categories seed
insert into public.expense_categories (code, name, is_default, is_active) values
  ('combustible', 'Combustible', true, true),
  ('peajes', 'Peajes', true, true),
  ('viaticos', 'Viáticos', true, true),
  ('reparaciones', 'Reparaciones en Ruta', true, true),
  ('anticipo_chofer', 'Anticipo al Chofer', true, true),
  ('estacionamiento', 'Estacionamiento', true, true),
  ('lavado', 'Lavado', true, true),
  ('otros', 'Otros', true, true)
on conflict (code) do nothing;

-- Document types seed (subset from lib/types SEED_*)
insert into public.document_types (code, name, entity_type, renewal_frequency, days_before_warning, description, is_default, is_active) values
  ('cert_satelital', 'Certificado Seguimiento Satelital', 'vehicle', 'monthly', 7, 'Sitrack/Hawk', true, true),
  ('vtv', 'Técnica Vehicular (VTV)', 'vehicle', 'yearly', 30, null, true, true),
  ('poliza_seguro', 'Póliza de Seguro', 'vehicle', 'biannual', 30, null, true, true),
  ('carnet_conducir', 'Carnet de Conducir', 'driver', 'yearly', 30, null, true, true),
  ('dni', 'DNI', 'driver', 'once', 0, null, true, true),
  ('ingresos_brutos', 'Ingresos Brutos', 'company', 'monthly', 7, null, true, true)
on conflict (code, entity_type) do nothing;


-- ========== 004_legacy_fields.sql ==========
-- Legacy fields, 7 trip statuses, observations, migration map

-- Clients
alter table public.clients
  add column if not exists account_id text,
  add column if not exists legacy_id text;

create unique index if not exists clients_account_id_key on public.clients (account_id) where account_id is not null;
create unique index if not exists clients_legacy_id_key on public.clients (legacy_id) where legacy_id is not null;

-- Vehicles / drivers legacy ids for migration idempotency
alter table public.vehicles add column if not exists legacy_id text;
create unique index if not exists vehicles_legacy_id_key on public.vehicles (legacy_id) where legacy_id is not null;

alter table public.drivers add column if not exists legacy_id text;
create unique index if not exists drivers_legacy_id_key on public.drivers (legacy_id) where legacy_id is not null;

-- Trips: legacy business fields
alter table public.trips
  add column if not exists destination text,
  add column if not exists number_of_clients text,
  add column if not exists total_pallets int,
  add column if not exists total_packages int,
  add column if not exists km_arcor_system numeric,
  add column if not exists km_real_driver numeric,
  add column if not exists km_satellite_google numeric,
  add column if not exists pdf_storage_key text,
  add column if not exists pdf_uploaded_by uuid references public.profiles (id),
  add column if not exists legacy_id text;

create unique index if not exists trips_legacy_id_key on public.trips (legacy_id) where legacy_id is not null;

-- Migrate provisional statuses to legacy 7-state model
update public.trips set status = 'incomplete' where status in ('borrador', 'pending_contract');
update public.trips set status = 'in_progress' where status = 'en_curso';
update public.trips set status = 'delivered' where status = 'entregado';
update public.trips set status = 'paid' where status = 'cerrado';

alter table public.trips alter column status set default 'incomplete';

-- Observations (separate from trip status)
create table if not exists public.trip_observations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  content text not null,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists trip_observations_legacy_id_key
  on public.trip_observations (legacy_id) where legacy_id is not null;

-- Migration id map (debug / re-runs)
create table if not exists public.legacy_id_map (
  entity_type text not null,
  legacy_id text not null,
  supabase_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (entity_type, legacy_id)
);

alter table public.trip_observations enable row level security;
create policy "authenticated_all" on public.trip_observations
  for all to authenticated using (true) with check (true);

alter table public.legacy_id_map enable row level security;
create policy "authenticated_all" on public.legacy_id_map
  for all to authenticated using (true) with check (true);

create trigger trip_observations_updated before update on public.trip_observations
  for each row execute procedure public.set_updated_at();


-- ========== 005_mvp_alerts.sql ==========
-- MVP v1: alert settings + notification log

alter table public.company_settings
  add column if not exists alert_enabled boolean not null default false,
  add column if not exists alert_webhook_url text,
  add column if not exists alert_whatsapp_phones text[] not null default '{}',
  add column if not exists alert_days_before int not null default 7;

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.entity_documents (id) on delete cascade,
  channel text not null default 'whatsapp_webhook',
  sent_at timestamptz not null default now(),
  status text not null default 'sent' check (status in ('sent', 'failed')),
  payload jsonb not null default '{}'
);

create index if not exists notification_log_document_sent_idx
  on public.notification_log (document_id, sent_at desc);

alter table public.notification_log enable row level security;
create policy "authenticated_all" on public.notification_log
  for all to authenticated using (true) with check (true);


-- ========== 006_entity_documents_freeform.sql ==========
-- MVP v1: documentos libres por entidad (sin catálogo document_types)

alter table public.entity_documents
  add column if not exists name text;

update public.entity_documents ed
set name = dt.name
from public.document_types dt
where ed.document_type_id = dt.id
  and (ed.name is null or ed.name = '');

update public.entity_documents
set name = 'Documento'
where name is null or name = '';

alter table public.entity_documents
  alter column name set not null;

alter table public.entity_documents
  drop constraint if exists entity_documents_document_type_id_fkey;

alter table public.entity_documents
  drop column if exists document_type_id;

drop table if exists public.document_types;


-- ========== 007_document_renewal_and_history.sql ==========
-- Renovación e historial por documento (sin catálogo document_types)
-- Cada fila es una versión; document_group_id agrupa versiones del mismo documento.

drop index if exists entity_documents_current_type_idx;

alter table public.entity_documents
  drop constraint if exists entity_documents_document_type_id_fkey;

alter table public.entity_documents
  drop column if exists document_type_id;

drop table if exists public.document_types;

alter table public.entity_documents
  add column if not exists renewal_frequency text not null default 'once'
    check (renewal_frequency in ('monthly', 'biannual', 'yearly', 'triennial', 'once')),
  add column if not exists document_group_id uuid,
  add column if not exists is_current boolean not null default true,
  add column if not exists superseded_at timestamptz;

update public.entity_documents
set document_group_id = id
where document_group_id is null;

alter table public.entity_documents
  alter column document_group_id set not null;

create unique index if not exists entity_documents_current_group_idx
  on public.entity_documents (entity_id, entity_type, document_group_id)
  where is_current = true;


-- ========== 008_billing_clients_and_proforma_lines.sql ==========
-- arcor_clients: catálogo operativo actual (ex clientes del viaje)
-- clients: clientes reales de la empresa (CRUD, proformas)

create table if not exists public.arcor_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_id text,
  address text,
  legacy_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists arcor_clients_account_id_key
  on public.arcor_clients (account_id) where account_id is not null;
create unique index if not exists arcor_clients_legacy_id_key
  on public.arcor_clients (legacy_id) where legacy_id is not null;

insert into public.arcor_clients (id, name, account_id, address, legacy_id, created_at)
select id, name, account_id, address, legacy_id, created_at
from public.clients;

alter table public.trips
  add column if not exists arcor_client_id uuid references public.arcor_clients (id) on delete set null;

update public.trips
set arcor_client_id = client_id
where arcor_client_id is null and client_id is not null;

alter table public.trips drop constraint if exists trips_client_id_fkey;
alter table public.trips drop column if exists client_id;

alter table public.trip_documents drop constraint if exists trip_documents_client_id_fkey;
alter table public.trip_documents
  add constraint trip_documents_arcor_client_id_fkey
  foreign key (client_id) references public.arcor_clients (id) on delete set null;

update public.proformas set client_id = null where client_id is not null;
delete from public.clients;

create table if not exists public.proforma_line_items (
  id uuid primary key default gen_random_uuid(),
  proforma_id uuid not null references public.proformas (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete restrict,
  amount numeric not null default 0 check (amount >= 0),
  taxes numeric not null default 0 check (taxes >= 0),
  created_at timestamptz not null default now(),
  unique (proforma_id, trip_id)
);

create index if not exists proforma_line_items_proforma_id_idx
  on public.proforma_line_items (proforma_id);

alter table public.arcor_clients enable row level security;
create policy "authenticated_all" on public.arcor_clients
  for all to authenticated using (true) with check (true);

alter table public.proforma_line_items enable row level security;
create policy "authenticated_all" on public.proforma_line_items
  for all to authenticated using (true) with check (true);


-- ========== 009_inventory.sql ==========
-- Inventario: categorías, ítems y movimientos de stock
-- Idempotente: safe to re-run if a prior attempt partially applied.

create table if not exists public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  category_id uuid references public.inventory_categories (id) on delete set null,
  unit text not null default 'unidad',
  min_quantity numeric not null default 0,
  current_quantity numeric not null default 0,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  movement_type text not null,
  quantity numeric not null,
  adjustment_direction text,
  unit_cost numeric,
  total_cost numeric,
  supplier_name text,
  invoice_reference text,
  movement_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- Column / table constraints (drop + re-add for idempotency)
alter table public.inventory_items drop constraint if exists inventory_items_min_quantity_check;
alter table public.inventory_items
  add constraint inventory_items_min_quantity_check check (min_quantity >= 0);

alter table public.inventory_items drop constraint if exists inventory_items_current_quantity_check;
alter table public.inventory_items
  add constraint inventory_items_current_quantity_check check (current_quantity >= 0);

alter table public.inventory_movements drop constraint if exists inventory_movements_movement_type_check;
alter table public.inventory_movements
  add constraint inventory_movements_movement_type_check
  check (movement_type in ('purchase', 'consumption', 'adjustment'));

alter table public.inventory_movements drop constraint if exists inventory_movements_quantity_check;
alter table public.inventory_movements
  add constraint inventory_movements_quantity_check check (quantity > 0);

alter table public.inventory_movements drop constraint if exists inventory_movements_adjustment_direction_check;
alter table public.inventory_movements
  add constraint inventory_movements_adjustment_direction_check
  check (adjustment_direction in ('increase', 'decrease') or adjustment_direction is null);

alter table public.inventory_movements drop constraint if exists inventory_movements_adjustment_direction_required_check;
alter table public.inventory_movements
  add constraint inventory_movements_adjustment_direction_required_check check (
    (movement_type = 'adjustment' and adjustment_direction is not null)
    or (movement_type <> 'adjustment' and adjustment_direction is null)
  );

alter table public.inventory_movements drop constraint if exists inventory_movements_unit_cost_check;
alter table public.inventory_movements
  add constraint inventory_movements_unit_cost_check
  check (unit_cost is null or unit_cost >= 0);

alter table public.inventory_movements drop constraint if exists inventory_movements_total_cost_check;
alter table public.inventory_movements
  add constraint inventory_movements_total_cost_check
  check (total_cost is null or total_cost >= 0);

alter table public.inventory_movements drop constraint if exists inventory_movements_purchase_cost_check;
alter table public.inventory_movements
  add constraint inventory_movements_purchase_cost_check check (
    (movement_type = 'purchase' and unit_cost is not null and total_cost is not null)
    or (movement_type <> 'purchase')
  );

create index if not exists inventory_items_category_id_idx on public.inventory_items (category_id);
create index if not exists inventory_items_is_active_idx on public.inventory_items (is_active);
create index if not exists inventory_movements_item_id_idx on public.inventory_movements (item_id);
create index if not exists inventory_movements_movement_date_idx on public.inventory_movements (movement_date desc);
create index if not exists inventory_movements_type_date_idx on public.inventory_movements (movement_type, movement_date desc);

alter table public.inventory_categories enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "authenticated_all" on public.inventory_categories;
create policy "authenticated_all" on public.inventory_categories
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all" on public.inventory_items;
create policy "authenticated_all" on public.inventory_items
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all" on public.inventory_movements;
create policy "authenticated_all" on public.inventory_movements
  for all to authenticated using (true) with check (true);

drop trigger if exists inventory_items_updated on public.inventory_items;
create trigger inventory_items_updated before update on public.inventory_items
  for each row execute procedure public.set_updated_at();

insert into public.inventory_categories (code, name)
values
  ('cubiertas', 'Cubiertas'),
  ('limpieza', 'Limpieza'),
  ('taller', 'Taller'),
  ('oficina', 'Oficina'),
  ('otros', 'Otros')
on conflict (code) do nothing;


-- ========== 010_soft_delete.sql ==========
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


-- ========== 011_trip_observations_soft_delete.sql ==========
-- Soft delete para observaciones de viaje

alter table public.trip_observations add column if not exists deleted_at timestamptz;

create index if not exists trip_observations_deleted_at_idx
  on public.trip_observations (deleted_at);


-- ========== 012_trip_unit_price.sql ==========
alter table public.trips
  add column if not exists unit_price numeric,
  add column if not exists proforma_unit_price numeric;


-- ========== 013_invoices_proforma_unique.sql ==========
create unique index if not exists invoices_proforma_id_active_idx
  on public.invoices (proforma_id)
  where deleted_at is null and proforma_id is not null;

