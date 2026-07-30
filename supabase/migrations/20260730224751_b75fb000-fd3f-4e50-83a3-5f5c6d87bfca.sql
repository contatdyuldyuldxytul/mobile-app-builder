REVOKE ALL ON FUNCTION public.is_challenge_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_challenge_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_challenge_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_challenge_by_code(text) TO authenticated, service_role;