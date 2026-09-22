-- Scheduled publishing for blog posts.
-- A post with status 'scheduled' goes live once publish_at has passed.

alter table blogs add column if not exists publish_at timestamptz;

alter table blogs drop constraint if exists blogs_status_check;
alter table blogs add constraint blogs_status_check
  check (status in ('draft', 'published', 'scheduled'));

create index if not exists blogs_scheduled_idx
  on blogs (publish_at)
  where status = 'scheduled';
