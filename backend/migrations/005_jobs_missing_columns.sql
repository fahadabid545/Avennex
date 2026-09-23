-- Columns the jobs table was missing in production.
-- location and good_to_have are read and written by the admin form and the
-- role page, and last_edited_by and last_edited_at are stamped on every save,
-- but none of the four existed on the live table. Every job save through the
-- panel failed until this ran.

alter table jobs add column if not exists location text;
alter table jobs add column if not exists good_to_have text;
alter table jobs add column if not exists last_edited_by text;
alter table jobs add column if not exists last_edited_at timestamptz;
