-- =============================================================================
-- 026 · CRM: prospección por mail (cargas de vuelta)
--
-- Base de empresas a las que se les ofrece carga de retorno (ej.: fruta del
-- Alto Valle o de Tucumán hacia Buenos Aires) y secuencias de mails que salen
-- desde la casilla de Gmail conectada a la plataforma.
--
--   crm_outreach_routes     rutas de vuelta (Alto Valle, NOA…) y qué día se vuelve
--   crm_prospects           empresas a contactar
--   crm_outreach_templates  mails de la secuencia (paso 1 + seguimientos)
--   crm_outreach            una secuencia en curso por prospecto (hilo de Gmail)
--   crm_outreach_messages   cada mail enviado
--   crm_email_suppressions  bajas y rebotes: nunca se les vuelve a escribir
--   crm_gmail_connection    la casilla conectada (token cifrado; sólo service role)
--
-- Cuando un prospecto responde, el job crea un pedido en crm_inbound_requests
-- (Bandeja de entrada) con canal 'email'.
-- Acceso: superadmin. El job (/api/cron/crm-outreach) usa service role.
-- Se puede volver a correr.
-- =============================================================================

create table if not exists public.crm_outreach_routes (
  key text primary key,
  label text not null,
  provinces text[] not null default '{}',
  -- Texto libre que se usa en los mails: "los jueves", "todas las semanas"
  return_day text,
  position int not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.crm_outreach_routes (key, label, provinces, position) values
  ('alto_valle', 'Alto Valle (Río Negro y Neuquén)', array['Río Negro', 'Neuquén'], 1),
  ('noa', 'Tucumán y NOA', array['Tucumán', 'Salta', 'Jujuy', 'Catamarca', 'Santiago del Estero'], 2),
  ('litoral', 'Litoral', array['Entre Ríos', 'Corrientes', 'Misiones', 'Chaco', 'Formosa', 'Santa Fe'], 3),
  ('cuyo', 'Cuyo', array['Mendoza', 'San Juan', 'San Luis'], 4),
  ('centro', 'Córdoba y La Rioja', array['Córdoba', 'La Rioja'], 5),
  ('patagonia', 'Patagonia sur', array['Chubut', 'Santa Cruz', 'Tierra del Fuego'], 6),
  ('otra', 'Otra / Buenos Aires', array['Buenos Aires', 'CABA', 'La Pampa'], 7)
on conflict (key) do nothing;

create table if not exists public.crm_prospects (
  id uuid primary key default gen_random_uuid(),
  -- Si ya existe en Empresas del CRM (cliente o consultó antes)
  company_id uuid references public.crm_companies (id) on delete set null,
  company_name text not null,
  name_norm text not null,
  route_key text references public.crm_outreach_routes (key) on update cascade on delete set null,
  province text,
  city text,
  products text,
  contact_name text,
  contact_role text,
  email text,
  phone text,
  website text,
  priority text not null default 'media' check (priority in ('alta', 'media', 'baja')),
  -- Línea personalizada para el primer mail ({gancho})
  hook text,
  source text,
  source_url text,
  notes text,
  status text not null default 'nuevo' check (status in (
    'nuevo', 'en_secuencia', 'respondio', 'cotizando', 'ganado', 'perdido', 'sin_respuesta', 'baja', 'rebotado'
  )),
  last_contacted_at timestamptz,
  replied_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists crm_prospects_email_key
  on public.crm_prospects (lower(email)) where deleted_at is null and email is not null;
create index if not exists crm_prospects_status_idx on public.crm_prospects (status);
create index if not exists crm_prospects_route_idx on public.crm_prospects (route_key);
create index if not exists crm_prospects_name_idx on public.crm_prospects (name_norm);

create table if not exists public.crm_outreach_templates (
  id uuid primary key default gen_random_uuid(),
  sequence text not null default 'vuelta',
  step int not null check (step between 1 and 6),
  -- Días desde el primer mail
  delay_days int not null default 0 check (delay_days >= 0),
  -- Sólo se usa en el paso 1; los seguimientos van como "Re:" en el mismo hilo
  subject text not null default '',
  body text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_outreach_templates_step_key
  on public.crm_outreach_templates (sequence, step);

create table if not exists public.crm_outreach (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.crm_prospects (id) on delete cascade,
  sequence text not null default 'vuelta',
  status text not null default 'activa' check (status in (
    'activa', 'pausada', 'respondida', 'terminada', 'cancelada', 'rebotada', 'baja', 'error'
  )),
  next_step int not null default 1,
  next_send_at timestamptz,
  to_email text not null,
  subject text,
  gmail_thread_id text,
  last_rfc_message_id text,
  rfc_references text,
  send_attempts int not null default 0,
  last_checked_at timestamptz,
  replied_at timestamptz,
  inbound_request_id uuid references public.crm_inbound_requests (id) on delete set null,
  error text,
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_outreach_one_open_key
  on public.crm_outreach (prospect_id) where status in ('activa', 'pausada');
create unique index if not exists crm_outreach_unsubscribe_key on public.crm_outreach (unsubscribe_token);
create index if not exists crm_outreach_due_idx on public.crm_outreach (status, next_send_at);

create table if not exists public.crm_outreach_messages (
  id uuid primary key default gen_random_uuid(),
  outreach_id uuid not null references public.crm_outreach (id) on delete cascade,
  step int not null,
  to_email text not null,
  subject text,
  body text,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  gmail_message_id text,
  rfc_message_id text,
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists crm_outreach_messages_outreach_idx on public.crm_outreach_messages (outreach_id, step);
create index if not exists crm_outreach_messages_sent_idx on public.crm_outreach_messages (sent_at);

create table if not exists public.crm_email_suppressions (
  email text primary key,
  reason text not null check (reason in ('baja', 'rebote', 'respondio_no', 'manual')),
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_gmail_connection (
  id int primary key default 1 check (id = 1),
  email text not null,
  -- AES-256-GCM con CRM_GMAIL_TOKEN_KEY (lo cifra la app)
  refresh_token_enc text not null,
  sender_name text not null default 'Rosario Perez',
  signature text not null default E'Rosario Perez\nTransporte Rosario Perez\nWhatsApp 3329 64-3639',
  daily_limit int not null default 25 check (daily_limit between 1 and 200),
  send_hour_from int not null default 9 check (send_hour_from between 0 and 23),
  send_hour_to int not null default 18 check (send_hour_to between 1 and 24),
  weekdays_only boolean not null default true,
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text
);

-- Triggers updated_at
drop trigger if exists crm_prospects_updated_at on public.crm_prospects;
create trigger crm_prospects_updated_at before update on public.crm_prospects
  for each row execute procedure public.set_updated_at();
drop trigger if exists crm_outreach_updated_at on public.crm_outreach;
create trigger crm_outreach_updated_at before update on public.crm_outreach
  for each row execute procedure public.set_updated_at();
drop trigger if exists crm_outreach_templates_updated_at on public.crm_outreach_templates;
create trigger crm_outreach_templates_updated_at before update on public.crm_outreach_templates
  for each row execute procedure public.set_updated_at();
drop trigger if exists crm_outreach_routes_updated_at on public.crm_outreach_routes;
create trigger crm_outreach_routes_updated_at before update on public.crm_outreach_routes
  for each row execute procedure public.set_updated_at();

-- RLS: superadmin. crm_gmail_connection sin políticas: sólo service role (guarda el token).
alter table public.crm_outreach_routes enable row level security;
alter table public.crm_prospects enable row level security;
alter table public.crm_outreach_templates enable row level security;
alter table public.crm_outreach enable row level security;
alter table public.crm_outreach_messages enable row level security;
alter table public.crm_email_suppressions enable row level security;
alter table public.crm_gmail_connection enable row level security;

drop policy if exists "crm_superadmin" on public.crm_outreach_routes;
create policy "crm_superadmin" on public.crm_outreach_routes for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "crm_superadmin" on public.crm_prospects;
create policy "crm_superadmin" on public.crm_prospects for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "crm_superadmin" on public.crm_outreach_templates;
create policy "crm_superadmin" on public.crm_outreach_templates for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "crm_superadmin" on public.crm_outreach;
create policy "crm_superadmin" on public.crm_outreach for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "crm_superadmin" on public.crm_outreach_messages;
create policy "crm_superadmin" on public.crm_outreach_messages for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
drop policy if exists "crm_superadmin" on public.crm_email_suppressions;
create policy "crm_superadmin" on public.crm_email_suppressions for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ---------------------------------------------------------------------------
-- Secuencia "vuelta": 4 mails. Variables: {saludo} {empresa} {provincia}
-- {localidad} {productos} {dia_vuelta} {gancho} {firma}. Lo que va entre
-- [[ ]] se omite si alguna variable de adentro está vacía.
-- ---------------------------------------------------------------------------
insert into public.crm_outreach_templates (sequence, step, delay_days, subject, body) values
('vuelta', 1, 0, 'Vuelta refrigerada {provincia} → Buenos Aires',
E'{saludo}\n\n[[{gancho}\n\n]]Somos Transporte Rosario Perez, de San Pedro (Buenos Aires). Hace 30 años llevamos carga refrigerada y congelada de Buenos Aires a {provincia}[[, volvemos {dia_vuelta}]] y en la vuelta tenemos lugar libre en el semi térmico.\n\nSi mandan {productos} a Buenos Aires para el mercado interno (Mercado Central, supermercados o centros de distribución), lo podemos traer en esa vuelta: desde pocos pallets hasta el semi completo de 30, con GPS y registro de temperatura. Al ser carga de retorno, el precio es más conveniente que un flete dedicado.\n\n¿Les paso precio para un viaje {localidad} → Buenos Aires? Con la cantidad de pallets les respondo en el día.\n\n{firma}\n\nSi no les interesa, respondan "no" y no les vuelvo a escribir.'),
('vuelta', 2, 4, '',
E'{saludo}\n\n¿Pudieron ver mi mensaje?[[ Volvemos desde {provincia} {dia_vuelta}.]] Tenemos lugar en el semi refrigerado para traer carga a Buenos Aires.\n\nSi me pasan cantidad de pallets y fecha, les cotizo en el día.\n\n{firma}\n\nSi no les interesa, respondan "no" y no les vuelvo a escribir.'),
('vuelta', 3, 10, '',
E'{saludo}\n\nTodas las semanas tenemos lugar en la vuelta desde {provincia}. Si en algún momento necesitan mover {productos} a Buenos Aires, aunque sean pocos pallets, escríbanme y les paso precio en el día.\n\n{firma}\n\nSi no les interesa, respondan "no" y no les vuelvo a escribir.'),
('vuelta', 4, 18, '',
E'{saludo}\n\nNo quiero llenarles la casilla, así que este es mi último mensaje. Si más adelante necesitan traer carga refrigerada de {provincia} a Buenos Aires, respondan este mail o escríbanme por WhatsApp al 3329 64-3639.\n\n{firma}')
on conflict (sequence, step) do nothing;
