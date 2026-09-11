-- Settings table
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  updated_at timestamptz default now()
);
alter table settings disable row level security;
insert into settings (key, value) values ('chatbot_visible', 'false') on conflict (key) do nothing;
insert into settings (key, value) values ('emails_enabled', 'true') on conflict (key) do nothing;
insert into settings (key, value) values ('chat_show_details', 'true') on conflict (key) do nothing;

-- Email status tracking
alter table chat_messages add column if not exists email_status text;
alter table job_applications add column if not exists email_status text;

-- Product and launchpad dashboards
alter table products add column if not exists dashboard jsonb;
alter table launchpad_entries add column if not exists dashboard jsonb;

-- Roadmap, milestones and progress history (admin managed)
alter table products add column if not exists start_date date;
alter table products add column if not exists target_date date;
alter table products add column if not exists milestones jsonb default '[]'::jsonb;
alter table products add column if not exists progress_history jsonb default '[]'::jsonb;

alter table launchpad_entries add column if not exists start_date date;
alter table launchpad_entries add column if not exists target_date date;
alter table launchpad_entries add column if not exists milestones jsonb default '[]'::jsonb;
alter table launchpad_entries add column if not exists progress integer default 0;
alter table launchpad_entries add column if not exists progress_history jsonb default '[]'::jsonb;
alter table launchpad_entries add column if not exists metrics jsonb default '[]'::jsonb;
alter table products add column if not exists metrics jsonb default '[]'::jsonb;
