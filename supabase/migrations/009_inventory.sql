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
