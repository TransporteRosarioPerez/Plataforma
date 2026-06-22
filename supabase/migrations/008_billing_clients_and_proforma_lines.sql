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
