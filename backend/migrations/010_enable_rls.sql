-- Row level security on every table in the public schema.
-- No policies are added, so the anon and authenticated keys can't read or
-- write anything through the Data API. The backend connects with the
-- service role key, which bypasses RLS, so it keeps working as before.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Check: every row should show rowsecurity = true.
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
