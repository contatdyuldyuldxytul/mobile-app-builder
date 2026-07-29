CREATE TYPE public.task_status AS ENUM ('backlog', 'agendada', 'feita');
CREATE TYPE public.block_kind AS ENUM ('tarefa', 'pausa', 'livre');

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  notes text,
  domain_id uuid REFERENCES public.life_domains(id) ON DELETE SET NULL,
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  estimated_minutes integer NOT NULL DEFAULT 60,
  weekly_plan_id uuid REFERENCES public.weekly_plans(id) ON DELETE CASCADE,
  scheduled_date date,
  sort_order integer NOT NULL DEFAULT 0,
  status public.task_status NOT NULL DEFAULT 'backlog',
  allows_break boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own tasks" ON public.tasks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX tasks_user_week_idx ON public.tasks (user_id, weekly_plan_id);
CREATE INDEX tasks_user_date_idx ON public.tasks (user_id, scheduled_date);

ALTER TABLE public.time_blocks
  ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN block_kind public.block_kind NOT NULL DEFAULT 'tarefa',
  ADD COLUMN allows_break boolean NOT NULL DEFAULT true;

ALTER TABLE public.settings
  ADD COLUMN break_duration_minutes integer NOT NULL DEFAULT 15;