-- Roles for admin accounts.
-- Existing accounts become owners so nobody is locked out by the upgrade.
-- New accounts default to editor, which the panel can raise afterwards.

alter table admins add column if not exists role text not null default 'owner';
alter table admins alter column role set default 'editor';

alter table admins drop constraint if exists admins_role_check;
alter table admins add constraint admins_role_check
  check (role in ('owner', 'admin', 'editor'));
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
-- Scheduled publishing for blog posts.
-- A post with status 'scheduled' goes live once publish_at has passed.

alter table blogs add column if not exists publish_at timestamptz;

alter table blogs drop constraint if exists blogs_status_check;
alter table blogs add constraint blogs_status_check
  check (status in ('draft', 'published', 'scheduled'));

create index if not exists blogs_scheduled_idx
  on blogs (publish_at)
  where status = 'scheduled';
-- Media library: one row per uploaded file.
-- Files uploaded before this table existed can be pulled in from the
-- file server with the Scan server button in the panel.

create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  remote_path text,
  filename text,
  context text,
  kind text default 'image',
  size_bytes integer,
  alt_text text,
  uploaded_by text,
  created_at timestamptz default now()
);

create index if not exists media_created_idx on media (created_at desc);
create index if not exists media_context_idx on media (context);
create unique index if not exists media_remote_path_idx on media (remote_path)
  where remote_path is not null;

alter table media disable row level security;

-- Columns the jobs table was missing in production.
-- location and good_to_have are read and written by the admin form and the
-- role page, and last_edited_by and last_edited_at are stamped on every save,
-- but none of the four existed on the live table. Every job save through the
-- panel failed until this ran.

alter table jobs add column if not exists location text;
alter table jobs add column if not exists good_to_have text;
alter table jobs add column if not exists last_edited_by text;
alter table jobs add column if not exists last_edited_at timestamptz;

-- resume_url never held a url. It holds the relative path the FTP service
-- returns, and every reader already treated it that way. The name was the
-- only thing that disagreed.
--
-- Run this at the same time as the deploy that carries the rename. The old
-- name and the new code cannot work together, so a gap between the two means
-- resume uploads and downloads fail until both sides match.
--
-- Guarded so a second run is a no-op, because a bare rename fails once the
-- column is already called resume_path.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'job_applications' and column_name = 'resume_url'
  ) then
    alter table job_applications rename column resume_url to resume_path;
  end if;
end $$;

-- Documents on products and launchpad ideas: up to five files under one
-- heading and body. products.documents already exists on the live table,
-- the if not exists makes this a no-op there.

alter table products add column if not exists documents jsonb default '[]'::jsonb;
alter table products add column if not exists documents_heading text;
alter table products add column if not exists documents_body text;

alter table launchpad_entries add column if not exists documents jsonb default '[]'::jsonb;
alter table launchpad_entries add column if not exists documents_heading text;
alter table launchpad_entries add column if not exists documents_body text;
