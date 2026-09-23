-- Avennex database schema
-- Run this in Supabase SQL Editor. Every statement is guarded, so it is
-- safe against a database that already holds some of these tables.
--
-- faqs, job_applications, chat_messages, playlists, videos, activity_log
-- and chatbot_documents were created by hand and never written down here.
-- Their columns, types, nullability and defaults below were reconciled
-- against information_schema on the live database, so they match what is
-- actually there. Constraints are a different story. information_schema
-- columns says nothing about foreign keys, unique constraints or indexes,
-- so those lines are the intended design rather than a confirmed reading
-- of production.

-- Admins
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor')),
  last_login_at timestamptz,
  reset_token text,
  reset_token_expires timestamptz,
  created_at timestamptz default now()
);

alter table admins disable row level security;

-- Blogs
create table if not exists blogs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  content text,
  excerpt text,
  meta_description text,
  cover_image text,
  author text,
  status text default 'draft' check (status in ('draft', 'published', 'scheduled')),
  publish_at timestamptz,
  last_edited_by text,
  last_edited_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz
);

create index if not exists blogs_scheduled_idx on blogs (publish_at) where status = 'scheduled';

alter table blogs disable row level security;

-- Jobs
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  requirements text,
  good_to_have text,
  type text check (type in ('remote', 'onsite', 'hybrid')),
  commitment text check (commitment in ('full-time', 'part-time', 'contract', 'internship')),
  location text,
  status text default 'open' check (status in ('open', 'closed')),
  expires_at timestamptz,
  custom_questions jsonb,
  max_applications integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table jobs disable row level security;

-- Products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  tagline text,
  description text,
  content text,
  features jsonb,
  progress integer default 0 check (progress >= 0 and progress <= 100),
  status text default 'in-development' check (status in ('in-development', 'launched', 'paused')),
  display_order integer default 0,
  timeline text,
  tech_stack text,
  chat_enabled boolean default false,
  cover_image text,
  start_date date,
  target_date date,
  milestones jsonb default '[]'::jsonb,
  progress_history jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table products disable row level security;

-- Product chat messages
create table if not exists product_chat_messages (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  author_name text,
  author_email text,
  message text not null,
  is_admin boolean default false,
  parent_id uuid references product_chat_messages(id) on delete cascade,
  email_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table product_chat_messages disable row level security;

-- Launchpad entries
create table if not exists launchpad_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  tagline text,
  description text,
  content text,
  timeline text,
  funding_needed text,
  team_needed text,
  tech_stack text,
  collaboration_details text,
  diagrams text,
  stage text default 'concept' check (stage in ('concept', 'planning', 'open-for-feedback', 'building')),
  status text default 'active' check (status in ('active', 'closed')),
  progress integer default 0 check (progress >= 0 and progress <= 100),
  start_date date,
  target_date date,
  milestones jsonb default '[]'::jsonb,
  progress_history jsonb default '[]'::jsonb,
  metrics jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table launchpad_entries disable row level security;

-- Launchpad comments
create table if not exists launchpad_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references launchpad_entries(id) on delete cascade,
  author_name text not null,
  author_email text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table launchpad_comments disable row level security;

-- Refresh tokens
create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  revoked boolean default false,
  created_at timestamptz default now()
);

alter table refresh_tokens disable row level security;

-- Content revisions
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

-- Media library
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
create unique index if not exists media_remote_path_idx on media (remote_path) where remote_path is not null;

alter table media disable row level security;

-- FAQs
create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_edited_by text,
  last_edited_at timestamptz,
  active boolean default true
);

-- the public list and the panel both sort on display_order, which defaults
-- to 0, so created_at is what keeps tied questions in a settled order
create index if not exists faqs_order_idx on faqs (display_order, created_at);

alter table faqs disable row level security;

-- Job applications
create table if not exists job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  name text not null,
  email text not null,
  resume_text text,
  cover_letter text,
  created_at timestamptz default now(),
  resume_url text,
  email_status text,
  custom_answers jsonb
);

create index if not exists job_applications_job_idx on job_applications (job_id);

alter table job_applications disable row level security;

-- Home board messages. A reply points at the message it answers.
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_email text,
  author_profession text,
  author_company text,
  message text not null,
  parent_id uuid references chat_messages(id) on delete cascade,
  is_admin boolean default false,
  created_at timestamptz default now(),
  email_status text,
  updated_at timestamptz default now()
);

create index if not exists chat_messages_parent_idx on chat_messages (parent_id);

alter table chat_messages disable row level security;

-- Academy playlists
create table if not exists playlists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table playlists disable row level security;

-- Academy videos
create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references playlists(id) on delete cascade,
  title text not null,
  description text,
  youtube_url text not null,
  display_order integer default 0,
  created_at timestamptz default now()
);

-- No thumbnail_url column on purpose. Playlist reads derive it from
-- youtube_url, so storing it would only be a second copy to keep in step.

create index if not exists videos_playlist_idx on videos (playlist_id, display_order);

alter table videos disable row level security;

-- Admin activity log. entity_id is text, not uuid, because not every
-- logged action points at a row. The jobs cleanup passes an empty string
-- and a settings update passes the setting key.
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid,
  admin_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_title text,
  created_at timestamptz default now()
);

create index if not exists activity_log_created_idx on activity_log (created_at desc);

alter table activity_log disable row level security;

-- Chatbot source documents
create table if not exists chatbot_documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  file_type text not null,
  chunk_count integer default 0,
  status text default 'processing',
  created_at timestamptz default now(),
  error text
);

alter table chatbot_documents disable row level security;

-- One row per chatbot answer, counted for the usage chart
create table if not exists chatbot_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

alter table chatbot_requests disable row level security;

-- Site settings, read as strings and parsed by the caller
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  updated_at timestamptz default now()
);

alter table settings disable row level security;
