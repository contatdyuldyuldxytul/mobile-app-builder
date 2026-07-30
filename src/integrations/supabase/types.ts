export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_accounts: {
        Row: {
          created_at: string
          ics_url: string | null
          id: string
          label: string | null
          last_synced_at: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ics_url?: string | null
          id?: string
          label?: string | null
          last_synced_at?: string | null
          provider: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ics_url?: string | null
          id?: string
          label?: string | null
          last_synced_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events_cache: {
        Row: {
          account_id: string | null
          all_day: boolean
          attendees_count: number
          created_at: string
          end_at: string
          external_id: string
          id: string
          is_recurring: boolean
          start_at: string
          title: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          all_day?: boolean
          attendees_count?: number
          created_at?: string
          end_at: string
          external_id: string
          id?: string
          is_recurring?: boolean
          start_at: string
          title?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          all_day?: boolean
          attendees_count?: number
          created_at?: string
          end_at?: string
          external_id?: string
          id?: string
          is_recurring?: boolean
          start_at?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_cache_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_members: {
        Row: {
          challenge_id: string
          display_name: string | null
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          display_name?: string | null
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          display_name?: string | null
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_members_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_scores: {
        Row: {
          challenge_id: string
          date: string
          done_minutes: number
          id: string
          pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          date: string
          done_minutes?: number
          id?: string
          pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          date?: string
          done_minutes?: number
          id?: string
          pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_scores_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          code: string
          created_at: string
          end_date: string
          id: string
          name: string
          owner_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          owner_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          owner_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          created_at: string
          date: string
          energy: number | null
          honored_budget: boolean | null
          id: string
          mood: number | null
          reflection: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          energy?: number | null
          honored_budget?: boolean | null
          id?: string
          mood?: number | null
          reflection?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          energy?: number | null
          honored_budget?: boolean | null
          id?: string
          mood?: number | null
          reflection?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_plans: {
        Row: {
          created_at: string
          date: string
          devotional_reference: string | null
          devotional_reflection: string | null
          id: string
          intention: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          devotional_reference?: string | null
          devotional_reflection?: string | null
          id?: string
          intention?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          devotional_reference?: string | null
          devotional_reflection?: string | null
          id?: string
          intention?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          block_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          started_at: string
          took_break: boolean
          user_id: string
        }
        Insert: {
          block_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          took_break?: boolean
          user_id: string
        }
        Update: {
          block_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          took_break?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "time_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          description: string | null
          domain_id: string
          id: string
          monthly_plan_id: string | null
          priority: number
          status: Database["public"]["Enums"]["goal_status"]
          target: string | null
          target_hours: number | null
          title: string
          type: Database["public"]["Enums"]["goal_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          domain_id: string
          id?: string
          monthly_plan_id?: string | null
          priority?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target?: string | null
          target_hours?: number | null
          title: string
          type?: Database["public"]["Enums"]["goal_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          domain_id?: string
          id?: string
          monthly_plan_id?: string | null
          priority?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target?: string | null
          target_hours?: number | null
          title?: string
          type?: Database["public"]["Enums"]["goal_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "life_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_monthly_plan_id_fkey"
            columns: ["monthly_plan_id"]
            isOneToOne: false
            referencedRelation: "monthly_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date: string
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          created_at: string
          domain_id: string | null
          frequency: number[]
          id: string
          is_archived: boolean
          name: string
          type: Database["public"]["Enums"]["habit_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain_id?: string | null
          frequency?: number[]
          id?: string
          is_archived?: boolean
          name: string
          type?: Database["public"]["Enums"]["habit_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain_id?: string | null
          frequency?: number[]
          id?: string
          is_archived?: boolean
          name?: string
          type?: Database["public"]["Enums"]["habit_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habits_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "life_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      ideal_week_blocks: {
        Row: {
          created_at: string
          day_of_week: number
          domain_id: string | null
          end_time: string
          goal_id: string | null
          id: string
          is_focus_block: boolean
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          domain_id?: string | null
          end_time: string
          goal_id?: string | null
          id?: string
          is_focus_block?: boolean
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          domain_id?: string | null
          end_time?: string
          goal_id?: string | null
          id?: string
          is_focus_block?: boolean
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideal_week_blocks_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "life_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideal_week_blocks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      life_domains: {
        Row: {
          color: string
          created_at: string
          default_weekly_hours: number
          icon: string | null
          id: string
          is_anchor: boolean
          is_archived: boolean
          name: string
          preferred_days: number[]
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          default_weekly_hours?: number
          icon?: string | null
          id?: string
          is_anchor?: boolean
          is_archived?: boolean
          name: string
          preferred_days?: number[]
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          default_weekly_hours?: number
          icon?: string | null
          id?: string
          is_anchor?: boolean
          is_archived?: boolean
          name?: string
          preferred_days?: number[]
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_plans: {
        Row: {
          created_at: string
          id: string
          month: number
          notes: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          day_end: string
          day_start: string
          display_name: string | null
          id: string
          notification_prefs: Json
          notifications_enabled: boolean
          onboarding_completed: boolean
          spiritual_mode: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_end?: string
          day_start?: string
          display_name?: string | null
          id: string
          notification_prefs?: Json
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          spiritual_mode?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_end?: string
          day_start?: string
          display_name?: string | null
          id?: string
          notification_prefs?: Json
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          spiritual_mode?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      routine_patterns: {
        Row: {
          accepted: boolean
          confidence: number
          created_at: string
          day_of_week: number
          domain_id: string | null
          end_time: string
          id: string
          occurrences: number
          start_time: string
          suggested_area: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted?: boolean
          confidence?: number
          created_at?: string
          day_of_week: number
          domain_id?: string | null
          end_time: string
          id?: string
          occurrences?: number
          start_time: string
          suggested_area?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted?: boolean
          confidence?: number
          created_at?: string
          day_of_week?: number
          domain_id?: string | null
          end_time?: string
          id?: string
          occurrences?: number
          start_time?: string
          suggested_area?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          anchors_configured: boolean
          break_duration_minutes: number
          break_interval_minutes: number
          break_reminders_enabled: boolean
          breakfast_time: string
          created_at: string
          dinner_time: string
          distraction_limit_minutes: number
          evening_checkin_time: string
          last_daily_prompt_date: string | null
          last_weekly_prompt_date: string | null
          lunch_time: string
          morning_checkin_time: string
          onboarding_step: number
          sleep_hours_per_day: number
          snack_time: string
          updated_at: string
          user_id: string
          work_days: number[]
          work_hours_per_day: number
        }
        Insert: {
          anchors_configured?: boolean
          break_duration_minutes?: number
          break_interval_minutes?: number
          break_reminders_enabled?: boolean
          breakfast_time?: string
          created_at?: string
          dinner_time?: string
          distraction_limit_minutes?: number
          evening_checkin_time?: string
          last_daily_prompt_date?: string | null
          last_weekly_prompt_date?: string | null
          lunch_time?: string
          morning_checkin_time?: string
          onboarding_step?: number
          sleep_hours_per_day?: number
          snack_time?: string
          updated_at?: string
          user_id: string
          work_days?: number[]
          work_hours_per_day?: number
        }
        Update: {
          anchors_configured?: boolean
          break_duration_minutes?: number
          break_interval_minutes?: number
          break_reminders_enabled?: boolean
          breakfast_time?: string
          created_at?: string
          dinner_time?: string
          distraction_limit_minutes?: number
          evening_checkin_time?: string
          last_daily_prompt_date?: string | null
          last_weekly_prompt_date?: string | null
          lunch_time?: string
          morning_checkin_time?: string
          onboarding_step?: number
          sleep_hours_per_day?: number
          snack_time?: string
          updated_at?: string
          user_id?: string
          work_days?: number[]
          work_hours_per_day?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          allows_break: boolean
          created_at: string
          domain_id: string | null
          estimated_minutes: number
          goal_id: string | null
          id: string
          notes: string | null
          priority: number
          scheduled_date: string | null
          sort_order: number
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          user_id: string
          weekly_plan_id: string | null
        }
        Insert: {
          allows_break?: boolean
          created_at?: string
          domain_id?: string | null
          estimated_minutes?: number
          goal_id?: string | null
          id?: string
          notes?: string | null
          priority?: number
          scheduled_date?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          user_id: string
          weekly_plan_id?: string | null
        }
        Update: {
          allows_break?: boolean
          created_at?: string
          domain_id?: string | null
          estimated_minutes?: number
          goal_id?: string | null
          id?: string
          notes?: string | null
          priority?: number
          scheduled_date?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          user_id?: string
          weekly_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "life_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_weekly_plan_id_fkey"
            columns: ["weekly_plan_id"]
            isOneToOne: false
            referencedRelation: "weekly_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          allows_break: boolean
          block_kind: Database["public"]["Enums"]["block_kind"]
          completed: boolean
          confirmation: string | null
          confirmed_at: string | null
          created_at: string
          date: string
          domain_id: string | null
          end_time: string
          goal_id: string | null
          google_event_id: string | null
          id: string
          ideal_block_id: string | null
          is_focus_block: boolean
          notes: string | null
          start_time: string
          status: string
          task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allows_break?: boolean
          block_kind?: Database["public"]["Enums"]["block_kind"]
          completed?: boolean
          confirmation?: string | null
          confirmed_at?: string | null
          created_at?: string
          date: string
          domain_id?: string | null
          end_time: string
          goal_id?: string | null
          google_event_id?: string | null
          id?: string
          ideal_block_id?: string | null
          is_focus_block?: boolean
          notes?: string | null
          start_time: string
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allows_break?: boolean
          block_kind?: Database["public"]["Enums"]["block_kind"]
          completed?: boolean
          confirmation?: string | null
          confirmed_at?: string | null
          created_at?: string
          date?: string
          domain_id?: string | null
          end_time?: string
          goal_id?: string | null
          google_event_id?: string | null
          id?: string
          ideal_block_id?: string | null
          is_focus_block?: boolean
          notes?: string | null
          start_time?: string
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "life_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_blocks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_blocks_ideal_block_id_fkey"
            columns: ["ideal_block_id"]
            isOneToOne: false
            referencedRelation: "ideal_week_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_blocks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      time_budgets: {
        Row: {
          actual_hours: number
          created_at: string
          domain_id: string
          id: string
          planned_hours: number
          updated_at: string
          user_id: string
          weekly_plan_id: string
        }
        Insert: {
          actual_hours?: number
          created_at?: string
          domain_id: string
          id?: string
          planned_hours?: number
          updated_at?: string
          user_id: string
          weekly_plan_id: string
        }
        Update: {
          actual_hours?: number
          created_at?: string
          domain_id?: string
          id?: string
          planned_hours?: number
          updated_at?: string
          user_id?: string
          weekly_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_budgets_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "life_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_budgets_weekly_plan_id_fkey"
            columns: ["weekly_plan_id"]
            isOneToOne: false
            referencedRelation: "weekly_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_plans: {
        Row: {
          available_hours: number
          created_at: string
          id: string
          monthly_plan_id: string | null
          notes: string | null
          updated_at: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          available_hours?: number
          created_at?: string
          id?: string
          monthly_plan_id?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          week_start_date: string
        }
        Update: {
          available_hours?: number
          created_at?: string
          id?: string
          monthly_plan_id?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_plans_monthly_plan_id_fkey"
            columns: ["monthly_plan_id"]
            isOneToOne: false
            referencedRelation: "monthly_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_challenge_member: {
        Args: { _challenge_id: string; _user_id: string }
        Returns: boolean
      }
      join_challenge_by_code: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      block_kind: "tarefa" | "pausa" | "livre"
      goal_status: "nao_iniciada" | "em_andamento" | "concluida"
      goal_type: "pessoal" | "profissional"
      habit_type: "fazer" | "evitar"
      task_status: "backlog" | "agendada" | "feita"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      block_kind: ["tarefa", "pausa", "livre"],
      goal_status: ["nao_iniciada", "em_andamento", "concluida"],
      goal_type: ["pessoal", "profissional"],
      habit_type: ["fazer", "evitar"],
      task_status: ["backlog", "agendada", "feita"],
    },
  },
} as const
