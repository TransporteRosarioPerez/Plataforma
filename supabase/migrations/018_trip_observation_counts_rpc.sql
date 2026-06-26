-- Agregación de observaciones por viaje (evita escanear toda la tabla en la app).
create or replace function public.get_trip_observation_counts()
returns table(trip_id uuid, observation_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select o.trip_id, count(*)::bigint
  from public.trip_observations o
  where o.deleted_at is null
  group by o.trip_id;
$$;

grant execute on function public.get_trip_observation_counts() to authenticated;
