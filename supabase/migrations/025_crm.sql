-- =============================================================================
-- 025 · CRM de cotizaciones
--
-- Flujo:
--   1. Todo pedido (landing, WhatsApp, mail, teléfono) entra a crm_inbound_requests
--      con status 'pending' (Bandeja de entrada).
--   2. En la Bandeja se decide a qué empresa corresponde (sugerencia por CUIT,
--      dominio del mail, teléfono, alias o nombre parecido) o se crea una nueva.
--      Si el nombre que escribió el cliente difiere, se guarda como alias
--      (ej.: "Lenevo" → Lenovo) para que la próxima vez matchee solo.
--   3. Al aceptar se crea una cotización (crm_quotes) en el Board, etapa 'nuevo'.
--   4. Cada cambio de etapa / nota queda en crm_quote_events (historial).
--
-- Independiente del resto de la plataforma (no referencia clients ni trips).
-- Acceso: sólo superadmin. El endpoint público /api/crm/inbound inserta con
-- service role. Papelera: deleted_at. Auditoría: insert_audit_log (016).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Empresas (normalizadas)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Nombre normalizado (sin acentos, sin S.A./S.R.L., minúsculas). Lo calcula la app.
  name_norm text not null,
  cuit text,
  email_domain text,
  website text,
  industry text,
  city text,
  province text,
  notes text,
  merged_into_id uuid references public.crm_companies (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists crm_companies_name_norm_key
  on public.crm_companies (name_norm) where deleted_at is null;
create unique index if not exists crm_companies_cuit_key
  on public.crm_companies (cuit) where deleted_at is null and cuit is not null;
create index if not exists crm_companies_domain_idx on public.crm_companies (email_domain);

-- Alias: otras formas en que la empresa aparece escrita ("Lenevo", "Lenovo Argentina SRL")
create table if not exists public.crm_company_aliases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.crm_companies (id) on delete cascade,
  alias text not null,
  alias_norm text not null,
  source text not null default 'manual' check (source in ('manual', 'triage', 'merge')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists crm_company_aliases_norm_key
  on public.crm_company_aliases (alias_norm);
create index if not exists crm_company_aliases_company_idx on public.crm_company_aliases (company_id);

-- ---------------------------------------------------------------------------
-- Contactos
-- ---------------------------------------------------------------------------
create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.crm_companies (id) on delete cascade,
  name text,
  email text,
  phone text,
  -- Sólo dígitos, sin 54/9/0/15 (lo calcula la app) para matchear WhatsApp ↔ landing
  phone_norm text,
  role text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists crm_contacts_company_idx on public.crm_contacts (company_id);
create index if not exists crm_contacts_email_idx on public.crm_contacts (lower(email));
create index if not exists crm_contacts_phone_idx on public.crm_contacts (phone_norm);

-- ---------------------------------------------------------------------------
-- Bandeja de entrada: pedidos tal como llegan
-- ---------------------------------------------------------------------------
create table if not exists public.crm_inbound_requests (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('whatsapp', 'email', 'landing', 'phone', 'other')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'discarded')),
  received_at timestamptz not null default now(),
  sender_name text,
  sender_email text,
  sender_phone text,
  company_name_raw text,
  cuit_raw text,
  subject text,
  message text,
  -- Datos extraídos del mensaje o del formulario (origen, destino, pallets, servicio, fecha...)
  parsed jsonb not null default '{}'::jsonb,
  -- Id del mensaje en el canal (webhooks): evita duplicados
  external_id text,
  company_id uuid references public.crm_companies (id) on delete set null,
  quote_id uuid,
  discard_reason text,
  triaged_by uuid references auth.users (id) on delete set null,
  triaged_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists crm_inbound_external_key
  on public.crm_inbound_requests (channel, external_id) where external_id is not null;
create index if not exists crm_inbound_status_idx on public.crm_inbound_requests (status, received_at desc);
create index if not exists crm_inbound_company_idx on public.crm_inbound_requests (company_id);

-- ---------------------------------------------------------------------------
-- Cotizaciones (tarjetas del Board)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_quotes (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  company_id uuid not null references public.crm_companies (id),
  contact_id uuid references public.crm_contacts (id) on delete set null,
  inbound_request_id uuid references public.crm_inbound_requests (id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'email', 'landing', 'phone', 'other')),
  stage text not null default 'nuevo'
    check (stage in ('nuevo', 'cotizando', 'enviada', 'negociacion', 'ganada', 'perdida')),
  stage_changed_at timestamptz not null default now(),
  position double precision not null default 0,
  received_at timestamptz not null default now(),
  service_type text check (service_type in ('congelado', 'refrigerado', 'controlada', 'seco')),
  load_type text check (load_type in ('completa', 'parcial')),
  origin text,
  destination text,
  destination_province text,
  pallets int check (pallets is null or pallets > 0),
  weight_kg numeric(12, 2),
  load_date date,
  frequency text check (frequency in ('unica', 'semanal', 'quincenal', 'mensual')),
  description text,
  suggested_amount numeric(16, 2),
  quoted_amount numeric(16, 2),
  -- Primera vez que se envió precio al cliente (para medir tiempo de respuesta)
  sent_at timestamptz,
  decided_at timestamptz,
  valid_until date,
  lost_reason text,
  lost_notes text,
  next_followup_at date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists crm_quotes_stage_idx on public.crm_quotes (stage, position);
create index if not exists crm_quotes_company_idx on public.crm_quotes (company_id);
create index if not exists crm_quotes_received_idx on public.crm_quotes (received_at);

alter table public.crm_inbound_requests
  drop constraint if exists crm_inbound_requests_quote_fk;
alter table public.crm_inbound_requests
  add constraint crm_inbound_requests_quote_fk
  foreign key (quote_id) references public.crm_quotes (id) on delete set null;

-- Historial de cada cotización
create table if not exists public.crm_quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.crm_quotes (id) on delete cascade,
  kind text not null check (kind in ('created', 'stage', 'note', 'amount', 'update', 'sent')),
  from_stage text,
  to_stage text,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists crm_quote_events_quote_idx on public.crm_quote_events (quote_id, created_at);

-- ---------------------------------------------------------------------------
-- Tarifario de referencia (para sugerir precio). Origen: Buenos Aires.
-- ---------------------------------------------------------------------------
create table if not exists public.crm_rates (
  id uuid primary key default gen_random_uuid(),
  province text not null,
  price_per_pallet numeric(16, 2),
  price_full_truck numeric(16, 2),
  -- Recargo % para congelado sobre la tarifa base (refrigerado)
  frozen_surcharge_pct numeric(6, 2) not null default 0,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_rates_province_key on public.crm_rates (province);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists crm_companies_updated_at on public.crm_companies;
create trigger crm_companies_updated_at before update on public.crm_companies
  for each row execute procedure public.set_updated_at();
drop trigger if exists crm_contacts_updated_at on public.crm_contacts;
create trigger crm_contacts_updated_at before update on public.crm_contacts
  for each row execute procedure public.set_updated_at();
drop trigger if exists crm_quotes_updated_at on public.crm_quotes;
create trigger crm_quotes_updated_at before update on public.crm_quotes
  for each row execute procedure public.set_updated_at();
drop trigger if exists crm_rates_updated_at on public.crm_rates;
create trigger crm_rates_updated_at before update on public.crm_rates
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: sólo superadmin (el endpoint público usa service role)
-- ---------------------------------------------------------------------------
alter table public.crm_companies enable row level security;
alter table public.crm_company_aliases enable row level security;
alter table public.crm_contacts enable row level security;
alter table public.crm_inbound_requests enable row level security;
alter table public.crm_quotes enable row level security;
alter table public.crm_quote_events enable row level security;
alter table public.crm_rates enable row level security;

drop policy if exists "crm_superadmin" on public.crm_companies;
create policy "crm_superadmin" on public.crm_companies for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "crm_superadmin" on public.crm_company_aliases;
create policy "crm_superadmin" on public.crm_company_aliases for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "crm_superadmin" on public.crm_contacts;
create policy "crm_superadmin" on public.crm_contacts for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "crm_superadmin" on public.crm_inbound_requests;
create policy "crm_superadmin" on public.crm_inbound_requests for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "crm_superadmin" on public.crm_quotes;
create policy "crm_superadmin" on public.crm_quotes for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "crm_superadmin" on public.crm_quote_events;
create policy "crm_superadmin" on public.crm_quote_events for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "crm_superadmin" on public.crm_rates;
create policy "crm_superadmin" on public.crm_rates for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ---------------------------------------------------------------------------
-- Seeds: tarifario vacío con las provincias que se cubren hoy
-- ---------------------------------------------------------------------------
insert into public.crm_rates (province) values
  ('Catamarca'), ('Chaco'), ('Chubut'), ('Córdoba'), ('Corrientes'), ('Entre Ríos'),
  ('Formosa'), ('Jujuy'), ('La Rioja'), ('Mendoza'), ('Misiones'), ('Neuquén'),
  ('Río Negro'), ('Salta'), ('San Juan'), ('San Luis'), ('Tucumán')
on conflict (province) do nothing;
