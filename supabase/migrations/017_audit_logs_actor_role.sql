-- Add actor_role snapshot for audit logs (if 016 was applied without this column)

alter table public.audit_logs
  add column if not exists actor_role text;

update public.audit_logs al
set actor_role = p.role
from public.profiles p
where al.actor_id = p.id
  and al.actor_role is null;

alter table public.audit_logs
  alter column actor_role set not null;

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
