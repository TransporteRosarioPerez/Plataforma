-- =============================================================================
-- 019 · Tesorería (flujo de fondos real de bancos, billeteras y efectivo)
--
-- Datos independientes del resto de la plataforma:
--   * No referencia trips, clients, invoices, fuel ni expense_categories.
-- Reutiliza la infraestructura existente:
--   * Acceso: sólo superadmin (public.is_superadmin(), migración 015).
--   * Papelera: soft delete con deleted_at, visible en /app/papelera.
--   * Auditoría: public.audit_logs vía insert_audit_log (migración 016).
--   * updated_at: public.set_updated_at() (migración 001).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Cuentas
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null check (kind in ('bank', 'wallet', 'cash')),
  provider text check (provider in ('macro', 'nacion', 'mercadopago')),
  currency text not null default 'ARS',
  opening_balance numeric(16, 2) not null default 0,
  opening_date date,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Categorías (kind: ingreso / egreso / interno; ámbito por defecto)
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('income', 'expense', 'internal')),
  default_scope text check (default_scope in ('empresa', 'personal')),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists treasury_categories_name_key
  on public.treasury_categories (lower(name)) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Contrapartes (CUIT → nombre, categoría y ámbito por defecto)
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_counterparties (
  id uuid primary key default gen_random_uuid(),
  cuit text not null,
  name text not null,
  category_id uuid references public.treasury_categories (id) on delete set null,
  scope text check (scope in ('empresa', 'personal')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists treasury_counterparties_cuit_key
  on public.treasury_counterparties (cuit) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Reglas de categorización
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  match_type text not null default 'contains' check (match_type in ('contains', 'regex', 'cuit')),
  pattern text not null,
  direction text not null default 'any' check (direction in ('any', 'in', 'out')),
  account_id uuid references public.treasury_accounts (id) on delete set null,
  category_id uuid references public.treasury_categories (id) on delete set null,
  scope text check (scope in ('empresa', 'personal')),
  -- Si se completa, el movimiento se marca interno y se crea el espejo en esta cuenta
  -- (ej.: extracción de cajero → Efectivo).
  transfer_account_id uuid references public.treasury_accounts (id) on delete set null,
  priority int not null default 100,
  is_active boolean not null default true,
  created_from_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Lotes de importación
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_import_batches (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.treasury_accounts (id),
  file_name text not null,
  date_from date,
  date_to date,
  row_count int not null default 0,
  auto_count int not null default 0,
  pending_count int not null default 0,
  skipped_duplicates int not null default 0,
  balance_breaks int not null default 0,
  imported_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Movimientos (la tabla de la verdad)
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.treasury_accounts (id),
  import_batch_id uuid references public.treasury_import_batches (id) on delete set null,
  source text not null check (source in ('import', 'manual', 'transfer_mirror')),
  tx_date date not null,
  reference text,
  description_raw text not null,
  description_norm text not null,
  amount numeric(16, 2) not null,
  -- Saldo informado por el banco DESPUÉS del movimiento (normalizado en el parser)
  bank_balance numeric(16, 2),
  -- Orden cronológico dentro del extracto (desempata movimientos del mismo día)
  statement_order int,
  counterparty_cuit text,
  category_id uuid references public.treasury_categories (id) on delete set null,
  scope text check (scope in ('empresa', 'personal')),
  is_internal boolean not null default false,
  transfer_pair_id uuid,
  classification text not null default 'pending'
    check (classification in ('pending', 'auto', 'manual')),
  rule_id uuid references public.treasury_rules (id) on delete set null,
  dedup_key text,
  notes text,
  raw_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists treasury_transactions_dedup_key
  on public.treasury_transactions (account_id, dedup_key)
  where deleted_at is null and dedup_key is not null;
create index if not exists treasury_transactions_date_idx on public.treasury_transactions (tx_date);
create index if not exists treasury_transactions_account_idx on public.treasury_transactions (account_id, tx_date);
create index if not exists treasury_transactions_classification_idx on public.treasury_transactions (classification);
create index if not exists treasury_transactions_cuit_idx on public.treasury_transactions (counterparty_cuit);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
create trigger treasury_accounts_updated_at before update on public.treasury_accounts
  for each row execute procedure public.set_updated_at();
create trigger treasury_categories_updated_at before update on public.treasury_categories
  for each row execute procedure public.set_updated_at();
create trigger treasury_counterparties_updated_at before update on public.treasury_counterparties
  for each row execute procedure public.set_updated_at();
create trigger treasury_rules_updated_at before update on public.treasury_rules
  for each row execute procedure public.set_updated_at();
create trigger treasury_transactions_updated_at before update on public.treasury_transactions
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: sólo superadmin
-- ---------------------------------------------------------------------------
alter table public.treasury_accounts enable row level security;
alter table public.treasury_categories enable row level security;
alter table public.treasury_counterparties enable row level security;
alter table public.treasury_rules enable row level security;
alter table public.treasury_import_batches enable row level security;
alter table public.treasury_transactions enable row level security;

create policy "treasury_superadmin" on public.treasury_accounts for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy "treasury_superadmin" on public.treasury_categories for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy "treasury_superadmin" on public.treasury_counterparties for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy "treasury_superadmin" on public.treasury_rules for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy "treasury_superadmin" on public.treasury_import_batches for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy "treasury_superadmin" on public.treasury_transactions for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());


-- ---------------------------------------------------------------------------
-- Seeds: cuentas
-- ---------------------------------------------------------------------------
insert into public.treasury_accounts (code, name, kind, provider, sort_order) values
  ('macro', 'Banco Macro', 'bank', 'macro', 1),
  ('nacion', 'Banco Nación', 'bank', 'nacion', 2),
  ('mercadopago', 'Mercado Pago', 'wallet', 'mercadopago', 3),
  ('efectivo', 'Efectivo', 'cash', null, 4)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Seeds: categorías
-- ---------------------------------------------------------------------------
insert into public.treasury_categories (name, kind, default_scope, sort_order) values
  -- Ingresos
  ('Cobros de clientes', 'income', 'empresa', 10),
  ('Descuento de cheques', 'income', 'empresa', 11),
  ('Préstamos recibidos', 'income', 'empresa', 12),
  ('Aportes de socios', 'income', 'empresa', 13),
  ('Intereses ganados', 'income', 'empresa', 14),
  ('Otros ingresos', 'income', 'empresa', 19),
  -- Egresos empresa
  ('Combustible', 'expense', 'empresa', 20),
  ('Peajes', 'expense', 'empresa', 21),
  ('Sueldos', 'expense', 'empresa', 22),
  ('Proveedores', 'expense', 'empresa', 23),
  ('Mantenimiento y repuestos', 'expense', 'empresa', 24),
  ('Impuestos', 'expense', 'empresa', 25),
  ('Retenciones y percepciones', 'expense', 'empresa', 26),
  ('Impuesto a los débitos y créditos', 'expense', 'empresa', 27),
  ('Comisiones bancarias', 'expense', 'empresa', 28),
  ('Intereses y costo financiero', 'expense', 'empresa', 29),
  ('Multas y cheques rechazados', 'expense', 'empresa', 30),
  ('Seguros', 'expense', 'empresa', 31),
  ('Servicios', 'expense', 'empresa', 32),
  ('Tarjeta de crédito', 'expense', 'empresa', 33),
  ('Pago de préstamos', 'expense', 'empresa', 34),
  ('Otros gastos empresa', 'expense', 'empresa', 39),
  -- Egresos personales
  ('Alimentos y supermercado', 'expense', 'personal', 40),
  ('Animales y veterinaria', 'expense', 'personal', 41),
  ('Hogar', 'expense', 'personal', 42),
  ('Retiros personales', 'expense', 'personal', 43),
  ('Otros gastos personales', 'expense', 'personal', 49),
  -- Internos (no suman como ingreso ni egreso)
  ('Transferencia entre cuentas propias', 'internal', null, 60),
  ('Movimiento de efectivo', 'internal', null, 61)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Seeds: reglas (surgidas del análisis de extractos de octubre 2026)
-- Prioridad: menor número = se evalúa primero.
-- ---------------------------------------------------------------------------
with r (name, match_type, pattern, direction, category_name, scope, transfer_code, priority) as (
  values
    ('Compensación entre cuentas', 'contains', 'COMPENSACION ENTRE TUS CUENTAS', 'any', 'Transferencia entre cuentas propias', null, null, 10),
    ('Extracción cajero → Efectivo', 'contains', 'EXTRACCION CAJERO', 'out', 'Movimiento de efectivo', null, 'efectivo', 10),
    ('Cobros vía Datanet', 'contains', 'TEF DATANET PR', 'in', 'Cobros de clientes', 'empresa', null, 20),
    ('Descuento de cheques (circuito cerrado)', 'contains', 'CCERR OVER CASH', 'in', 'Descuento de cheques', 'empresa', null, 20),
    ('Sueldos', 'contains', 'PAGO REMUNERACIONES', 'out', 'Sueldos', 'empresa', null, 20),
    ('Impuesto débitos y créditos', 'contains', 'DBCR 25413', 'any', 'Impuesto a los débitos y créditos', 'empresa', null, 20),
    ('Multas cheques', 'contains', 'MULTA', 'any', 'Multas y cheques rechazados', 'empresa', null, 20),
    ('Intereses descubierto', 'regex', 'INTER\.ADEL|SEGURO DE VIDA SALDO DEUDOR', 'out', 'Intereses y costo financiero', 'empresa', null, 20),
    ('Tarjeta de crédito', 'contains', 'TARJETA DE CREDITO', 'out', 'Tarjeta de crédito', 'empresa', null, 20),
    ('Shell Shop (personal)', 'contains', 'SHELL SHOP', 'out', 'Alimentos y supermercado', 'personal', null, 30),
    ('AFIP / ARCA', 'regex', '\bAFIP\b|\bARCA\b', 'out', 'Impuestos', 'empresa', null, 40),
    ('Sellos', 'contains', 'DGR SELLOS', 'out', 'Impuestos', 'empresa', null, 40),
    ('Retenciones y percepciones', 'regex', 'ING\.? BRUTOS|IIBB|GRAVAMEN IB|RETEN\. I\.V\.A', 'out', 'Retenciones y percepciones', 'empresa', null, 40),
    ('Comisiones bancarias', 'regex', 'COMISION|COMIS\.|MANTENIMIENTO MENSUAL|COM\. SERV|DEBITO FISCAL IVA|I\.V\.A\. BASE', 'out', 'Comisiones bancarias', 'empresa', null, 50),
    ('Combustible', 'regex', '\bYPF\b|SHELL|ACA RIO TALA|COMBUSTIBLES', 'out', 'Combustible', 'empresa', null, 60),
    ('Peajes', 'regex', 'AUTOPISTA|AUBASA|CORREDORES VIALES|CORRESUR|TELEPEAJE|PEAJE|AUTOVIA|CAMINO PQUE', 'out', 'Peajes', 'empresa', null, 60),
    ('Seguros La Segunda', 'contains', 'LA SEGUNDA', 'out', 'Seguros', 'empresa', null, 60),
    ('Servicios', 'regex', 'LITORAL GAS|CLARO|PAGO SERV|DEBITO AUTOMATICO', 'out', 'Servicios', 'empresa', null, 60),
    ('Alimentos', 'regex', 'CARNICERIA|SUPERMIO|SUPERMERCADO|POLLO|ENCUENTROPAN|JABONERA|MERPAGO\*SIMON', 'out', 'Alimentos y supermercado', 'personal', null, 70),
    ('Animales', 'regex', 'FORRAJERIA|VETERINARIA', 'out', 'Animales y veterinaria', 'personal', null, 70),
    ('Intereses ganados', 'contains', 'INTERESES CAPITALIZADOS', 'in', 'Intereses ganados', 'empresa', null, 70)
)
insert into public.treasury_rules (name, match_type, pattern, direction, category_id, scope, transfer_account_id, priority)
select r.name, r.match_type, r.pattern, r.direction, c.id, r.scope, a.id, r.priority
from r
join public.treasury_categories c on c.name = r.category_name and c.deleted_at is null
left join public.treasury_accounts a on a.code = r.transfer_code;

