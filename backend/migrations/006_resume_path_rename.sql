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
