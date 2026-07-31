-- 1) app_user_connections: explicit deny policy for app roles (server-only table)
REVOKE ALL ON public.app_user_connections FROM anon, authenticated;
GRANT ALL ON public.app_user_connections TO service_role;
DROP POLICY IF EXISTS "No app-user access to connection credentials" ON public.app_user_connections;
CREATE POLICY "No app-user access to connection credentials"
ON public.app_user_connections
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- 2) SECURITY DEFINER functions: remove direct execute access where not needed
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_challenge_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_challenge_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_challenge_by_code(text) TO authenticated;

-- 3) ideal_week_blocks: ensure referenced domain/goal belong to the same owner
CREATE OR REPLACE FUNCTION public.validate_ideal_week_block_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.domain_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.life_domains d WHERE d.id = NEW.domain_id AND d.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Area invalida para este usuario';
  END IF;
  IF NEW.goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.goals g WHERE g.id = NEW.goal_id AND g.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Meta invalida para este usuario';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_ideal_week_block_refs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_ideal_week_block_refs_trg ON public.ideal_week_blocks;
CREATE TRIGGER validate_ideal_week_block_refs_trg
BEFORE INSERT OR UPDATE ON public.ideal_week_blocks
FOR EACH ROW EXECUTE FUNCTION public.validate_ideal_week_block_refs();