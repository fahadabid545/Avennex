-- Documents on products and launchpad ideas: up to five files under one
-- heading and body. products.documents already exists on the live table,
-- the if not exists makes this a no-op there.

alter table products add column if not exists documents jsonb default '[]'::jsonb;
alter table products add column if not exists documents_heading text;
alter table products add column if not exists documents_body text;

alter table launchpad_entries add column if not exists documents jsonb default '[]'::jsonb;
alter table launchpad_entries add column if not exists documents_heading text;
alter table launchpad_entries add column if not exists documents_body text;
