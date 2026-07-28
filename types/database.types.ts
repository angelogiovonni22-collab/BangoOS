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
      companies: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          business_type: string | null
          city: string | null
          contractor_license: string | null
          created_at: string
          default_tax_rate: number | null
          email: string | null
          id: string
          insurance_provider: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          owner_name: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
          website: string | null
          years_in_business: number | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          business_type?: string | null
          city?: string | null
          contractor_license?: string | null
          created_at?: string
          default_tax_rate?: number | null
          email?: string | null
          id?: string
          insurance_provider?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          years_in_business?: number | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          business_type?: string | null
          city?: string | null
          contractor_license?: string | null
          created_at?: string
          default_tax_rate?: number | null
          email?: string | null
          id?: string
          insurance_provider?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          years_in_business?: number | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company_id: string
          company_name: string | null
          created_at: string
          created_by: string | null
          customer_type: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          estimate_number: string | null
          expiration_date: string | null
          id: string
          issue_date: string | null
          project_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          estimate_number?: string | null
          expiration_date?: string | null
          id?: string
          issue_date?: string | null
          project_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          estimate_number?: string | null
          expiration_date?: string | null
          id?: string
          issue_date?: string | null
          project_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          company_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          paid_date: string | null
          project_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          company_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          paid_date?: string | null
          project_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          company_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          paid_date?: string | null
          project_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_phases: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          project_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          project_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_phases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_photos: {
        Row: {
          captured_at: string | null
          category: string
          company_id: string
          created_at: string
          file_size: number | null
          id: string
          latitude: number | null
          longitude: number | null
          mime_type: string | null
          note: string | null
          original_filename: string | null
          project_id: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          captured_at?: string | null
          category?: string
          company_id: string
          created_at?: string
          file_size?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mime_type?: string | null
          note?: string | null
          original_filename?: string | null
          project_id: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          captured_at?: string | null
          category?: string
          company_id?: string
          created_at?: string
          file_size?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mime_type?: string | null
          note?: string | null
          original_filename?: string | null
          project_id?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company_id: string
          contract_amount: number | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          estimated_cost: number | null
          estimated_end_date: string | null
          estimated_start_date: string | null
          id: string
          name: string
          postal_code: string | null
          project_number: string | null
          project_type: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id: string
          contract_amount?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          estimated_cost?: number | null
          estimated_end_date?: string | null
          estimated_start_date?: string | null
          id?: string
          name: string
          postal_code?: string | null
          project_number?: string | null
          project_type?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id?: string
          contract_amount?: number | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          estimated_cost?: number | null
          estimated_end_date?: string | null
          estimated_start_date?: string | null
          id?: string
          name?: string
          postal_code?: string | null
          project_number?: string | null
          project_type?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          company_id: string
          created_at: string
          dependency_type: string
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          dependency_type?: string
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          dependency_type?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_finish: string | null
          actual_hours: number | null
          actual_start: string | null
          assigned_profile_id: string | null
          company_id: string
          completion_percentage: number
          created_at: string
          created_by: string | null
          description: string | null
          estimated_completion_date: string | null
          estimated_hours: number | null
          id: string
          notes: string | null
          phase_id: string | null
          planned_finish: string | null
          planned_start: string | null
          priority: string
          project_id: string
          sort_order: number
          status: string
          task_number: number
          title: string
          updated_at: string
        }
        Insert: {
          actual_finish?: string | null
          actual_hours?: number | null
          actual_start?: string | null
          assigned_profile_id?: string | null
          company_id: string
          completion_percentage?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_completion_date?: string | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          phase_id?: string | null
          planned_finish?: string | null
          planned_start?: string | null
          priority?: string
          project_id: string
          sort_order?: number
          status?: string
          task_number: number
          title: string
          updated_at?: string
        }
        Update: {
          actual_finish?: string | null
          actual_hours?: number | null
          actual_start?: string | null
          assigned_profile_id?: string | null
          company_id?: string
          completion_percentage?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_completion_date?: string | null
          estimated_hours?: number | null
          id?: string
          notes?: string | null
          phase_id?: string | null
          planned_finish?: string | null
          planned_start?: string | null
          priority?: string
          project_id?: string
          sort_order?: number
          status?: string
          task_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_profile_id_fkey"
            columns: ["assigned_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
