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
      campaign_exports: {
        Row: {
          campaign_id: string
          created_at: string | null
          file_data: string
          id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          file_data: string
          id?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          file_data?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_exports_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_results: {
        Row: {
          campaign_id: string
          contact_email: string | null
          disqualified: boolean | null
          disqualify_reason: string | null
          domain: string
          dr: number | null
          geo: string | null
          id: string
          included: boolean | null
          link_type: string | null
          price: number | null
          rank_position: number | null
          ranking: string | null
          reasoning: string | null
          red_flags: string | null
          score: number | null
          score_breakdown: Json | null
          tat: number | null
          traffic: number | null
        }
        Insert: {
          campaign_id: string
          contact_email?: string | null
          disqualified?: boolean | null
          disqualify_reason?: string | null
          domain: string
          dr?: number | null
          geo?: string | null
          id?: string
          included?: boolean | null
          link_type?: string | null
          price?: number | null
          rank_position?: number | null
          ranking?: string | null
          reasoning?: string | null
          red_flags?: string | null
          score?: number | null
          score_breakdown?: Json | null
          tat?: number | null
          traffic?: number | null
        }
        Update: {
          campaign_id?: string
          contact_email?: string | null
          disqualified?: boolean | null
          disqualify_reason?: string | null
          domain?: string
          dr?: number | null
          geo?: string | null
          id?: string
          included?: boolean | null
          link_type?: string | null
          price?: number | null
          rank_position?: number | null
          ranking?: string | null
          reasoning?: string | null
          red_flags?: string | null
          score?: number | null
          score_breakdown?: Json | null
          tat?: number | null
          traffic?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_results_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget_per_link: number
          client_name: string
          client_niche: string
          created_at: string | null
          geo_focus: Json
          id: string
          link_count_goal: number
          link_preference: string
          min_dr: number
          min_traffic: number
          scoring_config_id: string | null
          shortlist_size: number
          status: string
          target_pages: Json
          updated_at: string | null
          vendor_snapshot: string | null
        }
        Insert: {
          budget_per_link: number
          client_name: string
          client_niche: string
          created_at?: string | null
          geo_focus: Json
          id?: string
          link_count_goal: number
          link_preference: string
          min_dr?: number
          min_traffic?: number
          scoring_config_id?: string | null
          shortlist_size?: number
          status?: string
          target_pages: Json
          updated_at?: string | null
          vendor_snapshot?: string | null
        }
        Update: {
          budget_per_link?: number
          client_name?: string
          client_niche?: string
          created_at?: string | null
          geo_focus?: Json
          id?: string
          link_count_goal?: number
          link_preference?: string
          min_dr?: number
          min_traffic?: number
          scoring_config_id?: string | null
          shortlist_size?: number
          status?: string
          target_pages?: Json
          updated_at?: string | null
          vendor_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_scoring_config_id_fkey"
            columns: ["scoring_config_id"]
            isOneToOne: false
            referencedRelation: "scoring_config"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_config: {
        Row: {
          created_at: string | null
          disqualifiers: Json
          id: string
          is_active: boolean | null
          label: string | null
          niche_prompt: string | null
          overrides: Json | null
          version: number
          weights: Json
        }
        Insert: {
          created_at?: string | null
          disqualifiers: Json
          id?: string
          is_active?: boolean | null
          label?: string | null
          niche_prompt?: string | null
          overrides?: Json | null
          version?: never
          weights: Json
        }
        Update: {
          created_at?: string | null
          disqualifiers?: Json
          id?: string
          is_active?: boolean | null
          label?: string | null
          niche_prompt?: string | null
          overrides?: Json | null
          version?: never
          weights?: Json
        }
        Relationships: []
      }
      vendors: {
        Row: {
          complementary_niche: string | null
          contact_email: string | null
          domain: string
          dr: number | null
          geo: string | null
          id: string
          indirect_niche: string | null
          link_type: string | null
          main_niche: string | null
          price: number | null
          ranking: string | null
          red_flags: string | null
          tat: number | null
          traffic: number | null
          uploaded_at: string | null
        }
        Insert: {
          complementary_niche?: string | null
          contact_email?: string | null
          domain: string
          dr?: number | null
          geo?: string | null
          id?: string
          indirect_niche?: string | null
          link_type?: string | null
          main_niche?: string | null
          price?: number | null
          ranking?: string | null
          red_flags?: string | null
          tat?: number | null
          traffic?: number | null
          uploaded_at?: string | null
        }
        Update: {
          complementary_niche?: string | null
          contact_email?: string | null
          domain?: string
          dr?: number | null
          geo?: string | null
          id?: string
          indirect_niche?: string | null
          link_type?: string | null
          main_niche?: string | null
          price?: number | null
          ranking?: string | null
          red_flags?: string | null
          tat?: number | null
          traffic?: number | null
          uploaded_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
