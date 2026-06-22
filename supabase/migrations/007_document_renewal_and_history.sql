-- Renovación e historial por documento (sin catálogo document_types)
-- Cada fila es una versión; document_group_id agrupa versiones del mismo documento.

drop index if exists entity_documents_current_type_idx;

alter table public.entity_documents
  drop constraint if exists entity_documents_document_type_id_fkey;

alter table public.entity_documents
  drop column if exists document_type_id;

drop table if exists public.document_types;

alter table public.entity_documents
  add column if not exists renewal_frequency text not null default 'once'
    check (renewal_frequency in ('monthly', 'biannual', 'yearly', 'triennial', 'once')),
  add column if not exists document_group_id uuid,
  add column if not exists is_current boolean not null default true,
  add column if not exists superseded_at timestamptz;

update public.entity_documents
set document_group_id = id
where document_group_id is null;

alter table public.entity_documents
  alter column document_group_id set not null;

create unique index if not exists entity_documents_current_group_idx
  on public.entity_documents (entity_id, entity_type, document_group_id)
  where is_current = true;
