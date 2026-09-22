-- Roles for admin accounts.
-- Existing accounts become owners so nobody is locked out by the upgrade.
-- New accounts default to editor, which the panel can raise afterwards.

alter table admins add column if not exists role text not null default 'owner';
alter table admins alter column role set default 'editor';

alter table admins drop constraint if exists admins_role_check;
alter table admins add constraint admins_role_check
  check (role in ('owner', 'admin', 'editor'));
