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
      activity_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          module: string
          user_id: string
          user_name: string
          user_role: string
        }
        Insert: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          module?: string
          user_id: string
          user_name?: string
          user_role?: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          module?: string
          user_id?: string
          user_name?: string
          user_role?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          attendance_date: string
          cashbon_amount: number
          cashbon_notes: string
          check_in: string | null
          check_out: string | null
          created_at: string | null
          id: string
          late_minutes: number
          late_notes: string
          notes: string | null
          outlet_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendance_date?: string
          cashbon_amount?: number
          cashbon_notes?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          id?: string
          late_minutes?: number
          late_notes?: string
          notes?: string | null
          outlet_id?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendance_date?: string
          cashbon_amount?: number
          cashbon_notes?: string
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          id?: string
          late_minutes?: number
          late_notes?: string
          notes?: string | null
          outlet_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          accuracy_meters: number | null
          created_at: string
          device_info: string | null
          distance_from_outlet_meters: number | null
          id: string
          latitude: number
          log_type: string
          longitude: number
          notes: string | null
          out_of_radius: boolean
          outlet_id: string | null
          selfie_url: string
          shift_name: string
          status_override: string | null
          status_override_at: string | null
          status_override_by: string | null
          status_override_note: string | null
          user_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          created_at?: string
          device_info?: string | null
          distance_from_outlet_meters?: number | null
          id?: string
          latitude: number
          log_type?: string
          longitude: number
          notes?: string | null
          out_of_radius?: boolean
          outlet_id?: string | null
          selfie_url: string
          shift_name?: string
          status_override?: string | null
          status_override_at?: string | null
          status_override_by?: string | null
          status_override_note?: string | null
          user_id: string
        }
        Update: {
          accuracy_meters?: number | null
          created_at?: string
          device_info?: string | null
          distance_from_outlet_meters?: number | null
          id?: string
          latitude?: number
          log_type?: string
          longitude?: number
          notes?: string | null
          out_of_radius?: boolean
          outlet_id?: string | null
          selfie_url?: string
          shift_name?: string
          status_override?: string | null
          status_override_at?: string | null
          status_override_by?: string | null
          status_override_note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_thresholds: {
        Row: {
          check_in_late_after: string
          check_in_start: string
          check_out_earliest: string
          check_out_latest: string
          created_at: string
          early_checkin_minutes: number
          id: string
          outlet_id: string | null
          shift_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          check_in_late_after?: string
          check_in_start?: string
          check_out_earliest?: string
          check_out_latest?: string
          created_at?: string
          early_checkin_minutes?: number
          id?: string
          outlet_id?: string | null
          shift_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          check_in_late_after?: string
          check_in_start?: string
          check_out_earliest?: string
          check_out_latest?: string
          created_at?: string
          early_checkin_minutes?: number
          id?: string
          outlet_id?: string | null
          shift_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_thresholds_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      cashbon: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          request_date: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          approved_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          request_date?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          request_date?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_plans: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string
          description: string | null
          engagement_comments: number | null
          engagement_likes: number | null
          engagement_reach: number | null
          engagement_shares: number | null
          engagement_views: number | null
          id: string
          notes: string | null
          platform: string
          rate_card: number | null
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          engagement_comments?: number | null
          engagement_likes?: number | null
          engagement_reach?: number | null
          engagement_shares?: number | null
          engagement_views?: number | null
          id?: string
          notes?: string | null
          platform?: string
          rate_card?: number | null
          scheduled_date?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          engagement_comments?: number | null
          engagement_likes?: number | null
          engagement_reach?: number | null
          engagement_shares?: number | null
          engagement_views?: number | null
          id?: string
          notes?: string | null
          platform?: string
          rate_card?: number | null
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_sales: {
        Row: {
          created_at: string | null
          id: string
          menu_item_name: string
          outlet_id: string | null
          qty_sold: number
          recorded_by: string
          sale_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          menu_item_name: string
          outlet_id?: string | null
          qty_sold?: number
          recorded_by: string
          sale_date?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          menu_item_name?: string
          outlet_id?: string | null
          qty_sold?: number
          recorded_by?: string
          sale_date?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_items: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          description: string
          id: string
          qty: number | null
          receipt_url: string | null
          report_id: string
          unit_price: number | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          qty?: number | null
          receipt_url?: string | null
          report_id: string
          unit_price?: number | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          qty?: number | null
          receipt_url?: string | null
          report_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "financial_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_daily_reports: {
        Row: {
          cash_on_hand_added: number | null
          created_at: string
          extra_fields: Json | null
          id: string
          notes: string | null
          outlet_id: string | null
          report_date: string
          reporter_name: string | null
          starting_cash: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_on_hand_added?: number | null
          created_at?: string
          extra_fields?: Json | null
          id?: string
          notes?: string | null
          outlet_id?: string | null
          report_date?: string
          reporter_name?: string | null
          starting_cash?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_on_hand_added?: number | null
          created_at?: string
          extra_fields?: Json | null
          id?: string
          notes?: string | null
          outlet_id?: string | null
          report_date?: string
          reporter_name?: string | null
          starting_cash?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_daily_reports_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expense_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          item_name: string
          payment_type: string
          qty: number
          report_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          item_name?: string
          payment_type?: string
          qty?: number
          report_id: string
          subtotal?: number
          unit_price?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          item_name?: string
          payment_type?: string
          qty?: number
          report_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_expense_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "finance_daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_reports: {
        Row: {
          created_at: string | null
          daily_offline_income: number | null
          dine_in_omzet: number | null
          ending_physical_cash: number | null
          ending_qris_cash: number | null
          gofood_sales: number | null
          grabfood_sales: number | null
          id: string
          notes: string | null
          online_delivery_sales: number | null
          outlet_id: string | null
          report_date: string
          reporter_name: string | null
          shift: string | null
          shopeefood_sales: number | null
          starting_cash: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_offline_income?: number | null
          dine_in_omzet?: number | null
          ending_physical_cash?: number | null
          ending_qris_cash?: number | null
          gofood_sales?: number | null
          grabfood_sales?: number | null
          id?: string
          notes?: string | null
          online_delivery_sales?: number | null
          outlet_id?: string | null
          report_date?: string
          reporter_name?: string | null
          shift?: string | null
          shopeefood_sales?: number | null
          starting_cash?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_offline_income?: number | null
          dine_in_omzet?: number | null
          ending_physical_cash?: number | null
          ending_qris_cash?: number | null
          gofood_sales?: number | null
          grabfood_sales?: number | null
          id?: string
          notes?: string | null
          online_delivery_sales?: number | null
          outlet_id?: string | null
          report_date?: string
          reporter_name?: string | null
          shift?: string | null
          shopeefood_sales?: number | null
          starting_cash?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_reports_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          created_at: string | null
          ending_stock: number | null
          id: string
          incoming_stock: number | null
          item_name: string
          minimum_threshold: number | null
          outgoing_stock: number
          outlet_id: string | null
          record_date: string
          starting_stock: number | null
          user_id: string
          waste: number
        }
        Insert: {
          created_at?: string | null
          ending_stock?: number | null
          id?: string
          incoming_stock?: number | null
          item_name: string
          minimum_threshold?: number | null
          outgoing_stock?: number
          outlet_id?: string | null
          record_date?: string
          starting_stock?: number | null
          user_id: string
          waste?: number
        }
        Update: {
          created_at?: string | null
          ending_stock?: number | null
          id?: string
          incoming_stock?: number | null
          item_name?: string
          minimum_threshold?: number | null
          outgoing_stock?: number
          outlet_id?: string | null
          record_date?: string
          starting_stock?: number | null
          user_id?: string
          waste?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          item_name: string
          qty: number
          total: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          item_name: string
          qty?: number
          total?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          item_name?: string
          qty?: number
          total?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invoice_date: string
          invoice_number: string | null
          notes: string | null
          outlet_id: string | null
          paid_at: string | null
          recipient: string | null
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          notes?: string | null
          outlet_id?: string | null
          paid_at?: string | null
          recipient?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          notes?: string | null
          outlet_id?: string | null
          paid_at?: string | null
          recipient?: string | null
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      item_catalog: {
        Row: {
          created_at: string
          default_price: number
          default_qty: number
          id: string
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_price?: number
          default_qty?: number
          id?: string
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_price?: number
          default_qty?: number
          id?: string
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          reason: string
          reviewed_by: string | null
          start_date: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          reason?: string
          reviewed_by?: string | null
          start_date: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          reason?: string
          reviewed_by?: string | null
          start_date?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      note_archives: {
        Row: {
          amount: number
          created_at: string
          file_url: string
          id: string
          note_date: string
          note_name: string
          outlet_id: string | null
          storage_path: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          amount?: number
          created_at?: string
          file_url: string
          id?: string
          note_date?: string
          note_name?: string
          outlet_id?: string | null
          storage_path: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          amount?: number
          created_at?: string
          file_url?: string
          id?: string
          note_date?: string
          note_name?: string
          outlet_id?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_archives_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      outlet_finance_configs: {
        Row: {
          created_at: string
          id: string
          income_fields: Json
          outlet_id: string
          pair_groups: Json
          selisih_formula: string
          selisih_inline_label: string
          summary_groups: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          income_fields?: Json
          outlet_id: string
          pair_groups?: Json
          selisih_formula?: string
          selisih_inline_label?: string
          summary_groups?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          income_fields?: Json
          outlet_id?: string
          pair_groups?: Json
          selisih_formula?: string
          selisih_inline_label?: string
          summary_groups?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlet_finance_configs_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: true
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      outlet_materials: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          minimum_threshold: number
          name: string
          outlet_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          minimum_threshold?: number
          name: string
          outlet_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          minimum_threshold?: number
          name?: string
          outlet_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outlet_materials_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      outlets: {
        Row: {
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          radius_meters: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          radius_meters?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          radius_meters?: number | null
        }
        Relationships: []
      }
      password_reset_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string
          handled_at: string | null
          handled_by: string | null
          id: string
          link_expires_at: string | null
          message: string
          reset_link: string | null
          resolution_notes: string
          status: string
          token_hash: string | null
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          link_expires_at?: string | null
          message?: string
          reset_link?: string | null
          resolution_notes?: string
          status?: string
          token_hash?: string | null
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          link_expires_at?: string | null
          message?: string
          reset_link?: string | null
          resolution_notes?: string
          status?: string
          token_hash?: string | null
          updated_at?: string
          used_at?: string | null
        }
        Relationships: []
      }
      payroll: {
        Row: {
          absence_deduction: number | null
          base_salary: number
          cashbon_deduction: number | null
          created_at: string | null
          id: string
          meal_allowance: number | null
          net_salary: number | null
          notes: string | null
          other_allowance: number | null
          other_deduction: number | null
          period_month: number
          period_year: number
          punishment_deduction: number | null
          status: string | null
          transport_allowance: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          absence_deduction?: number | null
          base_salary?: number
          cashbon_deduction?: number | null
          created_at?: string | null
          id?: string
          meal_allowance?: number | null
          net_salary?: number | null
          notes?: string | null
          other_allowance?: number | null
          other_deduction?: number | null
          period_month: number
          period_year: number
          punishment_deduction?: number | null
          status?: string | null
          transport_allowance?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          absence_deduction?: number | null
          base_salary?: number
          cashbon_deduction?: number | null
          created_at?: string | null
          id?: string
          meal_allowance?: number | null
          net_salary?: number | null
          notes?: string | null
          other_allowance?: number | null
          other_deduction?: number | null
          period_month?: number
          period_year?: number
          punishment_deduction?: number | null
          status?: string | null
          transport_allowance?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      performance_reviews: {
        Row: {
          categories: Json | null
          created_at: string | null
          id: string
          notes: string | null
          review_period: string
          reviewer_id: string
          score: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          categories?: Json | null
          created_at?: string | null
          id?: string
          notes?: string | null
          review_period: string
          reviewer_id: string
          score?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          categories?: Json | null
          created_at?: string | null
          id?: string
          notes?: string | null
          review_period?: string
          reviewer_id?: string
          score?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          base_salary: number | null
          contract_end_date: string | null
          created_at: string | null
          date_of_birth: string | null
          discipline_points: number | null
          employment_status: string | null
          full_name: string
          id: string
          job_title: string | null
          join_date: string | null
          meal_allowance: number | null
          nickname: string | null
          nik: string | null
          outlet_id: string | null
          phone: string | null
          transport_allowance: number | null
          updated_at: string | null
          user_id: string
          warning_letter_status: string | null
        }
        Insert: {
          address?: string | null
          base_salary?: number | null
          contract_end_date?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          discipline_points?: number | null
          employment_status?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          join_date?: string | null
          meal_allowance?: number | null
          nickname?: string | null
          nik?: string | null
          outlet_id?: string | null
          phone?: string | null
          transport_allowance?: number | null
          updated_at?: string | null
          user_id: string
          warning_letter_status?: string | null
        }
        Update: {
          address?: string | null
          base_salary?: number | null
          contract_end_date?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          discipline_points?: number | null
          employment_status?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          join_date?: string | null
          meal_allowance?: number | null
          nickname?: string | null
          nik?: string | null
          outlet_id?: string | null
          phone?: string | null
          transport_allowance?: number | null
          updated_at?: string | null
          user_id?: string
          warning_letter_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_outlet_id_fkey"
            columns: ["outlet_id"]
            isOneToOne: false
            referencedRelation: "outlets"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_loss_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      punishments: {
        Row: {
          created_at: string | null
          id: string
          issued_by: string | null
          issued_date: string
          new_sp_status: string | null
          points_added: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          issued_by?: string | null
          issued_date?: string
          new_sp_status?: string | null
          points_added?: number
          reason?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          issued_by?: string | null
          issued_date?: string
          new_sp_status?: string | null
          points_added?: number
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          created_at: string | null
          id: string
          ingredients: Json
          menu_item_name: string
          notes: string | null
          outlet_id: string | null
          portions: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ingredients?: Json
          menu_item_name: string
          notes?: string | null
          outlet_id?: string | null
          portions?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ingredients?: Json
          menu_item_name?: string
          notes?: string | null
          outlet_id?: string | null
          portions?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      role_menu_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          enabled: boolean
          id: string
          menu_key: string
          role: Database["public"]["Enums"]["app_role"] | null
          role_code: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          enabled?: boolean
          id?: string
          menu_key: string
          role?: Database["public"]["Enums"]["app_role"] | null
          role_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          enabled?: boolean
          id?: string
          menu_key?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          role_code?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sp_history: {
        Row: {
          created_at: string
          id: string
          issued_by: string | null
          issued_date: string
          printed_at: string | null
          reason: string
          sp_level: string
          total_points: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_by?: string | null
          issued_date?: string
          printed_at?: string | null
          reason?: string
          sp_level: string
          total_points?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_by?: string | null
          issued_date?: string
          printed_at?: string | null
          reason?: string
          sp_level?: string
          total_points?: number
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
          role?: Database["public"]["Enums"]["app_role"]
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
      get_user_outlet: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      pic_can_access_outlet: { Args: { _outlet_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "staff" | "management" | "pic" | "crew" | "stockman" | "admin"
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
      app_role: ["staff", "management", "pic", "crew", "stockman", "admin"],
    },
  },
} as const
