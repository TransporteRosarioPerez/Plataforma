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
