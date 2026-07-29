-- 1. Dedupe life_domains by (user_id, lower(name))
WITH ranked AS (
  SELECT id, user_id, lower(name) AS lname,
         first_value(id) OVER (PARTITION BY user_id, lower(name) ORDER BY created_at, id) AS keep_id
  FROM public.life_domains
), dupes AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE public.goals g SET domain_id = d.keep_id FROM dupes d WHERE g.domain_id = d.id;

WITH ranked AS (
  SELECT id, user_id, lower(name) AS lname,
         first_value(id) OVER (PARTITION BY user_id, lower(name) ORDER BY created_at, id) AS keep_id
  FROM public.life_domains
), dupes AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE public.time_blocks t SET domain_id = d.keep_id FROM dupes d WHERE t.domain_id = d.id;

WITH ranked AS (
  SELECT id, user_id, lower(name) AS lname,
         first_value(id) OVER (PARTITION BY user_id, lower(name) ORDER BY created_at, id) AS keep_id
  FROM public.life_domains
), dupes AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
UPDATE public.habits h SET domain_id = d.keep_id FROM dupes d WHERE h.domain_id = d.id;

WITH ranked AS (
  SELECT id, user_id, lower(name) AS lname,
         first_value(id) OVER (PARTITION BY user_id, lower(name) ORDER BY created_at, id) AS keep_id
  FROM public.life_domains
), dupes AS (
  SELECT id, keep_id FROM ranked WHERE id <> keep_id
)
DELETE FROM public.time_budgets b USING dupes d WHERE b.domain_id = d.id;

WITH ranked AS (
  SELECT id, user_id, lower(name) AS lname,
         first_value(id) OVER (PARTITION BY user_id, lower(name) ORDER BY created_at, id) AS keep_id
  FROM public.life_domains
), dupes AS (
  SELECT id FROM ranked WHERE id <> keep_id
)
DELETE FROM public.life_domains l USING dupes d WHERE l.id = d.id;

-- 2. Anchor support on life_domains
ALTER TABLE public.life_domains
  ADD COLUMN IF NOT EXISTS is_anchor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_weekly_hours numeric NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS life_domains_user_name_key
  ON public.life_domains (user_id, lower(name));

-- 3. Anchors stored in settings
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS sleep_hours_per_day numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS work_hours_per_day numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS work_days smallint[] NOT NULL DEFAULT ARRAY[0,1,2,3,4]::smallint[],
  ADD COLUMN IF NOT EXISTS anchors_configured boolean NOT NULL DEFAULT false;

-- 4. Weekly budget: 168h reference + uniqueness for upserts
ALTER TABLE public.weekly_plans ALTER COLUMN available_hours SET DEFAULT 168;
CREATE UNIQUE INDEX IF NOT EXISTS time_budgets_plan_domain_key
  ON public.time_budgets (weekly_plan_id, domain_id);

-- 5. Ideal week template
CREATE TABLE IF NOT EXISTS public.ideal_week_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_of_week smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  domain_id uuid REFERENCES public.life_domains(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  title text NOT NULL,
  is_focus_block boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ideal_week_blocks TO authenticated;
GRANT ALL ON public.ideal_week_blocks TO service_role;
ALTER TABLE public.ideal_week_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own ideal week" ON public.ideal_week_blocks;
CREATE POLICY "own ideal week" ON public.ideal_week_blocks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_ideal_week_updated_at ON public.ideal_week_blocks;
CREATE TRIGGER set_ideal_week_updated_at BEFORE UPDATE ON public.ideal_week_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS ideal_week_blocks_user_day_idx
  ON public.ideal_week_blocks (user_id, day_of_week, start_time);

-- 6. Real day blocks: status + link back to template
ALTER TABLE public.time_blocks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'planejado',
  ADD COLUMN IF NOT EXISTS ideal_block_id uuid REFERENCES public.ideal_week_blocks(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS time_blocks_generated_key
  ON public.time_blocks (user_id, date, ideal_block_id)
  WHERE ideal_block_id IS NOT NULL;

-- 7. Goals must belong to a life domain
UPDATE public.goals g
SET domain_id = (
  SELECT l.id FROM public.life_domains l
  WHERE l.user_id = g.user_id AND l.is_archived = false
  ORDER BY l.sort_order, l.created_at LIMIT 1
)
WHERE g.domain_id IS NULL;

DELETE FROM public.goals WHERE domain_id IS NULL;

ALTER TABLE public.goals ALTER COLUMN domain_id SET NOT NULL;