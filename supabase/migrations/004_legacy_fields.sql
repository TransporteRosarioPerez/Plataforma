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
