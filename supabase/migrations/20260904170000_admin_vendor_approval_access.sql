-- Allow active admin-console users to approve, reject, suspend, and reactivate vendors.
-- Production vendor state is stored on public.vendor_profiles.verification_status.

BEGIN;

DROP POLICY IF EXISTS "Admins can update production vendors" ON public.vendor_profiles;
CREATE POLICY "Admins can update production vendors"
  ON public.vendor_profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT UPDATE ON public.vendor_profiles TO authenticated;

COMMIT;
