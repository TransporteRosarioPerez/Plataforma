-- Combustible importado (YPF / Shell) — tabla normalizada

create table if not exists public.fuel_import_batches (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('ypf', 'shell')),
  file_name text not null,
  row_count int not null default 0,
  linked_count int not null default 0,
  unlinked_count int not null default 0,
  skipped_duplicates int not null default 0,
  imported_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.fuel_transactions (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid references public.fuel_import_batches (id) on delete set null,
  provider text not null check (provider in ('ypf', 'shell')),
  external_id text not null,
  transaction_at timestamptz not null,
  plate text not null,
  station_name text,
  product text,
  product_kind text not null default 'other' check (product_kind in ('diesel', 'urea', 'lubricant', 'other')),
  liters numeric not null default 0,
  unit_price_net numeric,
  unit_price_pvp numeric,
  amount_net numeric not null default 0,
  amount_taxes numeric not null default 0,
  amount_total numeric not null default 0,
  ticket_number text,
  driver_name text,
  card_number text,
  trip_id uuid references public.trips (id) on delete set null,
  matched_plate_role text check (matched_plate_role in ('truck', 'semi')),
  match_status text not null default 'unlinked' check (match_status in ('linked', 'unlinked', 'ambiguous')),
  match_method text check (match_method in ('auto', 'manual')),
  raw_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists fuel_transactions_provider_external_id_idx
  on public.fuel_transactions (provider, external_id) where deleted_at is null;

create index if not exists fuel_transactions_trip_id_idx on public.fuel_transactions (trip_id);
create index if not exists fuel_transactions_match_status_idx on public.fuel_transactions (match_status);
create index if not exists fuel_transactions_transaction_at_idx on public.fuel_transactions (transaction_at);
create index if not exists fuel_transactions_plate_idx on public.fuel_transactions (plate);
create index if not exists fuel_transactions_deleted_at_idx on public.fuel_transactions (deleted_at);

alter table public.fuel_import_batches enable row level security;
alter table public.fuel_transactions enable row level security;

create policy "authenticated_all" on public.fuel_import_batches for all to authenticated using (true) with check (true);
create policy "authenticated_all" on public.fuel_transactions for all to authenticated using (true) with check (true);
