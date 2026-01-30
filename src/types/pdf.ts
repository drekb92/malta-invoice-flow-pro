/**
 * PDF Document Types
 * 
 * These interfaces are used for PDF generation via the Edge HTML engine.
 * @see src/lib/edgePdf.ts for the PDF generation pipeline
 */

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  documentType?: "INVOICE" | "CREDIT NOTE" | "QUOTATION";
  customer: {
    name: string;
    email?: string;
    address?: string;
    address_line1?: string;
    address_line2?: string;
    locality?: string;
    post_code?: string;
    vat_number?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    unit?: string;
  }>;
  totals: {
    netTotal: number;
    vatTotal: number;
    grandTotal: number;
  };
}
