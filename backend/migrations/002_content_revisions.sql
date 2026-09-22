-- Edit history for blogs, jobs, products, launchpad entries and FAQs.
-- One row per edit, holding the record as it stood before that edit.

create table if not exists content_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('blog', 'job', 'product', 'launchpad', 'faq')),
  entity_id uuid not null,
  snapshot jsonb not null,
  admin_email text,
  created_at timestamptz default now()
);

create index if not exists content_revisions_entity_idx
  on content_revisions (entity_type, entity_id, created_at desc);

alter table content_revisions disable row level security;
