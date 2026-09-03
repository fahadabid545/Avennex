-- Settings table
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  updated_at timestamptz default now()
);
alter table settings disable row level security;
insert into settings (key, value) values ('chatbot_visible', 'false') on conflict (key) do nothing;

-- Email status tracking
alter table chat_messages add column if not exists email_status text;
alter table job_applications add column if not exists email_status text;
