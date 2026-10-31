-- =============================================================================
-- 021 · Tesorería: registro de cheques emitidos
--
-- El extracto bancario sólo dice "CHEQUE P/CAMARA" o "CHEQUE CANJE INTERNO" y
-- trae el número de cheque como referencia. Con este registro (número → a quién y
-- por qué) el débito se clasifica solo al importar, y se sabe qué cheques
-- emitidos todavía no se debitaron.
--
-- Mismas convenciones que 019: sólo superadmin, soft delete (Papelera general),
-- updated_at con public.set_updated_at().
-- =============================================================================

create table if not exists public.treasury_cheques (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.treasury_accounts (id),
  cheque_number text not null,
  amount numeric(16, 2) not null check (amount > 0),
  issue_date date,
  payment_date date,
  payee_name text not null,
  payee_cuit text,
  category_id uuid references public.treasury_categories (id) on delete set null,
  scope text check (scope in ('empresa', 'personal')),
  notes text,
  -- emitido: entregado, todavía no debitado · debitado: ya salió del banco
  -- rechazado: el banco lo rechazó (multa) · anulado: no se va a cobrar
  status text not null default 'emitido' check (status in ('emitido', 'debitado', 'rechazado', 'anulado')),
  transaction_id uuid references public.treasury_transactions (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists treasury_cheques_number_key
  on public.treasury_cheques (account_id, cheque_number) where deleted_at is null;
create index if not exists treasury_cheques_status_idx on public.treasury_cheques (status, payment_date);
create index if not exists treasury_cheques_transaction_idx on public.treasury_cheques (transaction_id);

-- Para buscar el débito de un cheque por su número.
create index if not exists treasury_transactions_reference_idx
  on public.treasury_transactions (account_id, reference) where deleted_at is null;

create trigger treasury_cheques_updated_at before update on public.treasury_cheques
  for each row execute procedure public.set_updated_at();

alter table public.treasury_cheques enable row level security;

create policy "treasury_superadmin" on public.treasury_cheques for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
