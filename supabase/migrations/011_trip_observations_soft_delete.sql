-- Soft delete para observaciones de viaje

alter table public.trip_observations add column if not exists deleted_at timestamptz;

create index if not exists trip_observations_deleted_at_idx
  on public.trip_observations (deleted_at);
