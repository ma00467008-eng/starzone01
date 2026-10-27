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
      admin_logs: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          details: Json | null
          id: number
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: number
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: number
        }
        Relationships: []
      }
      captcha_challenges: {
        Row: {
          attempts: number
          consumed: boolean
          created_at: string
          id: string
          image: number
          passed_at: string | null
          target_x: number
          target_y: number
        }
        Insert: {
          attempts?: number
          consumed?: boolean
          created_at?: string
          id?: string
          image: number
          passed_at?: string | null
          target_x: number
          target_y: number
        }
        Update: {
          attempts?: number
          consumed?: boolean
          created_at?: string
          id?: string
          image?: number
          passed_at?: string | null
          target_x?: number
          target_y?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          image_path: string | null
          read_by_admin: boolean
          read_by_user: boolean
          sender: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          read_by_admin?: boolean
          read_by_user?: boolean
          sender: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          read_by_admin?: boolean
          read_by_user?: boolean
          sender?: string
          user_id?: string
        }
        Relationships: []
      }
      coin_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      content: {
        Row: {
          en: string
          key: string
          updated_at: string | null
          ur: string
        }
        Insert: {
          en: string
          key: string
          updated_at?: string | null
          ur?: string
        }
        Update: {
          en?: string
          key?: string
          updated_at?: string | null
          ur?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer_en: string
          answer_ur: string | null
          id: string
          question_en: string
          question_ur: string | null
          sort: number | null
        }
        Insert: {
          answer_en: string
          answer_ur?: string | null
          id?: string
          question_en: string
          question_ur?: string | null
          sort?: number | null
        }
        Update: {
          answer_en?: string
          answer_ur?: string | null
          id?: string
          question_en?: string
          question_ur?: string | null
          sort?: number | null
        }
        Relationships: []
      }
      game_rounds: {
        Row: {
          created_at: string
          game: string
          id: number
          payout: number
          result: Json | null
          round_code: string
          selection: Json | null
          stake: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game: string
          id?: number
          payout?: number
          result?: Json | null
          round_code: string
          selection?: Json | null
          stake: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game?: string
          id?: number
          payout?: number
          result?: Json | null
          round_code?: string
          selection?: Json | null
          stake?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      game_seed: {
        Row: {
          id: number
          seed: string
        }
        Insert: {
          id: number
          seed: string
        }
        Update: {
          id?: number
          seed?: string
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          active: boolean
          created_at: string
          game: string
          id: string
          secret: Json
          stake: number
          state: Json
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          game: string
          id?: string
          secret: Json
          stake: number
          state?: Json
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          game?: string
          id?: string
          secret?: Json
          stake?: number
          state?: Json
          user_id?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          announcement: string | null
          badge: string | null
          enabled: boolean
          featured: boolean
          image_url: string
          maintenance: boolean
          max_stake: number
          min_stake: number
          name: string
          rules: string | null
          slug: string
          sort: number
        }
        Insert: {
          announcement?: string | null
          badge?: string | null
          enabled?: boolean
          featured?: boolean
          image_url: string
          maintenance?: boolean
          max_stake?: number
          min_stake?: number
          name: string
          rules?: string | null
          slug: string
          sort?: number
        }
        Update: {
          announcement?: string | null
          badge?: string | null
          enabled?: boolean
          featured?: boolean
          image_url?: string
          maintenance?: boolean
          max_stake?: number
          min_stake?: number
          name?: string
          rules?: string | null
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      gift_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_public: boolean
          reward: number
          usage_limit: number
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_public?: boolean
          reward: number
          usage_limit?: number
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_public?: boolean
          reward?: number
          usage_limit?: number
          used_count?: number
        }
        Relationships: []
      }
      gift_redemptions: {
        Row: {
          code_id: string
          created_at: string | null
          id: number
          user_id: string
        }
        Insert: {
          code_id: string
          created_at?: string | null
          id?: number
          user_id: string
        }
        Update: {
          code_id?: string
          created_at?: string | null
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "gift_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          id: number
          phone: string
          success: boolean
        }
        Insert: {
          created_at?: string
          id?: number
          phone: string
          success: boolean
        }
        Update: {
          created_at?: string
          id?: number
          phone?: string
          success?: boolean
        }
        Relationships: []
      }
      media_items: {
        Row: {
          created_at: string | null
          enabled: boolean
          ends_at: string | null
          id: string
          image_url: string
          kind: string
          link: string | null
          sort: number
          starts_at: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          image_url: string
          kind: string
          link?: string | null
          sort?: number
          starts_at?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          image_url?: string
          kind?: string
          link?: string | null
          sort?: number
          starts_at?: string | null
          title?: string | null
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          notification_id: string
          user_id: string
        }
        Insert: {
          notification_id: string
          user_id: string
        }
        Update: {
          notification_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          title: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: number
          balance: number
          created_at: string
          id: string
          last_seen: string
          must_change_password: boolean
          phone: string
          status: string
          uid: string
          username: string
        }
        Insert: {
          avatar?: number
          balance?: number
          created_at?: string
          id: string
          last_seen?: string
          must_change_password?: boolean
          phone: string
          status?: string
          uid: string
          username: string
        }
        Update: {
          avatar?: number
          balance?: number
          created_at?: string
          id?: string
          last_seen?: string
          must_change_password?: boolean
          phone?: string
          status?: string
          uid?: string
          username?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      ticket_replies: {
        Row: {
          body: string
          created_at: string | null
          id: number
          sender: string
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: number
          sender: string
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: number
          sender?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string | null
          description: string
          id: string
          image_path: string | null
          status: string
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          image_path?: string | null
          status?: string
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          image_path?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: number
          kind: string
          note: string | null
          ref: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: number
          kind: string
          note?: string | null
          ref?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: number
          kind?: string
          note?: string | null
          ref?: string | null
          user_id?: string
        }
        Relationships: []
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
      user_secrets: {
        Row: {
          recovery_hash: string
          user_id: string
        }
        Insert: {
          recovery_hash: string
          user_id: string
        }
        Update: {
          recovery_hash?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_balance: {
        Args: {
          _amount: number
          _kind: string
          _note: string
          _ref: string
          _user: string
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      notify: {
        Args: { _body: string; _kind: string; _title: string; _user: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
