-- Audit logs: immutable activity trail (superadmin read-only via RLS)

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  actor_email text not null,
  actor_name text not null,
  actor_role text not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  entity_label text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_created_at_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_action_created_at_idx on public.audit_logs (action, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_superadmin" on public.audit_logs
  for select to authenticated
  using (public.is_superadmin());

-- No direct INSERT/UPDATE/DELETE for authenticated; use RPC below.

create or replace function public.insert_audit_log(
  p_action text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_entity_label text default null,
  p_summary text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_email text;
  v_name text;
  v_role text;
  v_id uuid;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'not authenticated';
  end if;

  select email, name, role into v_email, v_name, v_role
  from public.profiles
  where id = v_actor_id;

  if v_email is null then
    raise exception 'profile not found';
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_email,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    entity_label,
    summary,
    metadata
  )
  values (
    v_actor_id,
    v_email,
    v_name,
    v_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_label,
    coalesce(p_summary, p_action),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.insert_audit_log(text, text, uuid, text, text, jsonb) to authenticated;

create or replace function public.purge_audit_logs()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
begin
  delete from public.audit_logs
  where created_at < now() - interval '90 days';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Optional: enable pg_cron in Supabase Dashboard and run:
-- select cron.schedule('purge-audit-logs', '0 3 * * *', $$select public.purge_audit_logs()$$);
