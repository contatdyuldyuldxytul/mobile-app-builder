CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.challenge_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);

CREATE TABLE public.challenge_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL,
  pct numeric NOT NULL DEFAULT 0,
  done_minutes integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_members TO authenticated;
GRANT ALL ON public.challenge_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_scores TO authenticated;
GRANT ALL ON public.challenge_scores TO service_role;

CREATE OR REPLACE FUNCTION public.is_challenge_member(_challenge_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenge_members
    WHERE challenge_id = _challenge_id AND user_id = _user_id
  )
$$;

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read challenges" ON public.challenges
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_challenge_member(id, auth.uid()));

CREATE POLICY "owner creates challenge" ON public.challenges
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner updates challenge" ON public.challenges
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner deletes challenge" ON public.challenges
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "read members of my challenges" ON public.challenge_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_challenge_member(challenge_id, auth.uid()));

CREATE POLICY "join self" ON public.challenge_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "update own membership" ON public.challenge_members
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "leave own membership" ON public.challenge_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "read scores of my challenges" ON public.challenge_scores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_challenge_member(challenge_id, auth.uid()));

CREATE POLICY "write own score" ON public.challenge_scores
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "update own score" ON public.challenge_scores
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete own score" ON public.challenge_scores
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER challenges_updated_at BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.join_challenge_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO _id FROM public.challenges WHERE upper(code) = upper(trim(_code));
  IF _id IS NULL THEN RAISE EXCEPTION 'codigo invalido'; END IF;
  INSERT INTO public.challenge_members (challenge_id, user_id, display_name)
  VALUES (_id, _uid, (SELECT display_name FROM public.profiles WHERE id = _uid))
  ON CONFLICT (challenge_id, user_id) DO NOTHING;
  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_challenge_by_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_challenge_by_code(text) TO authenticated;