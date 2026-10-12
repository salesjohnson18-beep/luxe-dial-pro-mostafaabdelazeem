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
          leads: number
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
          leads?: number
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
          leads?: number
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
      client_installments: {
        Row: {
          agreement_total: number
          amount: number
          client_id: string
          created_at: string
          currency: string
          due_date: string
          id: string
          is_advance: boolean
          number: number
          paid: boolean
          paid_at: string | null
          payment_method: string | null
          postponed_count: number
          quote_id: string | null
          total_count: number
        }
        Insert: {
          agreement_total: number
          amount: number
          client_id: string
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          is_advance?: boolean
          number: number
          paid?: boolean
          paid_at?: string | null
          payment_method?: string | null
          postponed_count?: number
          quote_id?: string | null
          total_count: number
        }
        Update: {
          agreement_total?: number
          amount?: number
          client_id?: string
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          is_advance?: boolean
          number?: number
          paid?: boolean
          paid_at?: string | null
          payment_method?: string | null
          postponed_count?: number
          quote_id?: string | null
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_installments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_installments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
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
          secret: string | null
          url: string | null
          username: string | null
          value: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          kind?: string
          label: string
          notes?: string | null
          secret?: string | null
          url?: string | null
          username?: string | null
          value?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          label?: string
          notes?: string | null
          secret?: string | null
          url?: string | null
          username?: string | null
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
          ad_budget: number | null
          advance_amount: number
          assigned_to: string | null
          client_name: string
          contract_total: number | null
          contract_type: string
          created_at: string
          created_by: string
          currency: string
          enable_inventory: boolean
          enable_monthly_sheet: boolean
          enable_pricing: boolean
          id: string
          industry: string | null
          installments_count: number
          is_active: boolean
          last_transfer_at: string | null
          notes: string | null
          payment_method: string
          phone: string | null
          project_name: string
          share_token: string
          sheet_synced_at: string | null
          sheet_url: string | null
          transfer_cycle: string
          work_start_date: string | null
        }
        Insert: {
          ad_budget?: number | null
          advance_amount?: number
          assigned_to?: string | null
          client_name: string
          contract_total?: number | null
          contract_type?: string
          created_at?: string
          created_by?: string
          currency?: string
          enable_inventory?: boolean
          enable_monthly_sheet?: boolean
          enable_pricing?: boolean
          id?: string
          industry?: string | null
          installments_count?: number
          is_active?: boolean
          last_transfer_at?: string | null
          notes?: string | null
          payment_method?: string
          phone?: string | null
          project_name: string
          share_token?: string
          sheet_synced_at?: string | null
          sheet_url?: string | null
          transfer_cycle?: string
          work_start_date?: string | null
        }
        Update: {
          ad_budget?: number | null
          advance_amount?: number
          assigned_to?: string | null
          client_name?: string
          contract_total?: number | null
          contract_type?: string
          created_at?: string
          created_by?: string
          currency?: string
          enable_inventory?: boolean
          enable_monthly_sheet?: boolean
          enable_pricing?: boolean
          id?: string
          industry?: string | null
          installments_count?: number
          is_active?: boolean
          last_transfer_at?: string | null
          notes?: string | null
          payment_method?: string
          phone?: string | null
          project_name?: string
          share_token?: string
          sheet_synced_at?: string | null
          sheet_url?: string | null
          transfer_cycle?: string
          work_start_date?: string | null
        }
        Relationships: []
      }
      creative_ideas: {
        Row: {
          client_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          platform: string | null
          title: string | null
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          platform?: string | null
          title?: string | null
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          platform?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          account: string
          amount: number
          category: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          entry_date: string
          id: string
          installment_id: string | null
          kind: string
          note: string | null
          payment_method: string | null
        }
        Insert: {
          account?: string
          amount: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_date?: string
          id?: string
          installment_id?: string | null
          kind?: string
          note?: string | null
          payment_method?: string | null
        }
        Update: {
          account?: string
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_date?: string
          id?: string
          installment_id?: string | null
          kind?: string
          note?: string | null
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "client_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account: string
          amount: number
          client_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string
          due_date: string
          id: string
          installment_id: string | null
          issue_date: string
          paid_at: string | null
          payment_method: string | null
          seq: number
          share_token: string
          status: string
        }
        Insert: {
          account?: string
          amount: number
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description: string
          due_date?: string
          id?: string
          installment_id?: string | null
          issue_date?: string
          paid_at?: string | null
          payment_method?: string | null
          seq?: number
          share_token?: string
          status?: string
        }
        Update: {
          account?: string
          amount?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          due_date?: string
          id?: string
          installment_id?: string | null
          issue_date?: string
          paid_at?: string | null
          payment_method?: string | null
          seq?: number
          share_token?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: true
            referencedRelation: "client_installments"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_followups: {
        Row: {
          attempt_no: number
          caller_name: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          note: string | null
          outcome: string
        }
        Insert: {
          attempt_no: number
          caller_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          note?: string | null
          outcome: string
        }
        Update: {
          attempt_no?: number
          caller_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          note?: string | null
          outcome?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          client_id: string | null
          client_name: string
          created_at: string
          currency: string
          id: string
          next_followup_at: string | null
          notes: string | null
          phone: string | null
          project_name: string | null
          rep_id: string | null
          rep_name: string | null
          seq: number
          service: string | null
          status: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          created_at?: string
          currency?: string
          id?: string
          next_followup_at?: string | null
          notes?: string | null
          phone?: string | null
          project_name?: string | null
          rep_id?: string | null
          rep_name?: string | null
          seq?: number
          service?: string | null
          status?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          created_at?: string
          currency?: string
          id?: string
          next_followup_at?: string | null
          notes?: string | null
          phone?: string | null
          project_name?: string | null
          rep_id?: string | null
          rep_name?: string | null
          seq?: number
          service?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      quote_items: {
        Row: {
          description: string | null
          id: string
          name: string
          position: number
          price: number
          qty: number
          quote_id: string
          service_id: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          position?: number
          price?: number
          qty?: number
          quote_id: string
          service_id?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          position?: number
          price?: number
          qty?: number
          quote_id?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_id: string | null
          client_response: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_name: string
          discount: number
          id: string
          installments: number
          lead_id: string | null
          notes: string | null
          payment_type: string
          phone: string | null
          project_name: string | null
          seq: number
          share_token: string
          status: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          client_id?: string | null
          client_response?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_name: string
          discount?: number
          id?: string
          installments?: number
          lead_id?: string | null
          notes?: string | null
          payment_type?: string
          phone?: string | null
          project_name?: string | null
          seq?: number
          share_token?: string
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          client_id?: string | null
          client_response?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_name?: string
          discount?: number
          id?: string
          installments?: number
          lead_id?: string | null
          notes?: string | null
          payment_type?: string
          phone?: string | null
          project_name?: string | null
          seq?: number
          share_token?: string
          status?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          assignee_id: string | null
          client_id: string | null
          created_at: string
          done: boolean
          due_at: string
          id: string
          kind: string
          last_done_at: string | null
          link: string | null
          note: string | null
          owner_id: string
          recurrence: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          done?: boolean
          due_at?: string
          id?: string
          kind?: string
          last_done_at?: string | null
          link?: string | null
          note?: string | null
          owner_id?: string
          recurrence?: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          done?: boolean
          due_at?: string
          id?: string
          kind?: string
          last_done_at?: string | null
          link?: string | null
          note?: string | null
          owner_id?: string
          recurrence?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          payment_terms: string | null
          price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          payment_terms?: string | null
          price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          payment_terms?: string | null
          price?: number
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
      can_crm: { Args: never; Returns: boolean }
      can_edit_client: { Args: { _client: string }; Returns: boolean }
      can_view_client: { Args: { _client: string }; Returns: boolean }
      can_view_crm: { Args: never; Returns: boolean }
      confirm_installment: {
        Args: { _id: string; _method: string }
        Returns: undefined
      }
      convert_lead_to_client: { Args: { _lead: string }; Returns: string }
      convert_quote_to_client: { Args: { _quote: string }; Returns: string }
      generate_client_installments: {
        Args: { _client: string }
        Returns: number
      }
      get_shared_invoice: { Args: { _token: string }; Returns: Json }
      get_shared_quote: { Args: { _token: string }; Returns: Json }
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
      list_staff: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
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
      postpone_installment: {
        Args: { _date: string; _id: string }
        Returns: undefined
      }
      quote_total: { Args: { _quote: string }; Returns: number }
      respond_quote: {
        Args: { _action: string; _note: string; _token: string }
        Returns: string
      }
      set_installment_paid: {
        Args: { _id: string; _paid: boolean }
        Returns: undefined
      }
      update_shared_quote_customer: {
        Args: {
          _name: string
          _phone: string
          _project: string
          _token: string
        }
        Returns: string
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
