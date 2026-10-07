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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      campaign_entries: {
        Row: {
          clicks: number
          client_id: string
          created_at: string
          entry_date: string
          id: string
          impressions: number
          platform: string
          purchases: number
          revenue: number
          spend: number
        }
        Insert: {
          clicks?: number
          client_id: string
          created_at?: string
          entry_date: string
          id?: string
          impressions?: number
          platform: string
          purchases?: number
          revenue?: number
          spend?: number
        }
        Update: {
          clicks?: number
          client_id?: string
          created_at?: string
          entry_date?: string
          id?: string
          impressions?: number
          platform?: string
          purchases?: number
          revenue?: number
          spend?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_vault: {
        Row: {
          client_id: string
          created_at: string
          id: string
          kind: string
          label: string
          notes: string | null
          value: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          kind?: string
          label: string
          notes?: string | null
          value?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          notes?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_vault_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          assigned_to: string | null
          client_name: string
          contract_type: string
          created_at: string
          created_by: string
          enable_inventory: boolean
          enable_monthly_sheet: boolean
          enable_pricing: boolean
          id: string
          industry: string | null
          is_active: boolean
          notes: string | null
          phone: string | null
          project_name: string
          share_token: string
          transfer_cycle: string
        }
        Insert: {
          assigned_to?: string | null
          client_name: string
          contract_type?: string
          created_at?: string
          created_by?: string
          enable_inventory?: boolean
          enable_monthly_sheet?: boolean
          enable_pricing?: boolean
          id?: string
          industry?: string | null
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          project_name: string
          share_token?: string
          transfer_cycle?: string
        }
        Update: {
          assigned_to?: string | null
          client_name?: string
          contract_type?: string
          created_at?: string
          created_by?: string
          enable_inventory?: boolean
          enable_monthly_sheet?: boolean
          enable_pricing?: boolean
          id?: string
          industry?: string | null
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          project_name?: string
          share_token?: string
          transfer_cycle?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      store_sales: {
        Row: {
          client_id: string
          entry_date: string
          id: string
          orders: number
          revenue: number
        }
        Insert: {
          client_id: string
          entry_date: string
          id?: string
          orders?: number
          revenue?: number
        }
        Update: {
          client_id?: string
          entry_date?: string
          id?: string
          orders?: number
          revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_user: { Args: never; Returns: string }
      can_edit_client: { Args: { _client: string }; Returns: boolean }
      can_view_client: { Args: { _client: string }; Returns: boolean }
      get_shared_report: {
        Args: { _from: string; _to: string; _token: string }
        Returns: Json
      }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          roles: Database["public"]["Enums"]["app_role"][]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "media_buyer" | "sales" | "accountant"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "media_buyer", "sales", "accountant"],
    },
  },
} as const
