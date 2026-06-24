-- Vacía datos operativos para re-migrar desde el legado (Neon).
-- NO borra: auth.users, profiles, company_settings, expense_categories, document_types.
--
-- Ejecutar en Supabase → SQL Editor antes de `pnpm migrate:legacy`.
-- Revisar el conteo con `pnpm reset:legacy-data -- --dry-run` si preferís el CLI.

begin;

truncate table
  public.notification_log,
  public.proforma_line_items,
  public.invoices,
  public.proformas,
  public.fuel_transactions,
  public.fuel_import_batches,
  public.inventory_movements,
  public.inventory_items,
  public.inventory_categories,
  public.trip_observations,
  public.trip_expenses,
  public.trip_documents,
  public.trips,
  public.entity_documents,
  public.legacy_id_map,
  public.arcor_clients,
  public.clients,
  public.vehicles,
  public.drivers
restart identity cascade;

commit;
