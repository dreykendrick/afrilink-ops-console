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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          admin_user_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          reason: string | null
        }
        Insert: {
          action_type: string
          admin_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          reason?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      cross_city_fees: {
        Row: {
          created_at: string
          fee: number
          from_city: string
          id: string
          is_active: boolean
          to_city: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee?: number
          from_city: string
          id?: string
          is_active?: boolean
          to_city: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee?: number
          from_city?: string
          id?: string
          is_active?: boolean
          to_city?: string
          updated_at?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          buyer_id: string | null
          buyer_note: string | null
          created_at: string
          id: string
          order_id: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          buyer_note?: string | null
          created_at?: string
          id?: string
          order_id: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          buyer_note?: string | null
          created_at?: string
          id?: string
          order_id?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notes: {
        Row: {
          admin_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          note: string
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          note: string
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          created_at: string
          id: string
          masked_recipient: string
          provider: string | null
          provider_response: Json | null
          recipient: string
          related_order_id: string | null
          retry_count: number
          sent_at: string | null
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          masked_recipient: string
          provider?: string | null
          provider_response?: Json | null
          recipient: string
          related_order_id?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          masked_recipient?: string
          provider?: string | null
          provider_response?: Json | null
          recipient?: string
          related_order_id?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: string
          type?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          affiliate_code: string | null
          affiliate_user_id: string | null
          buyer_address: string | null
          buyer_city: string
          buyer_id: string | null
          buyer_landmark: string | null
          buyer_name: string
          buyer_phone: string
          buyer_receipt_sent_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_fee: number
          id: string
          order_number: string
          payment_reference: string | null
          payment_status: string
          product_id: string | null
          product_name: string
          quantity: number
          status: string
          subtotal: number
          total_amount: number
          unit_price: number
          updated_at: string
          vendor_id: string | null
          vendor_notified_at: string | null
        }
        Insert: {
          affiliate_code?: string | null
          affiliate_user_id?: string | null
          buyer_address?: string | null
          buyer_city: string
          buyer_id?: string | null
          buyer_landmark?: string | null
          buyer_name: string
          buyer_phone: string
          buyer_receipt_sent_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          id?: string
          order_number: string
          payment_reference?: string | null
          payment_status?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          status?: string
          subtotal: number
          total_amount: number
          unit_price: number
          updated_at?: string
          vendor_id?: string | null
          vendor_notified_at?: string | null
        }
        Update: {
          affiliate_code?: string | null
          affiliate_user_id?: string | null
          buyer_address?: string | null
          buyer_city?: string
          buyer_id?: string | null
          buyer_landmark?: string | null
          buyer_name?: string
          buyer_phone?: string
          buyer_receipt_sent_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          id?: string
          order_number?: string
          payment_reference?: string | null
          payment_status?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          status?: string
          subtotal?: number
          total_amount?: number
          unit_price?: number
          updated_at?: string
          vendor_id?: string | null
          vendor_notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_affiliate_user_id_fkey"
            columns: ["affiliate_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          payout_reference: string
          processed_at: string | null
          processed_by: string | null
          recipient_id: string
          recipient_name: string
          recipient_type: string
          reference_note: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          payout_reference: string
          processed_at?: string | null
          processed_by?: string | null
          recipient_id: string
          recipient_name: string
          recipient_type: string
          reference_note?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          payout_reference?: string
          processed_at?: string | null
          processed_by?: string | null
          recipient_id?: string
          recipient_name?: string
          recipient_type?: string
          reference_note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          commission_percent: number
          created_at: string
          description: string | null
          id: string
          images: string[] | null
          name: string
          price: number
          rejection_reason: string | null
          status: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          commission_percent?: number
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          name: string
          price: number
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          commission_percent?: number
          created_at?: string
          description?: string | null
          id?: string
          images?: string[] | null
          name?: string
          price?: number
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      same_city_zones: {
        Row: {
          city: string
          created_at: string
          fee: number
          id: string
          is_active: boolean
          updated_at: string
          zone_name: string
        }
        Insert: {
          city: string
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          updated_at?: string
          zone_name: string
        }
        Update: {
          city?: string
          created_at?: string
          fee?: number
          id?: string
          is_active?: boolean
          updated_at?: string
          zone_name?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_status: string
          city: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_active_at: string | null
          phone: string | null
          role: string
          updated_at: string
          user_id: string | null
          verification_status: string
        }
        Insert: {
          account_status?: string
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
          verification_status?: string
        }
        Update: {
          account_status?: string
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string | null
          verification_status?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          account_status: string
          business_name: string
          city: string | null
          created_at: string
          id: string
          phone: string | null
          total_orders: number
          total_revenue: number
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          account_status?: string
          business_name: string
          city?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          total_orders?: number
          total_revenue?: number
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          account_status?: string
          business_name?: string
          city?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          total_orders?: number
          total_revenue?: number
          updated_at?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_admin_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "SUPER_ADMIN" | "OPS_ADMIN"
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
      app_role: ["SUPER_ADMIN", "OPS_ADMIN"],
    },
  },
} as const
