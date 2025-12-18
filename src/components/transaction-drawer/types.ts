import type { LucideIcon } from "lucide-react";

export type TransactionType = "invoice" | "credit_note" | "quotation";

export interface BaseTransaction {
  id: string;
  status: string;
}

export interface InvoiceTransaction extends BaseTransaction {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  amount?: number;
  vat_amount?: number;
  is_issued: boolean;
  customer_id?: string;
}

export interface CreditNoteTransaction extends BaseTransaction {
  credit_note_number: string;
  credit_note_date: string;
  amount: number;
  vat_rate: number;
  reason: string;
  invoice_id?: string;
  customer_id?: string;
}

export interface QuotationTransaction extends BaseTransaction {
  quotation_number: string;
  issue_date: string;
  valid_until: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  customer_id?: string;
}

export type Transaction = InvoiceTransaction | CreditNoteTransaction | QuotationTransaction;

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit: string | null;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  locality: string | null;
  post_code: string | null;
  vat_number: string | null;
}

export interface CreditNote {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  amount: number;
  vat_rate: number;
  reason: string;
}

export interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  method: string | null;
}

export interface TimelineEvent {
  id: string;
  type: "created" | "issued" | "sent" | "accepted" | "converted" | "credit_note" | "payment" | "paid";
  date: string;
  title: string;
  amount?: number;
}

export interface StatusBadgeConfig {
  className: string;
  label: string;
  icon?: LucideIcon;
}
