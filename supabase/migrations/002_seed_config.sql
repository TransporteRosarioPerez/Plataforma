-- Expense categories seed
insert into public.expense_categories (code, name, is_default, is_active) values
  ('combustible', 'Combustible', true, true),
  ('peajes', 'Peajes', true, true),
  ('viaticos', 'Viáticos', true, true),
  ('reparaciones', 'Reparaciones en Ruta', true, true),
  ('anticipo_chofer', 'Anticipo al Chofer', true, true),
  ('estacionamiento', 'Estacionamiento', true, true),
  ('lavado', 'Lavado', true, true),
  ('otros', 'Otros', true, true)
on conflict (code) do nothing;

-- Document types seed (subset from lib/types SEED_*)
insert into public.document_types (code, name, entity_type, renewal_frequency, days_before_warning, description, is_default, is_active) values
  ('cert_satelital', 'Certificado Seguimiento Satelital', 'vehicle', 'monthly', 7, 'Sitrack/Hawk', true, true),
  ('vtv', 'Técnica Vehicular (VTV)', 'vehicle', 'yearly', 30, null, true, true),
  ('poliza_seguro', 'Póliza de Seguro', 'vehicle', 'biannual', 30, null, true, true),
  ('carnet_conducir', 'Carnet de Conducir', 'driver', 'yearly', 30, null, true, true),
  ('dni', 'DNI', 'driver', 'once', 0, null, true, true),
  ('ingresos_brutos', 'Ingresos Brutos', 'company', 'monthly', 7, null, true, true)
on conflict (code, entity_type) do nothing;
