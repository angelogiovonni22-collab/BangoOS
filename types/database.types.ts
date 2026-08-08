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
      bango_memories: {
        Row: {
          archived_at: string | null
          category: string
          company_id: string
          confidence: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          details: Json
          expires_at: string | null
          id: string
          importance: string
          phase_id: string | null
          project_id: string | null
          recommendation_status: string | null
          scope: string
          source_references: Json
          status: string
          summary: string
          tags: string[]
          task_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          archived_at?: string | null
          category: string
          company_id: string
          confidence: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          details?: Json
          expires_at?: string | null
          id?: string
          importance: string
          phase_id?: string | null
          project_id?: string | null
          recommendation_status?: string | null
          scope: string
          source_references?: Json
          status?: string
          summary: string
          tags?: string[]
          task_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          archived_at?: string | null
          category?: string
          company_id?: string
          confidence?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          details?: Json
          expires_at?: string | null
          id?: string
          importance?: string
          phase_id?: string | null
          project_id?: string | null
          recommendation_status?: string | null
          scope?: string
          source_references?: Json
          status?: string
          summary?: string
          tags?: string[]
          task_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bango_memories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bango_memories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bango_memories_customer_company_fkey"
            columns: ["customer_id", "company_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "bango_memories_phase_company_fkey"
            columns: ["phase_id", "company_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "bango_memories_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "bango_memories_task_company_fkey"
            columns: ["task_id", "company_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "bango_memories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bango_memories_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      change_order_activity: {
        Row: {
          activity_type: string
          change_order_id: string
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          metadata: Json
        }
        Insert: {
          activity_type: string
          change_order_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          metadata?: Json
        }
        Update: {
          activity_type?: string
          change_order_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "change_order_activity_change_order_company_fkey"
            columns: ["change_order_id", "company_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "change_order_activity_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_activity_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      change_order_invoice_links: {
        Row: {
          amount_applied: number
          change_order_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          link_type: string
          metadata: Json
        }
        Insert: {
          amount_applied?: number
          change_order_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          link_type?: string
          metadata?: Json
        }
        Update: {
          amount_applied?: number
          change_order_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          link_type?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "change_order_invoice_links_change_order_company_fkey"
            columns: ["change_order_id", "company_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "change_order_invoice_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_invoice_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_invoice_links_invoice_company_fkey"
            columns: ["invoice_id", "company_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      change_order_line_items: {
        Row: {
          change_order_id: string
          company_id: string
          cost_amount: number
          created_at: string
          description: string
          id: string
          notes: string | null
          price_amount: number
          quantity: number
          sort_order: number
          unit: string
          unit_cost: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          change_order_id: string
          company_id: string
          cost_amount?: number
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          price_amount?: number
          quantity?: number
          sort_order?: number
          unit?: string
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          change_order_id?: string
          company_id?: string
          cost_amount?: number
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          price_amount?: number
          quantity?: number
          sort_order?: number
          unit?: string
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_order_line_items_change_order_company_fkey"
            columns: ["change_order_id", "company_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "change_order_line_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      change_order_notes: {
        Row: {
          change_order_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          change_order_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          change_order_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_order_notes_change_order_company_fkey"
            columns: ["change_order_id", "company_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "change_order_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_order_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      change_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          change_order_number: string
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_notes: string | null
          description: string | null
          effective_date: string | null
          estimate_id: string | null
          id: string
          internal_notes: string | null
          invoice_id: string | null
          prepared_by: string | null
          project_id: string
          reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          requested_by: string | null
          requested_date: string | null
          schedule_impact_days: number
          status: string
          submitted_at: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          title: string
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          change_order_number: string
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_notes?: string | null
          description?: string | null
          effective_date?: string | null
          estimate_id?: string | null
          id?: string
          internal_notes?: string | null
          invoice_id?: string | null
          prepared_by?: string | null
          project_id: string
          reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          requested_by?: string | null
          requested_date?: string | null
          schedule_impact_days?: number
          status?: string
          submitted_at?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          change_order_number?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_notes?: string | null
          description?: string | null
          effective_date?: string | null
          estimate_id?: string | null
          id?: string
          internal_notes?: string | null
          invoice_id?: string | null
          prepared_by?: string | null
          project_id?: string
          reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          requested_by?: string | null
          requested_date?: string | null
          schedule_impact_days?: number
          status?: string
          submitted_at?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_customer_company_fkey"
            columns: ["customer_id", "company_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "change_orders_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "change_orders_invoice_company_fkey"
            columns: ["invoice_id", "company_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "change_orders_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "change_orders_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          business_type: string | null
          city: string | null
          contractor_license: string | null
          country: string | null
          created_at: string
          created_by: string | null
          default_tax_rate: number | null
          display_name: string | null
          email: string | null
          id: string
          insurance_provider: string | null
          legal_name: string | null
          logo_url: string | null
          name: string
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          owner_id: string | null
          owner_name: string | null
          phone: string | null
          postal_code: string | null
          slug: string | null
          state: string | null
          status: string
          timezone: string | null
          updated_at: string
          updated_by: string | null
          website: string | null
          years_in_business: number | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          business_type?: string | null
          city?: string | null
          contractor_license?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_tax_rate?: number | null
          display_name?: string | null
          email?: string | null
          id?: string
          insurance_provider?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          postal_code?: string | null
          slug?: string | null
          state?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          years_in_business?: number | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          business_type?: string | null
          city?: string | null
          contractor_license?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          default_tax_rate?: number | null
          display_name?: string | null
          email?: string | null
          id?: string
          insurance_provider?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          owner_id?: string | null
          owner_name?: string | null
          phone?: string | null
          postal_code?: string | null
          slug?: string | null
          state?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
          updated_by?: string | null
          website?: string | null
          years_in_business?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_change_order_sequences: {
        Row: {
          company_id: string
          created_at: string
          next_number: number
          padding: number
          prefix: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          next_number?: number
          padding?: number
          prefix?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          next_number?: number
          padding?: number
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_change_order_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_estimate_sequences: {
        Row: {
          company_id: string
          created_at: string
          next_number: number
          padding: number
          prefix: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          next_number?: number
          padding?: number
          prefix?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          next_number?: number
          padding?: number
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_estimate_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_memberships: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_primary: boolean
          joined_at: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          joined_at?: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          joined_at?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_project_sequences: {
        Row: {
          company_id: string
          created_at: string
          next_number: number
          padding: number
          prefix: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          next_number?: number
          padding?: number
          prefix?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          next_number?: number
          padding?: number
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_project_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_codes: {
        Row: {
          actual_cost: number
          budget: number
          category: string | null
          code: string
          committed_cost: number
          company_id: string
          created_at: string
          created_by: string | null
          default_equipment_category_id: string | null
          default_labor_rate_id: string | null
          default_material_category_id: string | null
          description: string | null
          division: string | null
          id: string
          name: string
          parent_cost_code_id: string | null
          status: string
          trade: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actual_cost?: number
          budget?: number
          category?: string | null
          code: string
          committed_cost?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          default_equipment_category_id?: string | null
          default_labor_rate_id?: string | null
          default_material_category_id?: string | null
          description?: string | null
          division?: string | null
          id?: string
          name: string
          parent_cost_code_id?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actual_cost?: number
          budget?: number
          category?: string | null
          code?: string
          committed_cost?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          default_equipment_category_id?: string | null
          default_labor_rate_id?: string | null
          default_material_category_id?: string | null
          description?: string | null
          division?: string | null
          id?: string
          name?: string
          parent_cost_code_id?: string | null
          status?: string
          trade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_codes_parent_company_fkey"
            columns: ["parent_cost_code_id", "company_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "cost_codes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_memberships: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          crew_id: string
          employee_id: string
          ends_on: string | null
          id: string
          is_primary: boolean
          role: string
          starts_on: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          crew_id: string
          employee_id: string
          ends_on?: string | null
          id?: string
          is_primary?: boolean
          role: string
          starts_on: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          crew_id?: string
          employee_id?: string
          ends_on?: string | null
          id?: string
          is_primary?: boolean
          role?: string
          starts_on?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_memberships_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "crew_memberships_crew_company_fkey"
            columns: ["crew_id", "company_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "crew_memberships_employee_company_fkey"
            columns: ["employee_id", "company_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "crew_memberships_updated_by_company_fkey"
            columns: ["updated_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      crews: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          crew_code: string
          description: string | null
          home_location: string | null
          id: string
          lead_profile_id: string | null
          name: string
          notes: string | null
          status: string
          supervisor_profile_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          crew_code: string
          description?: string | null
          home_location?: string | null
          id?: string
          lead_profile_id?: string | null
          name: string
          notes?: string | null
          status?: string
          supervisor_profile_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          crew_code?: string
          description?: string | null
          home_location?: string | null
          id?: string
          lead_profile_id?: string | null
          name?: string
          notes?: string | null
          status?: string
          supervisor_profile_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crews_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "crews_lead_profile_company_fkey"
            columns: ["lead_profile_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "crews_supervisor_profile_company_fkey"
            columns: ["supervisor_profile_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "crews_updated_by_company_fkey"
            columns: ["updated_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
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
      employees: {
        Row: {
          availability_status: string
          company_id: string
          created_at: string
          created_by: string | null
          employee_number: string
          employment_status: string
          hire_date: string
          id: string
          notes: string | null
          position_title: string
          primary_crew_id: string | null
          profile_id: string | null
          supervisor_profile_id: string | null
          termination_date: string | null
          trade: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          availability_status?: string
          company_id: string
          created_at?: string
          created_by?: string | null
          employee_number: string
          employment_status?: string
          hire_date: string
          id?: string
          notes?: string | null
          position_title: string
          primary_crew_id?: string | null
          profile_id?: string | null
          supervisor_profile_id?: string | null
          termination_date?: string | null
          trade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          availability_status?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          employee_number?: string
          employment_status?: string
          hire_date?: string
          id?: string
          notes?: string | null
          position_title?: string
          primary_crew_id?: string | null
          profile_id?: string | null
          supervisor_profile_id?: string | null
          termination_date?: string | null
          trade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "employees_primary_crew_company_fkey"
            columns: ["primary_crew_id", "company_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "employees_profile_company_fkey"
            columns: ["profile_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "employees_supervisor_profile_company_fkey"
            columns: ["supervisor_profile_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "employees_updated_by_company_fkey"
            columns: ["updated_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      equipment: {
        Row: {
          ai_notes: string | null
          asset_tag: string | null
          assigned_at: string | null
          assigned_crew_id: string | null
          assigned_employee_id: string | null
          assigned_job_id: string | null
          barcode: string | null
          category: string | null
          certification_expiration_date: string | null
          company_id: string
          condition_score: number | null
          created_at: string
          created_by: string | null
          criticality_level: string
          current_location_name: string | null
          current_location_type: string | null
          current_meter_reading: number
          current_value: number
          daily_billable_rate: number
          daily_internal_cost: number
          default_cost_code_id: string | null
          default_quantity: number
          default_unit_of_measure: string | null
          depreciation_method: string | null
          depreciation_start_date: string | null
          description: string | null
          effective_internal_hourly_cost: number
          equipment_number: string
          equipment_type: string | null
          estimated_fuel_cost_per_hour: number
          expected_return_date: string | null
          financed_amount: number
          fuel_type: string | null
          hourly_billable_rate: number
          hourly_internal_cost: number
          id: string
          inspection_expiration_date: string | null
          insurance_cost_per_hour: number
          insurance_expiration_date: string | null
          last_meter_updated_at: string | null
          last_service_date: string | null
          last_service_meter: number | null
          lease_end_date: string | null
          lease_monthly_cost: number
          lease_start_date: string | null
          license_plate: string | null
          lifetime_hours: number
          lifetime_miles: number
          maintenance_cost_per_hour: number
          maintenance_notes: string | null
          maintenance_status: string
          manufacturer: string | null
          meter_type: string | null
          meter_unit: string | null
          model: string | null
          model_year: number | null
          monthly_payment: number
          name: string
          next_service_date: string | null
          next_service_meter: number | null
          notes: string | null
          other_operating_cost_per_hour: number
          owner_name: string | null
          ownership_type: string
          purchase_date: string | null
          purchase_price: number
          qr_code: string | null
          registration_expiration_date: string | null
          reliability_score: number | null
          rental_agreement_number: string | null
          rental_daily_cost: number
          rental_end_date: string | null
          rental_monthly_cost: number
          rental_start_date: string | null
          rental_weekly_cost: number
          replacement_priority: string
          replacement_score: number | null
          required_certification_type: string | null
          requires_operator_certification: boolean
          safety_notes: string | null
          salvage_value: number
          serial_number: string | null
          service_interval_days: number | null
          service_interval_meter: number | null
          status: string
          subcategory: string | null
          taxable: boolean
          total_operating_cost_per_hour: number
          updated_at: string
          updated_by: string | null
          useful_life_years: number | null
          utilization_target_percent: number | null
          vendor_id: string | null
          vin: string | null
          warranty_expiration_date: string | null
        }
        Insert: {
          ai_notes?: string | null
          asset_tag?: string | null
          assigned_at?: string | null
          assigned_crew_id?: string | null
          assigned_employee_id?: string | null
          assigned_job_id?: string | null
          barcode?: string | null
          category?: string | null
          certification_expiration_date?: string | null
          company_id: string
          condition_score?: number | null
          created_at?: string
          created_by?: string | null
          criticality_level?: string
          current_location_name?: string | null
          current_location_type?: string | null
          current_meter_reading?: number
          current_value?: number
          daily_billable_rate?: number
          daily_internal_cost?: number
          default_cost_code_id?: string | null
          default_quantity?: number
          default_unit_of_measure?: string | null
          depreciation_method?: string | null
          depreciation_start_date?: string | null
          description?: string | null
          effective_internal_hourly_cost?: number
          equipment_number: string
          equipment_type?: string | null
          estimated_fuel_cost_per_hour?: number
          expected_return_date?: string | null
          financed_amount?: number
          fuel_type?: string | null
          hourly_billable_rate?: number
          hourly_internal_cost?: number
          id?: string
          inspection_expiration_date?: string | null
          insurance_cost_per_hour?: number
          insurance_expiration_date?: string | null
          last_meter_updated_at?: string | null
          last_service_date?: string | null
          last_service_meter?: number | null
          lease_end_date?: string | null
          lease_monthly_cost?: number
          lease_start_date?: string | null
          license_plate?: string | null
          lifetime_hours?: number
          lifetime_miles?: number
          maintenance_cost_per_hour?: number
          maintenance_notes?: string | null
          maintenance_status?: string
          manufacturer?: string | null
          meter_type?: string | null
          meter_unit?: string | null
          model?: string | null
          model_year?: number | null
          monthly_payment?: number
          name: string
          next_service_date?: string | null
          next_service_meter?: number | null
          notes?: string | null
          other_operating_cost_per_hour?: number
          owner_name?: string | null
          ownership_type?: string
          purchase_date?: string | null
          purchase_price?: number
          qr_code?: string | null
          registration_expiration_date?: string | null
          reliability_score?: number | null
          rental_agreement_number?: string | null
          rental_daily_cost?: number
          rental_end_date?: string | null
          rental_monthly_cost?: number
          rental_start_date?: string | null
          rental_weekly_cost?: number
          replacement_priority?: string
          replacement_score?: number | null
          required_certification_type?: string | null
          requires_operator_certification?: boolean
          safety_notes?: string | null
          salvage_value?: number
          serial_number?: string | null
          service_interval_days?: number | null
          service_interval_meter?: number | null
          status?: string
          subcategory?: string | null
          taxable?: boolean
          total_operating_cost_per_hour?: number
          updated_at?: string
          updated_by?: string | null
          useful_life_years?: number | null
          utilization_target_percent?: number | null
          vendor_id?: string | null
          vin?: string | null
          warranty_expiration_date?: string | null
        }
        Update: {
          ai_notes?: string | null
          asset_tag?: string | null
          assigned_at?: string | null
          assigned_crew_id?: string | null
          assigned_employee_id?: string | null
          assigned_job_id?: string | null
          barcode?: string | null
          category?: string | null
          certification_expiration_date?: string | null
          company_id?: string
          condition_score?: number | null
          created_at?: string
          created_by?: string | null
          criticality_level?: string
          current_location_name?: string | null
          current_location_type?: string | null
          current_meter_reading?: number
          current_value?: number
          daily_billable_rate?: number
          daily_internal_cost?: number
          default_cost_code_id?: string | null
          default_quantity?: number
          default_unit_of_measure?: string | null
          depreciation_method?: string | null
          depreciation_start_date?: string | null
          description?: string | null
          effective_internal_hourly_cost?: number
          equipment_number?: string
          equipment_type?: string | null
          estimated_fuel_cost_per_hour?: number
          expected_return_date?: string | null
          financed_amount?: number
          fuel_type?: string | null
          hourly_billable_rate?: number
          hourly_internal_cost?: number
          id?: string
          inspection_expiration_date?: string | null
          insurance_cost_per_hour?: number
          insurance_expiration_date?: string | null
          last_meter_updated_at?: string | null
          last_service_date?: string | null
          last_service_meter?: number | null
          lease_end_date?: string | null
          lease_monthly_cost?: number
          lease_start_date?: string | null
          license_plate?: string | null
          lifetime_hours?: number
          lifetime_miles?: number
          maintenance_cost_per_hour?: number
          maintenance_notes?: string | null
          maintenance_status?: string
          manufacturer?: string | null
          meter_type?: string | null
          meter_unit?: string | null
          model?: string | null
          model_year?: number | null
          monthly_payment?: number
          name?: string
          next_service_date?: string | null
          next_service_meter?: number | null
          notes?: string | null
          other_operating_cost_per_hour?: number
          owner_name?: string | null
          ownership_type?: string
          purchase_date?: string | null
          purchase_price?: number
          qr_code?: string | null
          registration_expiration_date?: string | null
          reliability_score?: number | null
          rental_agreement_number?: string | null
          rental_daily_cost?: number
          rental_end_date?: string | null
          rental_monthly_cost?: number
          rental_start_date?: string | null
          rental_weekly_cost?: number
          replacement_priority?: string
          replacement_score?: number | null
          required_certification_type?: string | null
          requires_operator_certification?: boolean
          safety_notes?: string | null
          salvage_value?: number
          serial_number?: string | null
          service_interval_days?: number | null
          service_interval_meter?: number | null
          status?: string
          subcategory?: string | null
          taxable?: boolean
          total_operating_cost_per_hour?: number
          updated_at?: string
          updated_by?: string | null
          useful_life_years?: number | null
          utilization_target_percent?: number | null
          vendor_id?: string | null
          vin?: string | null
          warranty_expiration_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_default_cost_code_company_fkey"
            columns: ["default_cost_code_id", "company_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "equipment_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_vendor_company_fkey"
            columns: ["vendor_id", "company_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      estimate_acceptance_events: {
        Row: {
          actor_profile_id: string | null
          actor_type: string
          company_id: string
          created_at: string
          estimate_id: string
          event_type: string
          id: string
          idempotency_key: string | null
          metadata: Json
          occurred_at: string
          reason: string | null
          signature_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          actor_type: string
          company_id: string
          created_at?: string
          estimate_id: string
          event_type: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          occurred_at?: string
          reason?: string | null
          signature_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          actor_type?: string
          company_id?: string
          created_at?: string
          estimate_id?: string
          event_type?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          occurred_at?: string
          reason?: string | null
          signature_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_acceptance_events_actor_profile_company_fkey"
            columns: ["actor_profile_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimate_acceptance_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_acceptance_events_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimate_acceptance_events_signature_company_fkey"
            columns: ["signature_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimate_signatures"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      estimate_agreement_versions: {
        Row: {
          agreement_hash: string
          agreement_snapshot: Json
          company_id: string
          created_at: string
          created_by: string | null
          estimate_id: string
          id: string
          source_payment_terms: string | null
          source_terms: string | null
          version_number: number
        }
        Insert: {
          agreement_hash: string
          agreement_snapshot: Json
          company_id: string
          created_at?: string
          created_by?: string | null
          estimate_id: string
          id?: string
          source_payment_terms?: string | null
          source_terms?: string | null
          version_number: number
        }
        Update: {
          agreement_hash?: string
          agreement_snapshot?: Json
          company_id?: string
          created_at?: string
          created_by?: string | null
          estimate_id?: string
          id?: string
          source_payment_terms?: string | null
          source_terms?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_agreement_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_agreement_versions_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimate_agreement_versions_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      estimate_items: {
        Row: {
          ai_context: Json
          company_id: string
          converted_task_id: string | null
          created_at: string
          customer_description: string | null
          customer_line_total: number
          customer_unit_price: number
          customer_visible: boolean
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          equipment_cost: number
          estimate_id: string
          generated_by_ai: boolean
          id: string
          internal_cost_total: number
          item_type: string
          labor_cost: number
          labor_hours: number
          labor_rate: number
          markup_type: string
          markup_value: number
          material_cost: number
          name: string
          other_cost: number
          quantity: number
          section_id: string
          sort_order: number
          source_reference: Json | null
          source_type: string | null
          subcontractor_cost: number
          taxable: boolean
          unit: string | null
          updated_at: string
        }
        Insert: {
          ai_context?: Json
          company_id: string
          converted_task_id?: string | null
          created_at?: string
          customer_description?: string | null
          customer_line_total?: number
          customer_unit_price?: number
          customer_visible?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          equipment_cost?: number
          estimate_id: string
          generated_by_ai?: boolean
          id?: string
          internal_cost_total?: number
          item_type?: string
          labor_cost?: number
          labor_hours?: number
          labor_rate?: number
          markup_type?: string
          markup_value?: number
          material_cost?: number
          name: string
          other_cost?: number
          quantity?: number
          section_id: string
          sort_order?: number
          source_reference?: Json | null
          source_type?: string | null
          subcontractor_cost?: number
          taxable?: boolean
          unit?: string | null
          updated_at?: string
        }
        Update: {
          ai_context?: Json
          company_id?: string
          converted_task_id?: string | null
          created_at?: string
          customer_description?: string | null
          customer_line_total?: number
          customer_unit_price?: number
          customer_visible?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          equipment_cost?: number
          estimate_id?: string
          generated_by_ai?: boolean
          id?: string
          internal_cost_total?: number
          item_type?: string
          labor_cost?: number
          labor_hours?: number
          labor_rate?: number
          markup_type?: string
          markup_value?: number
          material_cost?: number
          name?: string
          other_cost?: number
          quantity?: number
          section_id?: string
          sort_order?: number
          source_reference?: Json | null
          source_type?: string | null
          subcontractor_cost?: number
          taxable?: boolean
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_items_converted_task_id_fkey"
            columns: ["converted_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_items_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_items_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimate_items_section_estimate_company_fkey"
            columns: ["section_id", "estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimate_sections"
            referencedColumns: ["id", "estimate_id", "company_id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          category: string
          company_id: string
          created_at: string
          description: string
          estimate_id: string
          id: string
          item_code: string | null
          line_total: number
          markup_percent: number
          notes: string | null
          quantity: number
          sort_order: number
          unit: string
          unit_cost: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          category?: string
          company_id: string
          created_at?: string
          description: string
          estimate_id: string
          id?: string
          item_code?: string | null
          line_total?: number
          markup_percent?: number
          notes?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          description?: string
          estimate_id?: string
          id?: string
          item_code?: string | null
          line_total?: number
          markup_percent?: number
          notes?: string | null
          quantity?: number
          sort_order?: number
          unit?: string
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      estimate_project_conversions: {
        Row: {
          company_id: string
          completed_at: string | null
          converted_by: string | null
          created_at: string
          deposit_invoice_id: string | null
          error_message: string | null
          estimate_id: string
          id: string
          idempotency_key: string
          metadata: Json
          project_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          converted_by?: string | null
          created_at?: string
          deposit_invoice_id?: string | null
          error_message?: string | null
          estimate_id: string
          id?: string
          idempotency_key: string
          metadata?: Json
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          converted_by?: string | null
          created_at?: string
          deposit_invoice_id?: string | null
          error_message?: string | null
          estimate_id?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_project_conversions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_project_conversions_converted_by_company_fkey"
            columns: ["converted_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimate_project_conversions_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimate_project_conversions_invoice_company_fkey"
            columns: ["deposit_invoice_id", "company_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimate_project_conversions_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      estimate_public_tokens: {
        Row: {
          company_id: string
          created_at: string
          estimate_id: string
          expires_at: string
          id: string
          issued_by: string | null
          last_viewed_at: string | null
          last_viewed_ip: string | null
          last_viewed_user_agent: string | null
          metadata: Json
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
          updated_at: string
          view_count: number
        }
        Insert: {
          company_id: string
          created_at?: string
          estimate_id: string
          expires_at: string
          id?: string
          issued_by?: string | null
          last_viewed_at?: string | null
          last_viewed_ip?: string | null
          last_viewed_user_agent?: string | null
          metadata?: Json
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          estimate_id?: string
          expires_at?: string
          id?: string
          issued_by?: string | null
          last_viewed_at?: string | null
          last_viewed_ip?: string | null
          last_viewed_user_agent?: string | null
          metadata?: Json
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_public_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_public_tokens_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimate_public_tokens_issued_by_company_fkey"
            columns: ["issued_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimate_public_tokens_revoked_by_company_fkey"
            columns: ["revoked_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      estimate_sections: {
        Row: {
          company_id: string
          created_at: string
          customer_visible: boolean
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          estimate_id: string
          id: string
          name: string
          section_internal_cost: number
          section_subtotal: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_visible?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          estimate_id: string
          id?: string
          name: string
          section_internal_cost?: number
          section_subtotal?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_visible?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          estimate_id?: string
          id?: string
          name?: string
          section_internal_cost?: number
          section_subtotal?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_sections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_sections_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_sections_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      estimate_signatures: {
        Row: {
          agreement_version_id: string
          company_id: string
          consent_accepted: boolean
          created_at: string
          estimate_id: string
          estimate_version_number: number
          id: string
          idempotency_key: string
          ip_address: string | null
          metadata: Json
          public_token_id: string | null
          signature_hash: string
          signed_at: string
          typed_name: string
          user_agent: string | null
          verification_result: string
        }
        Insert: {
          agreement_version_id: string
          company_id: string
          consent_accepted: boolean
          created_at?: string
          estimate_id: string
          estimate_version_number: number
          id?: string
          idempotency_key: string
          ip_address?: string | null
          metadata?: Json
          public_token_id?: string | null
          signature_hash: string
          signed_at?: string
          typed_name: string
          user_agent?: string | null
          verification_result?: string
        }
        Update: {
          agreement_version_id?: string
          company_id?: string
          consent_accepted?: boolean
          created_at?: string
          estimate_id?: string
          estimate_version_number?: number
          id?: string
          idempotency_key?: string
          ip_address?: string | null
          metadata?: Json
          public_token_id?: string | null
          signature_hash?: string
          signed_at?: string
          typed_name?: string
          user_agent?: string | null
          verification_result?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_signatures_agreement_company_fkey"
            columns: ["agreement_version_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimate_agreement_versions"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimate_signatures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_signatures_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimate_signatures_public_token_company_fkey"
            columns: ["public_token_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimate_public_tokens"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      estimates: {
        Row: {
          additional_fee: number
          agreement_hash: string | null
          agreement_snapshot: Json | null
          agreement_version_id: string | null
          ai_context: Json
          approval_signature_id: string | null
          approved_at: string | null
          archived_at: string | null
          company_id: string
          conversion_state: string
          converted_at: string | null
          converted_project_id: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          customer_id: string | null
          customer_notes: string | null
          customer_snapshot: Json
          decline_reason: string | null
          declined_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_amount: number
          deposit_invoice_id: string | null
          deposit_type: string
          deposit_value: number
          description: string | null
          direct_cost_subtotal: number
          discount_amount: number
          discount_total: number
          discount_type: string
          discount_value: number
          estimate_number: string | null
          expiration_date: string | null
          followup_due_at: string | null
          generated_by_ai: boolean
          gross_margin_percent: number
          gross_profit: number
          id: string
          internal_cost_total: number
          internal_notes: string | null
          issue_date: string | null
          markup_total: number
          payment_terms: string | null
          pdf_snapshot: Json | null
          prepared_by: string | null
          previous_estimate_id: string | null
          project_id: string | null
          public_token_last_issued_at: string | null
          revision_request_notes: string | null
          revision_requested_at: string | null
          scope_exclusions: string | null
          scope_inclusions: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          terms: string | null
          title: string
          total_amount: number
          updated_at: string
          updated_by: string | null
          version_number: number
        }
        Insert: {
          additional_fee?: number
          agreement_hash?: string | null
          agreement_snapshot?: Json | null
          agreement_version_id?: string | null
          ai_context?: Json
          approval_signature_id?: string | null
          approved_at?: string | null
          archived_at?: string | null
          company_id: string
          conversion_state?: string
          converted_at?: string | null
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_id?: string | null
          customer_notes?: string | null
          customer_snapshot?: Json
          decline_reason?: string | null
          declined_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number
          deposit_invoice_id?: string | null
          deposit_type?: string
          deposit_value?: number
          description?: string | null
          direct_cost_subtotal?: number
          discount_amount?: number
          discount_total?: number
          discount_type?: string
          discount_value?: number
          estimate_number?: string | null
          expiration_date?: string | null
          followup_due_at?: string | null
          generated_by_ai?: boolean
          gross_margin_percent?: number
          gross_profit?: number
          id?: string
          internal_cost_total?: number
          internal_notes?: string | null
          issue_date?: string | null
          markup_total?: number
          payment_terms?: string | null
          pdf_snapshot?: Json | null
          prepared_by?: string | null
          previous_estimate_id?: string | null
          project_id?: string | null
          public_token_last_issued_at?: string | null
          revision_request_notes?: string | null
          revision_requested_at?: string | null
          scope_exclusions?: string | null
          scope_inclusions?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          terms?: string | null
          title: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          version_number?: number
        }
        Update: {
          additional_fee?: number
          agreement_hash?: string | null
          agreement_snapshot?: Json | null
          agreement_version_id?: string | null
          ai_context?: Json
          approval_signature_id?: string | null
          approved_at?: string | null
          archived_at?: string | null
          company_id?: string
          conversion_state?: string
          converted_at?: string | null
          converted_project_id?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          customer_id?: string | null
          customer_notes?: string | null
          customer_snapshot?: Json
          decline_reason?: string | null
          declined_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number
          deposit_invoice_id?: string | null
          deposit_type?: string
          deposit_value?: number
          description?: string | null
          direct_cost_subtotal?: number
          discount_amount?: number
          discount_total?: number
          discount_type?: string
          discount_value?: number
          estimate_number?: string | null
          expiration_date?: string | null
          followup_due_at?: string | null
          generated_by_ai?: boolean
          gross_margin_percent?: number
          gross_profit?: number
          id?: string
          internal_cost_total?: number
          internal_notes?: string | null
          issue_date?: string | null
          markup_total?: number
          payment_terms?: string | null
          pdf_snapshot?: Json | null
          prepared_by?: string | null
          previous_estimate_id?: string | null
          project_id?: string | null
          public_token_last_issued_at?: string | null
          revision_request_notes?: string | null
          revision_requested_at?: string | null
          scope_exclusions?: string | null
          scope_inclusions?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          terms?: string | null
          title?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimates_agreement_version_company_fkey"
            columns: ["agreement_version_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimate_agreement_versions"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimates_approval_signature_company_fkey"
            columns: ["approval_signature_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimate_signatures"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_converted_project_company_fkey"
            columns: ["converted_project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "estimates_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_deposit_invoice_company_fkey"
            columns: ["deposit_invoice_id", "company_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "estimates_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_previous_estimate_id_fkey"
            columns: ["previous_estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_estimate_links: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          estimate_id: string
          id: string
          invoice_id: string
          link_type: string
          metadata: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          estimate_id: string
          id?: string
          invoice_id: string
          link_type?: string
          metadata?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          estimate_id?: string
          id?: string
          invoice_id?: string
          link_type?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "invoice_estimate_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_estimate_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_estimate_links_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "invoice_estimate_links_invoice_company_fkey"
            columns: ["invoice_id", "company_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          description: string
          id: string
          invoice_id: string
          notes: string | null
          quantity: number
          rate: number
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          amount?: number
          company_id: string
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          notes?: string | null
          quantity?: number
          rate?: number
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          quantity?: number
          rate?: number
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_company_fkey"
            columns: ["invoice_id", "company_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      invoice_notes: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          note: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          note: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          note?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_notes_invoice_company_fkey"
            columns: ["invoice_id", "company_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "invoice_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payment_history: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          payment_date: string
          reference_number: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          payment_date: string
          reference_number?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string
          reference_number?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payment_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payment_history_invoice_company_fkey"
            columns: ["invoice_id", "company_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "invoice_payment_history_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          additional_fee: number
          amount_paid: number
          archived_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          discount_total: number
          discount_type: string
          discount_value: number
          due_date: string | null
          estimate_id: string | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          notes: string | null
          paid_date: string | null
          payment_terms: string | null
          prepared_by: string | null
          project_id: string | null
          sent_at: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          title: string
          total_amount: number
          updated_at: string
          updated_by: string | null
          viewed_at: string | null
        }
        Insert: {
          additional_fee?: number
          amount_paid?: number
          archived_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          discount_total?: number
          discount_type?: string
          discount_value?: number
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          notes?: string | null
          paid_date?: string | null
          payment_terms?: string | null
          prepared_by?: string | null
          project_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          viewed_at?: string | null
        }
        Update: {
          additional_fee?: number
          amount_paid?: number
          archived_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          discount_total?: number
          discount_type?: string
          discount_value?: number
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          notes?: string | null
          paid_date?: string | null
          payment_terms?: string | null
          prepared_by?: string | null
          project_id?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          title?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          viewed_at?: string | null
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
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "invoices_estimate_company_fkey"
            columns: ["estimate_id", "company_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "invoices_prepared_by_fkey"
            columns: ["prepared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_rates: {
        Row: {
          base_hourly_rate: number
          billable_hourly_rate: number
          bonus_hourly_allocation: number
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          crew_size: number | null
          currency_code: string
          default_cost_code_id: string | null
          description: string | null
          double_time_multiplier: number
          employment_type: string | null
          health_insurance_hourly: number
          holiday_multiplier: number
          id: string
          name: string
          notes: string | null
          other_burden_hourly: number
          overhead_markup_percent: number
          overtime_multiplier: number
          paid_time_off_hourly: number
          payroll_tax_hourly: number
          phone_allowance_hourly: number
          position_title: string | null
          production_period: string | null
          production_rate: number | null
          production_unit: string | null
          profit_markup_percent: number
          retirement_hourly: number
          shift_differential: number
          skill_level: string | null
          status: string
          tool_allowance_hourly: number
          total_burden_hourly: number
          trade: string | null
          training_hourly: number
          true_hourly_cost: number
          uniform_hourly: number
          union_status: string | null
          updated_at: string
          updated_by: string | null
          vehicle_allowance_hourly: number
          weekend_multiplier: number
          worker_classification: string | null
          workers_comp_hourly: number
        }
        Insert: {
          base_hourly_rate?: number
          billable_hourly_rate?: number
          bonus_hourly_allocation?: number
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          crew_size?: number | null
          currency_code?: string
          default_cost_code_id?: string | null
          description?: string | null
          double_time_multiplier?: number
          employment_type?: string | null
          health_insurance_hourly?: number
          holiday_multiplier?: number
          id?: string
          name: string
          notes?: string | null
          other_burden_hourly?: number
          overhead_markup_percent?: number
          overtime_multiplier?: number
          paid_time_off_hourly?: number
          payroll_tax_hourly?: number
          phone_allowance_hourly?: number
          position_title?: string | null
          production_period?: string | null
          production_rate?: number | null
          production_unit?: string | null
          profit_markup_percent?: number
          retirement_hourly?: number
          shift_differential?: number
          skill_level?: string | null
          status?: string
          tool_allowance_hourly?: number
          total_burden_hourly?: number
          trade?: string | null
          training_hourly?: number
          true_hourly_cost?: number
          uniform_hourly?: number
          union_status?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_allowance_hourly?: number
          weekend_multiplier?: number
          worker_classification?: string | null
          workers_comp_hourly?: number
        }
        Update: {
          base_hourly_rate?: number
          billable_hourly_rate?: number
          bonus_hourly_allocation?: number
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          crew_size?: number | null
          currency_code?: string
          default_cost_code_id?: string | null
          description?: string | null
          double_time_multiplier?: number
          employment_type?: string | null
          health_insurance_hourly?: number
          holiday_multiplier?: number
          id?: string
          name?: string
          notes?: string | null
          other_burden_hourly?: number
          overhead_markup_percent?: number
          overtime_multiplier?: number
          paid_time_off_hourly?: number
          payroll_tax_hourly?: number
          phone_allowance_hourly?: number
          position_title?: string | null
          production_period?: string | null
          production_rate?: number | null
          production_unit?: string | null
          profit_markup_percent?: number
          retirement_hourly?: number
          shift_differential?: number
          skill_level?: string | null
          status?: string
          tool_allowance_hourly?: number
          total_burden_hourly?: number
          trade?: string | null
          training_hourly?: number
          true_hourly_cost?: number
          uniform_hourly?: number
          union_status?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_allowance_hourly?: number
          weekend_multiplier?: number
          worker_classification?: string | null
          workers_comp_hourly?: number
        }
        Relationships: [
          {
            foreignKeyName: "labor_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labor_rates_default_cost_code_company_fkey"
            columns: ["default_cost_code_id", "company_id"]
            isOneToOne: false
            referencedRelation: "cost_codes"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "labor_rates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          average_cost: number
          bin_location: string | null
          category: string | null
          company_id: string
          created_at: string
          created_by: string | null
          current_stock: number
          description: string | null
          height: number | null
          id: string
          last_purchase_cost: number
          last_purchase_date: string | null
          lead_time_days: number | null
          length: number | null
          manufacturer: string | null
          manufacturer_part_number: string | null
          markup_percent: number
          material_code: string
          name: string
          notes: string | null
          preferred_vendor_id: string | null
          reorder_point: number
          reorder_quantity: number
          standard_cost: number
          status: string
          suggested_sell_price: number
          track_inventory: boolean
          trade: string | null
          unit_of_measure: string
          updated_at: string
          updated_by: string | null
          vendor_part_number: string | null
          warehouse_location: string | null
          weight: number | null
          width: number | null
        }
        Insert: {
          average_cost?: number
          bin_location?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          current_stock?: number
          description?: string | null
          height?: number | null
          id?: string
          last_purchase_cost?: number
          last_purchase_date?: string | null
          lead_time_days?: number | null
          length?: number | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          markup_percent?: number
          material_code: string
          name: string
          notes?: string | null
          preferred_vendor_id?: string | null
          reorder_point?: number
          reorder_quantity?: number
          standard_cost?: number
          status?: string
          suggested_sell_price?: number
          track_inventory?: boolean
          trade?: string | null
          unit_of_measure?: string
          updated_at?: string
          updated_by?: string | null
          vendor_part_number?: string | null
          warehouse_location?: string | null
          weight?: number | null
          width?: number | null
        }
        Update: {
          average_cost?: number
          bin_location?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_stock?: number
          description?: string | null
          height?: number | null
          id?: string
          last_purchase_cost?: number
          last_purchase_date?: string | null
          lead_time_days?: number | null
          length?: number | null
          manufacturer?: string | null
          manufacturer_part_number?: string | null
          markup_percent?: number
          material_code?: string
          name?: string
          notes?: string | null
          preferred_vendor_id?: string | null
          reorder_point?: number
          reorder_quantity?: number
          standard_cost?: number
          status?: string
          suggested_sell_price?: number
          track_inventory?: boolean
          trade?: string | null
          unit_of_measure?: string
          updated_at?: string
          updated_by?: string | null
          vendor_part_number?: string | null
          warehouse_location?: string | null
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_preferred_vendor_id_fkey"
            columns: ["preferred_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      project_closeout_items: {
        Row: {
          category: string
          closeout_id: string
          company_id: string
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          item_key: string
          notes: string | null
          project_id: string
          required: boolean
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          closeout_id: string
          company_id: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_key: string
          notes?: string | null
          project_id: string
          required?: boolean
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          closeout_id?: string
          company_id?: string
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_key?: string
          notes?: string | null
          project_id?: string
          required?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_closeout_items_closeout_company_fkey"
            columns: ["closeout_id"]
            isOneToOne: false
            referencedRelation: "project_closeouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_closeout_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_closeout_items_completed_by_company_fkey"
            columns: ["completed_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_closeout_items_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_closeout_items_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_closeout_items_updated_by_company_fkey"
            columns: ["updated_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      project_closeouts: {
        Row: {
          authorized_exceptions: Json
          closeout_notes: string | null
          company_id: string
          completed_by: string | null
          completion_blockers: Json
          completion_date: string | null
          created_at: string
          created_by: string | null
          crew_removal_completed: boolean
          customer_approval_recorded: boolean
          equipment_return_completed: boolean
          final_payment_recorded: boolean
          handover_status: string
          id: string
          idempotency_key: string | null
          permit_closure_completed: boolean
          project_id: string
          required_documents_completed: boolean
          started_at: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          authorized_exceptions?: Json
          closeout_notes?: string | null
          company_id: string
          completed_by?: string | null
          completion_blockers?: Json
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          crew_removal_completed?: boolean
          customer_approval_recorded?: boolean
          equipment_return_completed?: boolean
          final_payment_recorded?: boolean
          handover_status?: string
          id?: string
          idempotency_key?: string | null
          permit_closure_completed?: boolean
          project_id: string
          required_documents_completed?: boolean
          started_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          authorized_exceptions?: Json
          closeout_notes?: string | null
          company_id?: string
          completed_by?: string | null
          completion_blockers?: Json
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          crew_removal_completed?: boolean
          customer_approval_recorded?: boolean
          equipment_return_completed?: boolean
          final_payment_recorded?: boolean
          handover_status?: string
          id?: string
          idempotency_key?: string | null
          permit_closure_completed?: boolean
          project_id?: string
          required_documents_completed?: boolean
          started_at?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_closeouts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_closeouts_completed_by_company_fkey"
            columns: ["completed_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_closeouts_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_closeouts_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_closeouts_updated_by_company_fkey"
            columns: ["updated_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      project_communications: {
        Row: {
          channel: string
          company_id: string
          correlation_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          direction: string
          failed_at: string | null
          failure_reason: string | null
          id: string
          message: string
          metadata: Json
          project_id: string
          recipient_address: string | null
          recipient_name: string | null
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          channel: string
          company_id: string
          correlation_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          direction: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          message: string
          metadata?: Json
          project_id: string
          recipient_address?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          channel?: string
          company_id?: string
          correlation_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          direction?: string
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          message?: string
          metadata?: Json
          project_id?: string
          recipient_address?: string | null
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_communications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_communications_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_communications_customer_company_fkey"
            columns: ["customer_id", "company_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_communications_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      project_inspections: {
        Row: {
          attachments: Json
          authority: string | null
          company_id: string
          completed_at: string | null
          correction_notes: string | null
          created_at: string
          created_by: string | null
          id: string
          idempotency_key: string | null
          inspection_type: string
          inspector_contact: string | null
          inspector_name: string | null
          jurisdiction: string | null
          location: string | null
          notes: string | null
          project_id: string
          reinspection_date: string | null
          reinspection_required: boolean
          result: string | null
          scheduled_at: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          attachments?: Json
          authority?: string | null
          company_id: string
          completed_at?: string | null
          correction_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          inspection_type: string
          inspector_contact?: string | null
          inspector_name?: string | null
          jurisdiction?: string | null
          location?: string | null
          notes?: string | null
          project_id: string
          reinspection_date?: string | null
          reinspection_required?: boolean
          result?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          attachments?: Json
          authority?: string | null
          company_id?: string
          completed_at?: string | null
          correction_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          idempotency_key?: string | null
          inspection_type?: string
          inspector_contact?: string | null
          inspector_name?: string | null
          jurisdiction?: string | null
          location?: string | null
          notes?: string | null
          project_id?: string
          reinspection_date?: string | null
          reinspection_required?: boolean
          result?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_inspections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_inspections_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_inspections_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_inspections_updated_by_company_fkey"
            columns: ["updated_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      project_permits: {
        Row: {
          application_date: string | null
          approved_at: string | null
          closed_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          expiration_date: string | null
          fee_amount: number
          fee_paid: number
          id: string
          idempotency_key: string | null
          issued_at: string | null
          issuing_authority: string | null
          jurisdiction: string | null
          notes: string | null
          permit_number: string | null
          permit_type: string
          project_id: string
          rejection_reason: string | null
          renewal_required: boolean
          responsible_party: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          application_date?: string | null
          approved_at?: string | null
          closed_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          fee_amount?: number
          fee_paid?: number
          id?: string
          idempotency_key?: string | null
          issued_at?: string | null
          issuing_authority?: string | null
          jurisdiction?: string | null
          notes?: string | null
          permit_number?: string | null
          permit_type: string
          project_id: string
          rejection_reason?: string | null
          renewal_required?: boolean
          responsible_party?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          application_date?: string | null
          approved_at?: string | null
          closed_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          expiration_date?: string | null
          fee_amount?: number
          fee_paid?: number
          id?: string
          idempotency_key?: string | null
          issued_at?: string | null
          issuing_authority?: string | null
          jurisdiction?: string | null
          notes?: string | null
          permit_number?: string | null
          permit_type?: string
          project_id?: string
          rejection_reason?: string | null
          renewal_required?: boolean
          responsible_party?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_permits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_permits_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_permits_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_permits_updated_by_company_fkey"
            columns: ["updated_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
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
      project_punch_items: {
        Row: {
          assigned_profile_id: string | null
          closeout_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          idempotency_key: string | null
          location: string | null
          notes: string | null
          priority: string
          project_id: string
          reopened_at: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_profile_id?: string | null
          closeout_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          location?: string | null
          notes?: string | null
          priority?: string
          project_id: string
          reopened_at?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_profile_id?: string | null
          closeout_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          location?: string | null
          notes?: string | null
          priority?: string
          project_id?: string
          reopened_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_punch_items_assigned_profile_company_fkey"
            columns: ["assigned_profile_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_punch_items_closeout_company_fkey"
            columns: ["closeout_id"]
            isOneToOne: false
            referencedRelation: "project_closeouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_punch_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_punch_items_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_punch_items_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_punch_items_updated_by_company_fkey"
            columns: ["updated_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      project_warranties: {
        Row: {
          closeout_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          details: string | null
          ends_at: string | null
          id: string
          project_id: string
          provider_name: string | null
          starts_at: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          closeout_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          details?: string | null
          ends_at?: string | null
          id?: string
          project_id: string
          provider_name?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          closeout_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          details?: string | null
          ends_at?: string | null
          id?: string
          project_id?: string
          provider_name?: string | null
          starts_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_warranties_closeout_company_fkey"
            columns: ["closeout_id"]
            isOneToOne: false
            referencedRelation: "project_closeouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_warranties_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_warranties_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_warranties_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "project_warranties_updated_by_company_fkey"
            columns: ["updated_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
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
          job_site_name: string | null
          name: string
          postal_code: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          project_number: string | null
          project_type: string | null
          required_down_payment: number
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
          job_site_name?: string | null
          name: string
          postal_code?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          project_number?: string | null
          project_type?: string | null
          required_down_payment?: number
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
          job_site_name?: string | null
          name?: string
          postal_code?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          project_number?: string | null
          project_type?: string | null
          required_down_payment?: number
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
      trade_partner_assignments: {
        Row: {
          assignment_status: string
          company_id: string
          contract_amount: number | null
          contract_status: string
          created_at: string
          created_by: string | null
          crew_size: number | null
          id: string
          notes: string | null
          payment_terms: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          project_id: string
          retainage_percent: number | null
          scope_of_work: string | null
          start_date: string | null
          target_completion_date: string | null
          trade_name: string
          updated_at: string
          updated_by: string | null
          vendor_id: string
        }
        Insert: {
          assignment_status?: string
          company_id: string
          contract_amount?: number | null
          contract_status?: string
          created_at?: string
          created_by?: string | null
          crew_size?: number | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          project_id: string
          retainage_percent?: number | null
          scope_of_work?: string | null
          start_date?: string | null
          target_completion_date?: string | null
          trade_name: string
          updated_at?: string
          updated_by?: string | null
          vendor_id: string
        }
        Update: {
          assignment_status?: string
          company_id?: string
          contract_amount?: number | null
          contract_status?: string
          created_at?: string
          created_by?: string | null
          crew_size?: number | null
          id?: string
          notes?: string | null
          payment_terms?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          project_id?: string
          retainage_percent?: number | null
          scope_of_work?: string | null
          start_date?: string | null
          target_completion_date?: string | null
          trade_name?: string
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_partner_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_partner_assignments_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "trade_partner_assignments_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "trade_partner_assignments_updated_by_company_fkey"
            columns: ["updated_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "trade_partner_assignments_vendor_company_fkey"
            columns: ["vendor_id", "company_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      units_of_measure: {
        Row: {
          allow_fractional_quantity: boolean
          base_unit_id: string | null
          category: string
          code: string
          company_id: string | null
          conversion_factor: number | null
          created_at: string
          created_by: string | null
          decimal_precision: number
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          measurement_system: string
          name: string
          notes: string | null
          plural_name: string | null
          sort_order: number
          symbol: string | null
          unit_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_fractional_quantity?: boolean
          base_unit_id?: string | null
          category: string
          code: string
          company_id?: string | null
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          decimal_precision?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          measurement_system?: string
          name: string
          notes?: string | null
          plural_name?: string | null
          sort_order?: number
          symbol?: string | null
          unit_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_fractional_quantity?: boolean
          base_unit_id?: string | null
          category?: string
          code?: string
          company_id?: string | null
          conversion_factor?: number | null
          created_at?: string
          created_by?: string | null
          decimal_precision?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          measurement_system?: string
          name?: string
          notes?: string | null
          plural_name?: string | null
          sort_order?: number
          symbol?: string | null
          unit_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_of_measure_base_unit_id_fkey"
            columns: ["base_unit_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_of_measure_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_of_measure_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_of_measure_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          company_id: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          account_number: string | null
          billing_address: string | null
          city: string | null
          company_id: string
          company_name: string
          country: string | null
          created_at: string
          created_by: string | null
          credit_limit: number | null
          delivery_rating: number | null
          display_name: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          mobile: string | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          preferred_vendor: boolean
          quality_rating: number | null
          shipping_address: string | null
          state: string | null
          status: string
          tax_id: string | null
          title: string | null
          updated_at: string
          updated_by: string | null
          vendor_code: string
          website: string | null
        }
        Insert: {
          account_number?: string | null
          billing_address?: string | null
          city?: string | null
          company_id: string
          company_name: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          delivery_rating?: number | null
          display_name: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_vendor?: boolean
          quality_rating?: number | null
          shipping_address?: string | null
          state?: string | null
          status?: string
          tax_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_code: string
          website?: string | null
        }
        Update: {
          account_number?: string | null
          billing_address?: string | null
          city?: string | null
          company_id?: string
          company_name?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          delivery_rating?: number | null
          display_name?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_vendor?: boolean
          quality_rating?: number | null
          shipping_address?: string | null
          state?: string | null
          status?: string
          tax_id?: string | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_code?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events: {
        Row: {
          actor_profile_id: string | null
          causation_id: string | null
          company_id: string
          correlation_id: string | null
          created_at: string
          current_state: string | null
          event_type: string
          id: string
          idempotency_key: string | null
          metadata: Json
          next_state: string | null
          occurred_at: string
          payload: Json
          reference_entity: string
          reference_id: string | null
          source_module: string | null
          version: number
          workflow_name: string
          workspace_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          causation_id?: string | null
          company_id: string
          correlation_id?: string | null
          created_at?: string
          current_state?: string | null
          event_type: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          next_state?: string | null
          occurred_at?: string
          payload?: Json
          reference_entity: string
          reference_id?: string | null
          source_module?: string | null
          version?: number
          workflow_name: string
          workspace_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          causation_id?: string | null
          company_id?: string
          correlation_id?: string | null
          created_at?: string
          current_state?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          next_state?: string | null
          occurred_at?: string
          payload?: Json
          reference_entity?: string
          reference_id?: string | null
          source_module?: string | null
          version?: number
          workflow_name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_actor_profile_company_fkey"
            columns: ["actor_profile_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "workflow_events_causation_event_fkey"
            columns: ["causation_id"]
            isOneToOne: false
            referencedRelation: "workflow_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_assignments: {
        Row: {
          assignment_type: string
          company_id: string
          created_at: string
          created_by: string | null
          crew_id: string | null
          description: string | null
          employee_id: string | null
          ends_at: string
          id: string
          notes: string | null
          phase_id: string | null
          planned_hours: number
          project_id: string
          source_id: string | null
          source_type: string
          starts_at: string
          status: string
          task_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assignment_type: string
          company_id: string
          created_at?: string
          created_by?: string | null
          crew_id?: string | null
          description?: string | null
          employee_id?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          phase_id?: string | null
          planned_hours?: number
          project_id: string
          source_id?: string | null
          source_type?: string
          starts_at: string
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assignment_type?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          crew_id?: string | null
          description?: string | null
          employee_id?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          phase_id?: string | null
          planned_hours?: number
          project_id?: string
          source_id?: string | null
          source_type?: string
          starts_at?: string
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workforce_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workforce_assignments_created_by_company_fkey"
            columns: ["created_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "workforce_assignments_crew_company_fkey"
            columns: ["crew_id", "company_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "workforce_assignments_employee_company_fkey"
            columns: ["employee_id", "company_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "workforce_assignments_phase_project_company_fkey"
            columns: ["phase_id", "project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "project_phases"
            referencedColumns: ["id", "project_id", "company_id"]
          },
          {
            foreignKeyName: "workforce_assignments_project_company_fkey"
            columns: ["project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "workforce_assignments_task_project_company_fkey"
            columns: ["task_id", "project_id", "company_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "project_id", "company_id"]
          },
          {
            foreignKeyName: "workforce_assignments_updated_by_company_fkey"
            columns: ["updated_by", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      workforce_events: {
        Row: {
          action: string
          actor_profile_id: string | null
          company_id: string
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          occurred_at: string
          payload: Json
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          company_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          company_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "workforce_events_actor_profile_company_fkey"
            columns: ["actor_profile_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "workforce_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allocate_change_order_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      allocate_estimate_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      allocate_project_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      bango_memory_can_read: {
        Args: {
          memory_category: string
          memory_tags: string[]
          target_company_id: string
        }
        Returns: boolean
      }
      bango_memory_can_write: {
        Args: { memory_category: string; target_company_id: string }
        Returns: boolean
      }
      bango_memory_has_active_membership: {
        Args: { target_company_id: string }
        Returns: boolean
      }
      bango_memory_membership_role: {
        Args: { target_company_id: string }
        Returns: string
      }
      calculate_deposit_amount: {
        Args: {
          p_deposit_type: string
          p_deposit_value: number
          p_total_amount: number
        }
        Returns: number
      }
      calculate_estimate_deposit: {
        Args: { p_company_id: string; p_estimate_id: string }
        Returns: number
      }
      company_role_weight: { Args: { input_role: string }; Returns: number }
      convert_estimate_to_project: {
        Args: {
          p_actor_profile_id: string
          p_company_id: string
          p_create_deposit_invoice?: boolean
          p_estimate_id: string
          p_idempotency_key: string
        }
        Returns: {
          conversion_id: string
          conversion_status: string
          deposit_invoice_id: string
          idempotent: boolean
          project_id: string
          project_number: string
        }[]
      }
      has_company_role: {
        Args: { p_company_id: string; p_roles: string[]; p_user_id?: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { p_company_id: string; p_user_id?: string }
        Returns: boolean
      }
      normalize_company_slug: { Args: { input_value: string }; Returns: string }
      recalc_change_order_totals: {
        Args: { p_change_order_id: string }
        Returns: undefined
      }
      recalc_estimate_item_fields: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      recalc_estimate_section_totals: {
        Args: { p_section_id: string }
        Returns: undefined
      }
      recalc_estimate_totals: {
        Args: { p_estimate_id: string }
        Returns: undefined
      }
      reorder_estimate_items: {
        Args: {
          p_estimate_id: string
          p_item_ids: string[]
          p_section_id: string
        }
        Returns: undefined
      }
      reorder_estimate_sections: {
        Args: { p_estimate_id: string; p_section_ids: string[] }
        Returns: undefined
      }
      round_money: { Args: { p_value: number }; Returns: number }
      seed_default_system_units_of_measure: { Args: never; Returns: undefined }
      validate_estimate_public_token: {
        Args: { p_ip_address?: string; p_token: string; p_user_agent?: string }
        Returns: {
          company_id: string
          estimate_id: string
          expires_at: string
          failure_reason: string
          is_valid: boolean
          token_id: string
        }[]
      }
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
