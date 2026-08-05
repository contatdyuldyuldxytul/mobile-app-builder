CREATE OR REPLACE FUNCTION public.is_challenge_member(_challenge_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND _user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.challenge_members
       WHERE challenge_id = _challenge_id AND user_id = _user_id
     )
$$;

REVOKE ALL ON FUNCTION public.is_challenge_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_challenge_member(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.join_challenge_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_challenge_by_code(text) TO authenticated, service_role;