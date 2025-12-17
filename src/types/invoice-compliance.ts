// Type definitions for Malta VAT compliance features
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

// Extend base invoice type with Malta VAT compliance fields
export type InvoiceWithCompliance = Tables<'invoices'> & {
  invoice_items?: InvoiceItem[];
  customers?: {
    id: string;
    name: string;
    email?: string;
  };
};

// Use generated types where available
export type InvoiceItem = Tables<'invoice_items'>;
export type InvoiceInsert = TablesInsert<'invoices'>;

// Custom types for tables not in generated types
export interface CreditNote {
  id: string;
  credit_note_number: string;
  invoice_id?: string | null;
  user_id: string;
  customer_id: string;
  amount: number;
  vat_rate: number;
  reason: string;
  status: string;
  credit_note_date: string;
  type?: string;
  issued_at?: string | null;
  created_at?: string;
}

export interface CreditNoteItem {
  id?: string;
  credit_note_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit: string;
}

export interface InvoiceAuditLog {
  id?: string;
  invoice_id: string;
  user_id: string;
  action: 'issued' | 'credit_note_created' | 'modified' | 'deleted';
  timestamp?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

// Insert types for custom tables
export type CreditNoteInsert = Omit<CreditNote, 'id' | 'created_at'> & {
  invoice_id?: string | null;
  type?: string;
  issued_at?: string | null;
};
export type CreditNoteItemInsert = Omit<CreditNoteItem, 'id'>;
export type InvoiceAuditLogInsert = Omit<InvoiceAuditLog, 'id' | 'timestamp' | 'ip_address' | 'user_agent'>;

// Keep custom SupabaseError type
export interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

// Type guard for Supabase errors
export function isSupabaseError(error: unknown): error is SupabaseError {
  return typeof error === 'object' && error !== null && 'message' in error;
}
