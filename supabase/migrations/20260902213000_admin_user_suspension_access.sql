-- Allow active admin-console users to read and moderate platform users.
-- Production user account state is stored on public.profiles.account_status.

BEGIN;

-- Profiles are the canonical production user records. Admins need to read all
-- platform users and update moderation fields such as account_status.
DROP POLICY IF EXISTS "Admins can view production profiles" ON public.profiles;
CREATE POLICY "Admins can view production profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update production profiles" ON public.profiles;
CREATE POLICY "Admins can update production profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- User roles and role names power the Users page filters and labels.
DROP POLICY IF EXISTS "Admins can view production user roles" ON public.user_roles;
CREATE POLICY "Admins can view production user roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view production roles" ON public.roles;
CREATE POLICY "Admins can view production roles"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.roles TO authenticated;

COMMIT;
