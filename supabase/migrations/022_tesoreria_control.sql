-- =============================================================================
-- 022 · Tesorería: cierres mensuales, arqueos de efectivo, proyección de caja
--        y cheques de terceros recibidos.
-- Mismas convenciones que 019/021: sólo superadmin, soft delete (Papelera general),
-- updated_at con public.set_updated_at().
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Cierres mensuales: foto del saldo al cierre. Reabrir deja la historia.
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_month_closes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.treasury_accounts (id),
  month date not null check (extract(day from month) = 1),
  system_balance numeric(16, 2) not null,
  bank_balance numeric(16, 2),
  difference numeric(16, 2),
  pending_count int not null default 0,
  notes text,
  status text not null default 'closed' check (status in ('closed', 'reopened')),
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz not null default now(),
  reopened_by uuid references auth.users (id) on delete set null,
  reopened_at timestamptz,
  reopen_reason text
);

create unique index if not exists treasury_month_closes_open_key
  on public.treasury_month_closes (account_id, month) where status = 'closed';

-- ---------------------------------------------------------------------------
-- Arqueos de efectivo
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_cash_counts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.treasury_accounts (id),
  count_date date not null,
  counted_amount numeric(16, 2) not null,
  system_amount numeric(16, 2) not null,
  difference numeric(16, 2) not null,
  adjustment_transaction_id uuid references public.treasury_transactions (id) on delete set null,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists treasury_cash_counts_account_idx on public.treasury_cash_counts (account_id, count_date desc);

-- ---------------------------------------------------------------------------
-- Proyección: ingresos/egresos esperados (únicos o recurrentes)
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_forecast_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- positivo = entra, negativo = sale
  amount numeric(16, 2) not null check (amount <> 0),
  frequency text not null check (frequency in ('once', 'weekly', 'monthly')),
  start_date date not null,
  end_date date,
  day_of_month int check (day_of_month between 1 and 31),
  account_id uuid references public.treasury_accounts (id) on delete set null,
  category_id uuid references public.treasury_categories (id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Cheques de terceros recibidos
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_received_cheques (
  id uuid primary key default gen_random_uuid(),
  cheque_number text not null,
  bank_name text,
  issuer_name text not null,
  issuer_cuit text,
  amount numeric(16, 2) not null check (amount > 0),
  received_date date,
  payment_date date,
  -- cartera: lo tenemos · depositado: se depositó · descontado: se descontó en el banco
  -- endosado: se entregó a un tercero · rechazado: rebotó
  status text not null default 'cartera'
    check (status in ('cartera', 'depositado', 'descontado', 'endosado', 'rechazado')),
  -- Crédito del banco por el depósito o por el descuento (ej. "CCERR OVER CASH")
  settlement_transaction_id uuid references public.treasury_transactions (id) on delete set null,
  endorsed_to text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists treasury_received_cheques_status_idx
  on public.treasury_received_cheques (status, payment_date);
create index if not exists treasury_received_cheques_settlement_idx
  on public.treasury_received_cheques (settlement_transaction_id);

-- ---------------------------------------------------------------------------
-- Triggers y RLS
-- ---------------------------------------------------------------------------
create trigger treasury_forecast_items_updated_at before update on public.treasury_forecast_items
  for each row execute procedure public.set_updated_at();
create trigger treasury_received_cheques_updated_at before update on public.treasury_received_cheques
  for each row execute procedure public.set_updated_at();

alter table public.treasury_month_closes enable row level security;
alter table public.treasury_cash_counts enable row level security;
alter table public.treasury_forecast_items enable row level security;
alter table public.treasury_received_cheques enable row level security;

create policy "treasury_superadmin" on public.treasury_month_closes for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy "treasury_superadmin" on public.treasury_cash_counts for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy "treasury_superadmin" on public.treasury_forecast_items for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy "treasury_superadmin" on public.treasury_received_cheques for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ---------------------------------------------------------------------------
-- Categoría para los ajustes de arqueo (faltante = egreso, sobrante = ingreso)
-- ---------------------------------------------------------------------------
insert into public.treasury_categories (name, kind, default_scope, sort_order)
select 'Diferencias de caja', 'expense', 'empresa', 38
where not exists (
  select 1 from public.treasury_categories where lower(name) = 'diferencias de caja' and deleted_at is null
);
