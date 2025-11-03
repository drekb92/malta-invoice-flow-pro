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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      banking_details: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_routing_number: string | null
          bank_swift_code: string | null
          created_at: string | null
          display_format: string | null
          id: string
          include_on_invoices: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          bank_swift_code?: string | null
          created_at?: string | null
          display_format?: string | null
          id?: string
          include_on_invoices?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_routing_number?: string | null
          bank_swift_code?: string | null
          created_at?: string | null
          display_format?: string | null
          id?: string
          include_on_invoices?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_email: string | null
          company_logo: string | null
          company_name: string | null
          company_phone: string | null
          company_registration_number: string | null
          company_state: string | null
          company_vat_number: string | null
          company_website: string | null
          company_zip_code: string | null
          created_at: string | null
          currency_code: string | null
          default_payment_terms: number | null
          id: string
          invoice_prefix: string | null
          quotation_prefix: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_email?: string | null
          company_logo?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_registration_number?: string | null
          company_state?: string | null
          company_vat_number?: string | null
          company_website?: string | null
          company_zip_code?: string | null
          created_at?: string | null
          currency_code?: string | null
          default_payment_terms?: number | null
          id?: string
          invoice_prefix?: string | null
          quotation_prefix?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_email?: string | null
          company_logo?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_registration_number?: string | null
          company_state?: string | null
          company_vat_number?: string | null
          company_website?: string | null
          company_zip_code?: string | null
          created_at?: string | null
          currency_code?: string | null
          default_payment_terms?: number | null
          id?: string
          invoice_prefix?: string | null
          quotation_prefix?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_note_counters: {
        Row: {
          business_id: string
          id: string
          last_seq: number
          prefix: string
          year: number
        }
        Insert: {
          business_id: string
          id?: string
          last_seq?: number
          prefix?: string
          year: number
        }
        Update: {
          business_id?: string
          id?: string
          last_seq?: number
          prefix?: string
          year?: number
        }
        Relationships: []
      }
      credit_note_items: {
        Row: {
          credit_note_id: string | null
          description: string
          id: string
          quantity: number
          unit: string | null
          unit_price: number
          vat_rate: number
        }
        Insert: {
          credit_note_id?: string | null
          description: string
          id?: string
          quantity?: number
          unit?: string | null
          unit_price: number
          vat_rate?: number
        }
        Update: {
          credit_note_id?: string | null
          description?: string
          id?: string
          quantity?: number
          unit?: string | null
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          amount: number
          created_at: string | null
          credit_note_date: string | null
          credit_note_number: string
          customer_id: string | null
          id: string
          original_invoice_id: string | null
          reason: string
          status: string | null
          user_id: string | null
          vat_rate: number | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          credit_note_date?: string | null
          credit_note_number: string
          customer_id?: string | null
          id?: string
          original_invoice_id?: string | null
          reason: string
          status?: string | null
          user_id?: string | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          credit_note_date?: string | null
          credit_note_number?: string
          customer_id?: string | null
          id?: string
          original_invoice_id?: string | null
          reason?: string
          status?: string | null
          user_id?: string | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "credit_notes_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          business_name: string | null
          client_type: string | null
          created_at: string | null
          date_added: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          user_id: string | null
          vat_number: string | null
          vat_status: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          client_type?: string | null
          created_at?: string | null
          date_added?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          user_id?: string | null
          vat_number?: string | null
          vat_status?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          client_type?: string | null
          created_at?: string | null
          date_added?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          user_id?: string | null
          vat_number?: string | null
          vat_status?: string | null
        }
        Relationships: []
      }
      invoice_audit_log: {
        Row: {
          action: string
          id: string
          invoice_id: string | null
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          invoice_id?: string | null
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          invoice_id?: string | null
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_audit_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_audit_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          business_id: string
          id: string
          last_seq: number
          prefix: string
          year: number
        }
        Insert: {
          business_id: string
          id?: string
          last_seq?: number
          prefix?: string
          year: number
        }
        Update: {
          business_id?: string
          id?: string
          last_seq?: number
          prefix?: string
          year?: number
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          invoice_id: string | null
          quantity: number | null
          unit: string | null
          unit_price: number
          vat_rate: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          invoice_id?: string | null
          quantity?: number | null
          unit?: string | null
          unit_price: number
          vat_rate?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string | null
          quantity?: number | null
          unit?: string | null
          unit_price?: number
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          created_at: string | null
          default_invoice_notes: string | null
          default_payment_days: number | null
          default_supply_place: string | null
          distance_selling_threshold: number | null
          early_payment_discount_days: number | null
          early_payment_discount_rate: number | null
          eu_vat_moss_eligible: boolean | null
          id: string
          include_eori_number: boolean | null
          include_payment_instructions: boolean | null
          include_vat_breakdown: boolean | null
          intrastat_threshold: number | null
          invoice_footer_text: string | null
          invoice_language: string | null
          late_payment_interest_rate: number | null
          next_invoice_number: number | null
          numbering_prefix: string | null
          reverse_charge_note: string | null
          updated_at: string | null
          user_id: string
          vat_rate_reduced: number | null
          vat_rate_standard: number | null
          vat_rate_zero: number | null
        }
        Insert: {
          created_at?: string | null
          default_invoice_notes?: string | null
          default_payment_days?: number | null
          default_supply_place?: string | null
          distance_selling_threshold?: number | null
          early_payment_discount_days?: number | null
          early_payment_discount_rate?: number | null
          eu_vat_moss_eligible?: boolean | null
          id?: string
          include_eori_number?: boolean | null
          include_payment_instructions?: boolean | null
          include_vat_breakdown?: boolean | null
          intrastat_threshold?: number | null
          invoice_footer_text?: string | null
          invoice_language?: string | null
          late_payment_interest_rate?: number | null
          next_invoice_number?: number | null
          numbering_prefix?: string | null
          reverse_charge_note?: string | null
          updated_at?: string | null
          user_id: string
          vat_rate_reduced?: number | null
          vat_rate_standard?: number | null
          vat_rate_zero?: number | null
        }
        Update: {
          created_at?: string | null
          default_invoice_notes?: string | null
          default_payment_days?: number | null
          default_supply_place?: string | null
          distance_selling_threshold?: number | null
          early_payment_discount_days?: number | null
          early_payment_discount_rate?: number | null
          eu_vat_moss_eligible?: boolean | null
          id?: string
          include_eori_number?: boolean | null
          include_payment_instructions?: boolean | null
          include_vat_breakdown?: boolean | null
          intrastat_threshold?: number | null
          invoice_footer_text?: string | null
          invoice_language?: string | null
          late_payment_interest_rate?: number | null
          next_invoice_number?: number | null
          numbering_prefix?: string | null
          reverse_charge_note?: string | null
          updated_at?: string | null
          user_id?: string
          vat_rate_reduced?: number | null
          vat_rate_standard?: number | null
          vat_rate_zero?: number | null
        }
        Relationships: []
      }
      invoice_templates: {
        Row: {
          accent_color: string | null
          bank_account_name: string | null
          bank_iban: string | null
          bank_name: string | null
          bank_swift: string | null
          banking_position: string | null
          banking_style: string | null
          banking_visibility: boolean | null
          company_position: string | null
          created_at: string | null
          font_family: string | null
          font_size: string | null
          header_layout: string | null
          id: string
          is_default: boolean | null
          layout: string | null
          logo_url: string | null
          logo_x_offset: number | null
          logo_y_offset: number | null
          margin_bottom: number | null
          margin_left: number | null
          margin_right: number | null
          margin_top: number | null
          name: string
          primary_color: string | null
          table_style: string | null
          totals_style: string | null
          user_id: string | null
        }
        Insert: {
          accent_color?: string | null
          bank_account_name?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          banking_position?: string | null
          banking_style?: string | null
          banking_visibility?: boolean | null
          company_position?: string | null
          created_at?: string | null
          font_family?: string | null
          font_size?: string | null
          header_layout?: string | null
          id?: string
          is_default?: boolean | null
          layout?: string | null
          logo_url?: string | null
          logo_x_offset?: number | null
          logo_y_offset?: number | null
          margin_bottom?: number | null
          margin_left?: number | null
          margin_right?: number | null
          margin_top?: number | null
          name: string
          primary_color?: string | null
          table_style?: string | null
          totals_style?: string | null
          user_id?: string | null
        }
        Update: {
          accent_color?: string | null
          bank_account_name?: string | null
          bank_iban?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          banking_position?: string | null
          banking_style?: string | null
          banking_visibility?: boolean | null
          company_position?: string | null
          created_at?: string | null
          font_family?: string | null
          font_size?: string | null
          header_layout?: string | null
          id?: string
          is_default?: boolean | null
          layout?: string | null
          logo_url?: string | null
          logo_x_offset?: number | null
          logo_y_offset?: number | null
          margin_bottom?: number | null
          margin_left?: number | null
          margin_right?: number | null
          margin_top?: number | null
          name?: string
          primary_color?: string | null
          table_style?: string | null
          totals_style?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number | null
          created_at: string | null
          customer_id: string | null
          discount_reason: string | null
          discount_type: string | null
          discount_value: number | null
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_hash: string | null
          invoice_number: string | null
          is_issued: boolean | null
          issued_at: string | null
          status: string | null
          total_amount: number | null
          user_id: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_hash?: string | null
          invoice_number?: string | null
          is_issued?: boolean | null
          issued_at?: string | null
          status?: string | null
          total_amount?: number | null
          user_id?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_hash?: string | null
          invoice_number?: string | null
          is_issued?: boolean | null
          issued_at?: string | null
          status?: string | null
          total_amount?: number | null
          user_id?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          invoice_id: string | null
          method: string | null
          payment_date: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          payment_date?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          payment_date?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quotation_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          quantity: number | null
          quotation_id: string | null
          unit: string | null
          unit_price: number
          vat_rate: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          quantity?: number | null
          quotation_id?: string | null
          unit?: string | null
          unit_price: number
          vat_rate?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          quantity?: number | null
          quotation_id?: string | null
          unit?: string | null
          unit_price?: number
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          amount: number | null
          created_at: string | null
          customer_id: string | null
          id: string
          issue_date: string | null
          quotation_number: string | null
          status: string | null
          total_amount: number | null
          user_id: string | null
          valid_until: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          issue_date?: string | null
          quotation_number?: string | null
          status?: string | null
          total_amount?: number | null
          user_id?: string | null
          valid_until?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          issue_date?: string | null
          quotation_number?: string | null
          status?: string | null
          total_amount?: number | null
          user_id?: string | null
          valid_until?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          created_at: string | null
          customer_id: string
          days_overdue: number | null
          email_error: string | null
          email_sent: boolean | null
          id: string
          invoice_id: string
          reminder_level: Database["public"]["Enums"]["reminder_level"]
          sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          days_overdue?: number | null
          email_error?: string | null
          email_sent?: boolean | null
          id?: string
          invoice_id: string
          reminder_level: Database["public"]["Enums"]["reminder_level"]
          sent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          days_overdue?: number | null
          email_error?: string | null
          email_sent?: boolean | null
          id?: string
          invoice_id?: string
          reminder_level?: Database["public"]["Enums"]["reminder_level"]
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "reminder_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_settings: {
        Row: {
          created_at: string | null
          days_after_due_final: number | null
          days_after_due_first: number | null
          days_after_due_second: number | null
          days_before_due: number | null
          email_reminders_enabled: boolean | null
          id: string
          max_reminders: number | null
          reminder_frequency: string | null
          send_on_due_date: boolean | null
          stop_after_payment: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          days_after_due_final?: number | null
          days_after_due_first?: number | null
          days_after_due_second?: number | null
          days_before_due?: number | null
          email_reminders_enabled?: boolean | null
          id?: string
          max_reminders?: number | null
          reminder_frequency?: string | null
          send_on_due_date?: boolean | null
          stop_after_payment?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          days_after_due_final?: number | null
          days_after_due_first?: number | null
          days_after_due_second?: number | null
          days_before_due?: number | null
          email_reminders_enabled?: boolean | null
          id?: string
          max_reminders?: number | null
          reminder_frequency?: string | null
          send_on_due_date?: boolean | null
          stop_after_payment?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reminder_templates: {
        Row: {
          body: string
          created_at: string | null
          id: string
          is_default: boolean | null
          level: Database["public"]["Enums"]["reminder_level"]
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          level: Database["public"]["Enums"]["reminder_level"]
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          level?: Database["public"]["Enums"]["reminder_level"]
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category: string | null
          created_at: string
          default_price: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          unit: string | null
          updated_at: string
          usage_count: number
          user_id: string
          vat_rate: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_price: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          unit?: string | null
          updated_at?: string
          usage_count?: number
          user_id: string
          vat_rate?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          default_price?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          unit?: string | null
          updated_at?: string
          usage_count?: number
          user_id?: string
          vat_rate?: number
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          currency_position: string | null
          currency_symbol_display: string | null
          customer_communications: boolean | null
          date_format: string | null
          default_view: string | null
          email_reminders: boolean | null
          final_notice_days: number | null
          first_reminder_days: number | null
          id: string
          items_per_page: number | null
          language: string | null
          onboarding_completed: boolean | null
          overdue_alerts: boolean | null
          payment_notifications: boolean | null
          second_reminder_days: number | null
          theme: string | null
          time_format: string | null
          updated_at: string | null
          user_id: string
          weekly_reports: boolean | null
        }
        Insert: {
          created_at?: string | null
          currency_position?: string | null
          currency_symbol_display?: string | null
          customer_communications?: boolean | null
          date_format?: string | null
          default_view?: string | null
          email_reminders?: boolean | null
          final_notice_days?: number | null
          first_reminder_days?: number | null
          id?: string
          items_per_page?: number | null
          language?: string | null
          onboarding_completed?: boolean | null
          overdue_alerts?: boolean | null
          payment_notifications?: boolean | null
          second_reminder_days?: number | null
          theme?: string | null
          time_format?: string | null
          updated_at?: string | null
          user_id: string
          weekly_reports?: boolean | null
        }
        Update: {
          created_at?: string | null
          currency_position?: string | null
          currency_symbol_display?: string | null
          customer_communications?: boolean | null
          date_format?: string | null
          default_view?: string | null
          email_reminders?: boolean | null
          final_notice_days?: number | null
          first_reminder_days?: number | null
          id?: string
          items_per_page?: number | null
          language?: string | null
          onboarding_completed?: boolean | null
          overdue_alerts?: boolean | null
          payment_notifications?: boolean | null
          second_reminder_days?: number | null
          theme?: string | null
          time_format?: string | null
          updated_at?: string | null
          user_id?: string
          weekly_reports?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      invoice_totals: {
        Row: {
          customer_id: string | null
          due_date: string | null
          invoice_created_at: string | null
          invoice_id: string | null
          invoice_number: string | null
          net_amount: number | null
          status: string | null
          total_amount: number | null
          vat_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_credit_note_number: {
        Args: { p_user_id: string }
        Returns: string
      }
      log_invoice_action: {
        Args: {
          p_action: string
          p_invoice_id: string
          p_new_data?: Json
          p_old_data?: Json
        }
        Returns: undefined
      }
      lpad_int: { Args: { n: number; pad: number }; Returns: string }
      next_credit_note_number: {
        Args: { p_business_id: string; p_prefix?: string }
        Returns: string
      }
      next_invoice_number: {
        Args: { p_business_id: string; p_prefix?: string }
        Returns: string
      }
    }
    Enums: {
      reminder_level: "friendly" | "firm" | "final"
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
      reminder_level: ["friendly", "firm", "final"],
    },
  },
} as const
