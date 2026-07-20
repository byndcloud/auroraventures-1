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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      call_fields: {
        Row: {
          call_id: string
          created_at: string
          display_order: number
          field_type: string
          id: string
          label: string
          options: Json | null
          placeholder: string | null
          required: boolean
        }
        Insert: {
          call_id: string
          created_at?: string
          display_order?: number
          field_type?: string
          id?: string
          label: string
          options?: Json | null
          placeholder?: string | null
          required?: boolean
        }
        Update: {
          call_id?: string
          created_at?: string
          display_order?: number
          field_type?: string
          id?: string
          label?: string
          options?: Json | null
          placeholder?: string | null
          required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "call_fields_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_responses: {
        Row: {
          call_id: string
          created_at: string
          id: string
          respondent_email: string | null
          response_data: Json
          user_id: string | null
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          respondent_email?: string | null
          response_data?: Json
          user_id?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          respondent_email?: string | null
          response_data?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_responses_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
        ]
      }
      calls: {
        Row: {
          call_type: string
          created_at: string
          created_by: string | null
          deadline: string | null
          description: string
          id: string
          status: string
          title: string
          updated_at: string
          vertical: string | null
          visibility: string
        }
        Insert: {
          call_type?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string
          id?: string
          status?: string
          title: string
          updated_at?: string
          vertical?: string | null
          visibility?: string
        }
        Update: {
          call_type?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
          vertical?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          submission_id: string
          title: string
          updated_at: string
          user_id: string
          volund_run_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          submission_id: string
          title?: string
          updated_at?: string
          user_id: string
          volund_run_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          submission_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          volund_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
        ]
      }
      evaluations: {
        Row: {
          author_id: string | null
          created_at: string
          descriptions: Json | null
          error_message: string | null
          final_score: number
          has_veto: boolean
          id: string
          processed_at: string | null
          processing_status: string
          report: string | null
          scores: Json
          source: string
          submission_id: string
          summary: string | null
          updated_at: string
          verdict: string
          volund_run_id: string | null
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          descriptions?: Json | null
          error_message?: string | null
          final_score?: number
          has_veto?: boolean
          id?: string
          processed_at?: string | null
          processing_status?: string
          report?: string | null
          scores?: Json
          source: string
          submission_id: string
          summary?: string | null
          updated_at?: string
          verdict?: string
          volund_run_id?: string | null
        }
        Update: {
          author_id?: string | null
          created_at?: string
          descriptions?: Json | null
          error_message?: string | null
          final_score?: number
          has_veto?: boolean
          id?: string
          processed_at?: string | null
          processing_status?: string
          report?: string | null
          scores?: Json
          source?: string
          submission_id?: string
          summary?: string | null
          updated_at?: string
          verdict?: string
          volund_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "evaluations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          meeting_date: string
          minutes_structured: Json | null
          pre_agenda: string | null
          processed_at: string | null
          processing_status: string | null
          smart_minutes: string | null
          source: string | null
          submission_id: string
          title: string
          transcript: string | null
          transcript_path: string | null
          transcript_url: string | null
          updated_at: string
          volund_run_id: string | null
          week_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          meeting_date: string
          minutes_structured?: Json | null
          pre_agenda?: string | null
          processed_at?: string | null
          processing_status?: string | null
          smart_minutes?: string | null
          source?: string | null
          submission_id: string
          title: string
          transcript?: string | null
          transcript_path?: string | null
          transcript_url?: string | null
          updated_at?: string
          volund_run_id?: string | null
          week_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          meeting_date?: string
          minutes_structured?: Json | null
          pre_agenda?: string | null
          processed_at?: string | null
          processing_status?: string | null
          smart_minutes?: string | null
          source?: string | null
          submission_id?: string
          title?: string
          transcript?: string | null
          transcript_path?: string | null
          transcript_url?: string | null
          updated_at?: string
          volund_run_id?: string | null
          week_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "meetings_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "ongoing_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      ongoing_share_links: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          submission_id: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          submission_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          submission_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ongoing_share_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ongoing_share_links_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: true
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      ongoing_weeks: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number | null
          id: string
          submission_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          id?: string
          submission_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number | null
          id?: string
          submission_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ongoing_weeks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "ongoing_weeks_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
        ]
      }
      readouts: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          submission_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          submission_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          submission_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "readouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "readouts_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_history: {
        Row: {
          from_status: string | null
          id: string
          moved_at: string
          moved_by: string
          submission_id: string
          to_status: string
        }
        Insert: {
          from_status?: string | null
          id?: string
          moved_at?: string
          moved_by: string
          submission_id: string
          to_status: string
        }
        Update: {
          from_status?: string | null
          id?: string
          moved_at?: string
          moved_by?: string
          submission_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_history_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          briefing: string | null
          created_at: string
          data: Json
          due_date: string | null
          id: string
          project_name: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          briefing?: string | null
          created_at?: string
          data?: Json
          due_date?: string | null
          id?: string
          project_name?: string
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          briefing?: string | null
          created_at?: string
          data?: Json
          due_date?: string | null
          id?: string
          project_name?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vesting_indicators: {
        Row: {
          created_at: string
          created_by: string | null
          current_value: number | null
          direction: string
          display_order: number | null
          evidence_url: string | null
          goal_description: string
          id: string
          name: string
          notes: string | null
          owner_name: string | null
          progress_pct: number | null
          status: string
          submission_id: string
          target_value: number | null
          unit: string | null
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          direction?: string
          display_order?: number | null
          evidence_url?: string | null
          goal_description: string
          id?: string
          name: string
          notes?: string | null
          owner_name?: string | null
          progress_pct?: number | null
          status?: string
          submission_id: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          direction?: string
          display_order?: number | null
          evidence_url?: string | null
          goal_description?: string
          id?: string
          name?: string
          notes?: string | null
          owner_name?: string | null
          progress_pct?: number | null
          status?: string
          submission_id?: string
          target_value?: number | null
          unit?: string | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "vesting_indicators_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vesting_indicators_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      vesting_measurements: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          id: string
          indicator_id: string
          status: string
          submission_id: string
          updated_at: string
          value: number | null
          value_before: number | null
          week_number: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          indicator_id: string
          status?: string
          submission_id: string
          updated_at?: string
          value?: number | null
          value_before?: number | null
          week_number: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          indicator_id?: string
          status?: string
          submission_id?: string
          updated_at?: string
          value?: number | null
          value_before?: number | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "vesting_measurements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vesting_measurements_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "vesting_indicators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vesting_measurements_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      vesting_week_notes: {
        Row: {
          created_at: string
          created_by: string | null
          difficulties: string | null
          highlights: string | null
          id: string
          submission_id: string
          updated_at: string
          week_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          difficulties?: string | null
          highlights?: string | null
          id?: string
          submission_id: string
          updated_at?: string
          week_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          difficulties?: string | null
          highlights?: string | null
          id?: string
          submission_id?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "vesting_week_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vesting_week_notes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      week_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          submission_id: string
          uploaded_by: string | null
          week_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          id?: string
          mime_type?: string | null
          submission_id: string
          uploaded_by?: string | null
          week_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          submission_id?: string
          uploaded_by?: string | null
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "week_documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "week_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "role_audit_divergences"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "week_documents_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "ongoing_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_tasks: {
        Row: {
          area: string | null
          comentario: string | null
          created_at: string
          deleted_at: string | null
          depends_on: string[]
          description: string | null
          external_id: string
          id: string
          merged_from: string | null
          perfil: string
          priority: string
          quick_win: boolean
          route: string | null
          screen: string | null
          status: string
          tem_decisao_aberta: boolean
          tipo: string
          title: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          comentario?: string | null
          created_at?: string
          deleted_at?: string | null
          depends_on?: string[]
          description?: string | null
          external_id: string
          id?: string
          merged_from?: string | null
          perfil: string
          priority?: string
          quick_win?: boolean
          route?: string | null
          screen?: string | null
          status?: string
          tem_decisao_aberta?: boolean
          tipo: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          comentario?: string | null
          created_at?: string
          deleted_at?: string | null
          depends_on?: string[]
          description?: string | null
          external_id?: string
          id?: string
          merged_from?: string | null
          perfil?: string
          priority?: string
          quick_win?: boolean
          route?: string | null
          screen?: string | null
          status?: string
          tem_decisao_aberta?: boolean
          tipo?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      role_audit_divergences: {
        Row: {
          created_at: string | null
          email: string | null
          role_atual: Database["public"]["Enums"]["app_role"] | null
          role_esperado_pela_regra:
            | Database["public"]["Enums"]["app_role"]
            | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_public_ongoing: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "founder" | "colaborador" | "admin" | "viewer"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["founder", "colaborador", "admin", "viewer"],
    },
  },
} as const
