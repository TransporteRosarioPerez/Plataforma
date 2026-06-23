-- Una proforma activa solo puede tener una factura vinculada (1:1)

create unique index if not exists invoices_proforma_id_active_idx
  on public.invoices (proforma_id)
  where deleted_at is null and proforma_id is not null;
