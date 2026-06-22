-- MVP v1: documentos libres por entidad (sin catálogo document_types)

alter table public.entity_documents
  add column if not exists name text;

update public.entity_documents ed
set name = dt.name
from public.document_types dt
where ed.document_type_id = dt.id
  and (ed.name is null or ed.name = '');

update public.entity_documents
set name = 'Documento'
where name is null or name = '';

alter table public.entity_documents
  alter column name set not null;

alter table public.entity_documents
  drop constraint if exists entity_documents_document_type_id_fkey;

alter table public.entity_documents
  drop column if exists document_type_id;

drop table if exists public.document_types;
