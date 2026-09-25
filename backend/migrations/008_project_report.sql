-- The project report on products and launchpad ideas: roadmap, burn-up,
-- delivery pace, quality, speed, security, basics, team, feedback and
-- updates, kept together as one document per row.

alter table products add column if not exists report jsonb default '{}'::jsonb;
alter table launchpad_entries add column if not exists report jsonb default '{}'::jsonb;
