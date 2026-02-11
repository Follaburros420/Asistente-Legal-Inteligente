-- Remove dependency on public.users in user_locations RLS policy

DROP POLICY IF EXISTS user_locations_select_owner_or_admin_authenticated ON public.user_locations;

CREATE POLICY user_locations_select_owner_authenticated
ON public.user_locations
FOR SELECT
TO authenticated
USING (user_id = (select auth.uid()));
