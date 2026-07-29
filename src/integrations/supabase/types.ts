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
          domain_id: string | null
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
          domain_id?: string | null
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
          domain_id?: string | null
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
      life_domains: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          name?: string
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
      settings: {
        Row: {
          break_interval_minutes: number
          created_at: string
          distraction_limit_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          break_interval_minutes?: number
          created_at?: string
          distraction_limit_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          break_interval_minutes?: number
          created_at?: string
          distraction_limit_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_blocks: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          domain_id: string | null
          end_time: string
          goal_id: string | null
          google_event_id: string | null
          id: string
          is_focus_block: boolean
          notes: string | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date: string
          domain_id?: string | null
          end_time: string
          goal_id?: string | null
          google_event_id?: string | null
          id?: string
          is_focus_block?: boolean
          notes?: string | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          domain_id?: string | null
          end_time?: string
          goal_id?: string | null
          google_event_id?: string | null
          id?: string
          is_focus_block?: boolean
          notes?: string | null
          start_time?: string
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
      [_ in never]: never
    }
    Enums: {
      goal_status: "nao_iniciada" | "em_andamento" | "concluida"
      goal_type: "pessoal" | "profissional"
      habit_type: "fazer" | "evitar"
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
      goal_status: ["nao_iniciada", "em_andamento", "concluida"],
      goal_type: ["pessoal", "profissional"],
      habit_type: ["fazer", "evitar"],
    },
  },
} as const
