ALTER TABLE public.life_domains
  ADD COLUMN IF NOT EXISTS preferred_days smallint[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::smallint[];

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS last_daily_prompt_date date,
  ADD COLUMN IF NOT EXISTS last_weekly_prompt_date date;