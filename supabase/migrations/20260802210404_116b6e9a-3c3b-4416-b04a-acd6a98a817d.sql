CREATE TABLE public.guardian_appearances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guardiao text NOT NULL,
  shown_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, guardiao, shown_on)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guardian_appearances TO authenticated;
GRANT ALL ON public.guardian_appearances TO service_role;

ALTER TABLE public.guardian_appearances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own guardian appearances"
ON public.guardian_appearances FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX guardian_appearances_user_day_idx ON public.guardian_appearances (user_id, shown_on DESC);

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS guardian_sounds_enabled boolean NOT NULL DEFAULT true;