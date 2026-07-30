-- 1. Chaves de conexão por usuário (somente servidor)
CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

-- 2. Contas de agenda
CREATE TABLE public.calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('google_calendar','microsoft_outlook','ics')),
  label text,
  ics_url text,
  status text NOT NULL DEFAULT 'conectado',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, ics_url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_accounts TO authenticated;
GRANT ALL ON public.calendar_accounts TO service_role;
ALTER TABLE public.calendar_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar accounts" ON public.calendar_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_calendar_accounts_updated_at BEFORE UPDATE ON public.calendar_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Cache de eventos lidos da agenda
CREATE TABLE public.calendar_events_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.calendar_accounts(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  is_recurring boolean NOT NULL DEFAULT false,
  attendees_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, account_id, external_id, start_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events_cache TO authenticated;
GRANT ALL ON public.calendar_events_cache TO service_role;
ALTER TABLE public.calendar_events_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar events" ON public.calendar_events_cache FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Padrões de rotina deduzidos
CREATE TABLE public.routine_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  day_of_week smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  occurrences integer NOT NULL DEFAULT 1,
  suggested_area text,
  confidence numeric NOT NULL DEFAULT 0,
  domain_id uuid,
  accepted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routine_patterns TO authenticated;
GRANT ALL ON public.routine_patterns TO service_role;
ALTER TABLE public.routine_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own routine patterns" ON public.routine_patterns FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_routine_patterns_updated_at BEFORE UPDATE ON public.routine_patterns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Registro em um toque
ALTER TABLE public.time_blocks
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation text;

-- 6. Rituais
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS morning_checkin_time time NOT NULL DEFAULT '07:30',
  ADD COLUMN IF NOT EXISTS evening_checkin_time time NOT NULL DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS break_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_step smallint NOT NULL DEFAULT 0;