import {
  FileText,
  CheckCircle,
  CreditCard,
  AlertCircle,
  Shield,
} from "lucide-react";
import type { CreditNote, StatusBadgeConfig } from "./types";

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export const getCreditNoteGrossAmount = (cn: CreditNote): number => {
  return cn.amount * (1 + cn.vat_rate);
};

export const getInvoiceStatusBadge = (status: string, isIssued?: boolean): StatusBadgeConfig => {
  if (status === "paid") {
    return { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle, label: "Paid" };
  }
  if (status === "partially_paid") {
    return { className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: CreditCard, label: "Partially Paid" };
  }
  if (isIssued) {
    return { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Shield, label: "Issued" };
  }
  if (status === "overdue") {
    return { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: AlertCircle, label: "Overdue" };
  }
  return { className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", icon: FileText, label: "Draft" };
};

export const getCreditNoteStatusBadge = (status: string): StatusBadgeConfig => {
  const variants: Record<string, { className: string; label: string }> = {
    draft: { className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", label: "Draft" },
    issued: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Issued" },
    applied: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Applied" },
  };
  return variants[status] || variants.draft;
};

export const getQuotationStatusBadge = (status: string): StatusBadgeConfig => {
  const variants: Record<string, { className: string; label: string }> = {
    draft: { className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", label: "Draft" },
    sent: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Sent" },
    accepted: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Accepted" },
    converted: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Converted" },
    expired: { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Expired" },
  };
  return variants[status] || variants.draft;
};

export const getTypeBadgeClass = (type: "invoice" | "credit_note" | "quotation") => {
  if (type === "invoice") return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
  if (type === "credit_note") return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
  return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
};

export const getTypeLabel = (type: "invoice" | "credit_note" | "quotation") => {
  if (type === "invoice") return "Invoice";
  if (type === "credit_note") return "Credit Note";
  return "Quote";
};

/**
 * Compute outstanding amount for an invoice.
 * outstanding_amount = grand_total - sum(payments)
 * Note: This does NOT subtract credits - credits adjust the invoice, payments settle it.
 */
export const computeOutstandingAmount = (
  grandTotal: number,
  totalPayments: number
): number => {
  return Math.max(0, grandTotal - totalPayments);
};
