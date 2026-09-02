-- Avennex database schema
-- Run this in Supabase SQL Editor

-- Admins
create table admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text,
  created_at timestamptz default now()
);

alter table admins disable row level security;

-- Blogs
create table blogs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  content text,
  excerpt text,
  meta_description text,
  status text default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_at timestamptz
);

alter table blogs disable row level security;

-- Jobs
create table jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  requirements text,
  type text check (type in ('remote', 'onsite')),
  commitment text check (commitment in ('full-time', 'part-time')),
  status text default 'open' check (status in ('open', 'closed')),
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table jobs disable row level security;

-- Products
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  tagline text,
  description text,
  features jsonb,
  progress integer default 0 check (progress >= 0 and progress <= 100),
  status text default 'in-development' check (status in ('in-development', 'launched', 'paused')),
  display_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table products disable row level security;

-- Launchpad entries
create table launchpad_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  tagline text,
  description text,
  timeline text,
  funding_needed text,
  team_needed text,
  stage text default 'concept' check (stage in ('concept', 'planning', 'open-for-feedback', 'building')),
  status text default 'active' check (status in ('active', 'closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table launchpad_entries disable row level security;

-- Launchpad comments
create table launchpad_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references launchpad_entries(id) on delete cascade,
  author_name text not null,
  author_email text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table launchpad_comments disable row level security;

-- Refresh tokens
create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  revoked boolean default false,
  created_at timestamptz default now()
);

alter table refresh_tokens disable row level security;
