# Migrations

Run these in the Supabase SQL Editor, in order. Each one is safe to run
twice. `run_all.sql` is the four files joined together if you would rather
paste one block.

| File | What it adds |
| --- | --- |
| `001_admin_roles.sql` | `admins.role`, with owner, admin and editor |
| `002_content_revisions.sql` | `content_revisions`, the edit history |
| `003_blog_scheduling.sql` | `blogs.publish_at` and the `scheduled` status |
| `004_media_library.sql` | `media`, the uploaded file library |

Existing admin accounts become owners, so nobody loses access. Accounts
added after that start as editors and you raise them in the panel.

Once `004` is in, open Media in the panel and press Scan server to pull in
files that were uploaded before the library existed.
