-- RBAC: two roles (superadmin + ops)

-- Migrate legacy roles
update public.profiles
set role = 'superadmin'
where role in ('admin', 'accounting');

-- Restrict role values
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('superadmin', 'ops'));

-- New users default to ops (not superadmin)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'ops')
  );
  return new;
end;
$$;

-- RLS helpers
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  );
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- profiles: own row or superadmin sees all; only superadmin updates roles
drop policy if exists "authenticated_all" on public.profiles;

create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_superadmin());

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- invoices: superadmin only
drop policy if exists "authenticated_all" on public.invoices;

create policy "invoices_superadmin" on public.invoices
  for all to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- company_settings: read for all authenticated, write superadmin only
drop policy if exists "authenticated_all" on public.company_settings;

create policy "company_settings_select" on public.company_settings
  for select to authenticated
  using (true);

create policy "company_settings_insert" on public.company_settings
  for insert to authenticated
  with check (public.is_superadmin());

create policy "company_settings_update" on public.company_settings
  for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "company_settings_delete" on public.company_settings
  for delete to authenticated
  using (public.is_superadmin());
