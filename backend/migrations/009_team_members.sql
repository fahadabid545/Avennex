-- The people on the About page, managed from the panel. Five at most.
-- The seed only runs on an empty table, so running this twice changes nothing.

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default '',
  photo_url text,
  linkedin_url text,
  display_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_edited_by text,
  last_edited_at timestamptz
);

create index if not exists team_members_order_idx on team_members (display_order, created_at);

alter table team_members disable row level security;

insert into team_members (name, role, display_order)
select v.name, v.role, v.display_order
from (values
  ('Faizan', 'Founder', 0),
  ('Fahad', 'Co-founder', 1),
  ('Ahsan', 'Engineering', 2),
  ('Rafay', 'Engineering', 3),
  ('Saad', 'Engineering', 4)
) as v(name, role, display_order)
where not exists (select 1 from team_members);
