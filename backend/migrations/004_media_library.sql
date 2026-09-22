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
