-- MVP v1: alert settings + notification log

alter table public.company_settings
  add column if not exists alert_enabled boolean not null default false,
  add column if not exists alert_webhook_url text,
  add column if not exists alert_whatsapp_phones text[] not null default '{}',
  add column if not exists alert_days_before int not null default 7;

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.entity_documents (id) on delete cascade,
  channel text not null default 'whatsapp_webhook',
  sent_at timestamptz not null default now(),
  status text not null default 'sent' check (status in ('sent', 'failed')),
  payload jsonb not null default '{}'
);

create index if not exists notification_log_document_sent_idx
  on public.notification_log (document_id, sent_at desc);

alter table public.notification_log enable row level security;
create policy "authenticated_all" on public.notification_log
  for all to authenticated using (true) with check (true);
