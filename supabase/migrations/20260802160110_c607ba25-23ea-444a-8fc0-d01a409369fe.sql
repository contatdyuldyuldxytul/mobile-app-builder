ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS wake_time time NOT NULL DEFAULT '06:00',
  ADD COLUMN IF NOT EXISTS focus_cycle_minutes integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS meal_breakfast_minutes integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS meal_lunch_minutes integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS meal_snack_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS meal_dinner_minutes integer NOT NULL DEFAULT 40;

ALTER TABLE public.life_domains
  ADD COLUMN IF NOT EXISTS preferred_period text NOT NULL DEFAULT 'qualquer';

ALTER TABLE public.life_domains
  DROP CONSTRAINT IF EXISTS life_domains_preferred_period_check;

ALTER TABLE public.life_domains
  ADD CONSTRAINT life_domains_preferred_period_check
  CHECK (preferred_period IN ('manha','tarde','noite','qualquer'));