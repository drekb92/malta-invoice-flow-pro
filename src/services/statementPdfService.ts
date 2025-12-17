/**
 * @deprecated LEGACY jsPDF STATEMENT SERVICE - DO NOT USE FOR PRODUCTION
 * 
 * This jsPDF-based statement generator is deprecated for production use.
 * For production statement exports, use the Edge HTML engine via:
 * 
 * ```typescript
 * import { downloadPdfFromFunction } from "@/lib/edgePdf";
 * import { UnifiedStatementLayout } from "@/components/UnifiedStatementLayout";
 * ```
 * 
 * This file is kept for dev/testing purposes only.
 * Statement PDF generation in production uses UnifiedStatementLayout
 * rendered to HTML and converted via the Edge Function.
 */

import jsPDF from "jspdf";
import { format } from "date-fns";

// Format currency with thousands separators: €X,XXX.XX
const formatCurrencyAmount = (amount: number): string => {
  return amount.toLocaleString('en-IE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

// Format debit amount (positive, no sign): €1,180.00
const formatDebit = (amount: number): string => {
  if (amount <= 0) return "";
  return `€${formatCurrencyAmount(amount)}`;
};

// Format credit amount in parentheses: (€1,180.00)
const formatCredit = (amount: number): string => {
  if (amount <= 0) return "";
  return `(€${formatCurrencyAmount(amount)})`;
};

// Format balance: positive €1,180.00, negative (€1,180.00)
const formatBalance = (amount: number): string => {
  if (amount === 0) return "€0.00";
  if (amount > 0) return `€${formatCurrencyAmount(amount)}`;
  return `(€${formatCurrencyAmount(Math.abs(amount))})`;
};

export interface StatementOptions {
  dateFrom: Date;
  dateTo: Date;
  statementType: "outstanding" | "activity";
  includeCreditNotes: boolean;
  includeVatBreakdown: boolean;
}

export interface StatementCustomer {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  vat_number: string | null;
}

export interface StatementInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  amount: number;
  vat_amount: number;
  paid_amount?: number; // Total payments against this invoice
}

export interface StatementCreditNote {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  amount: number;
  vat_rate: number;
  reason: string;
  invoice_id?: string | null;
}

export interface StatementPayment {
  id: string;
  payment_date: string;
  amount: number;
  method: string | null;
  invoice_id: string;
}

export interface CompanyInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  vat_number?: string;
  logo?: string;
}

export interface StatementData {
  customer: StatementCustomer;
  invoices: StatementInvoice[];
  creditNotes: StatementCreditNote[];
  payments: StatementPayment[];
  company: CompanyInfo;
  options: StatementOptions;
  generatedAt: Date;
}

export class StatementPDFGenerator {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private currentY: number = 20;
  private primaryColor = "#1a365d";
  private accentColor = "#2563eb";

  constructor() {
    this.pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    this.pageWidth = this.pdf.internal.pageSize.getWidth();
    this.pageHeight = this.pdf.internal.pageSize.getHeight();
  }

  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 0, 0];
  }

  private setColor(color: string) {
    const [r, g, b] = this.hexToRgb(color);
    this.pdf.setTextColor(r, g, b);
  }

  private setFillColor(color: string) {
    const [r, g, b] = this.hexToRgb(color);
    this.pdf.setFillColor(r, g, b);
  }

  private checkPageBreak(requiredSpace: number = 30) {
    if (this.currentY + requiredSpace > this.pageHeight - 20) {
      this.pdf.addPage();
      this.currentY = 20;
    }
  }

  private addHeader(data: StatementData) {
    const rightX = this.pageWidth - this.margin;
    const leftStartY = this.currentY;

    // --- LEFT SIDE: Company info with logo placeholder ---
    // Company name (prominent)
    this.setColor(this.primaryColor);
    this.pdf.setFontSize(18);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.text(data.company.name || "Your Company", this.margin, this.currentY);

    this.currentY += 7;
    this.pdf.setTextColor(80, 80, 80);
    this.pdf.setFontSize(9);
    this.pdf.setFont("helvetica", "normal");

    if (data.company.address) {
      this.pdf.text(data.company.address, this.margin, this.currentY);
      this.currentY += 4;
    }
    if (data.company.city || data.company.country) {
      this.pdf.text(
        [data.company.city, data.company.country].filter(Boolean).join(", "),
        this.margin,
        this.currentY
      );
      this.currentY += 4;
    }
    if (data.company.phone) {
      this.pdf.text(`Tel: ${data.company.phone}`, this.margin, this.currentY);
      this.currentY += 4;
    }
    if (data.company.email) {
      this.pdf.text(data.company.email, this.margin, this.currentY);
      this.currentY += 4;
    }
    if (data.company.vat_number) {
      this.pdf.text(`VAT: ${data.company.vat_number}`, this.margin, this.currentY);
      this.currentY += 4;
    }

    const leftEndY = this.currentY;

    // --- RIGHT SIDE: Statement title and details ---
    const typeLabel = data.options.statementType === "outstanding" 
      ? "OUTSTANDING STATEMENT" 
      : "ACTIVITY STATEMENT";

    this.setColor(this.primaryColor);
    this.pdf.setFontSize(20);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.text(typeLabel, rightX, leftStartY, { align: "right" });

    this.pdf.setFontSize(10);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setTextColor(80, 80, 80);

    let rightY = leftStartY + 10;
    this.pdf.text(`Statement Date: ${format(data.generatedAt, "dd/MM/yyyy")}`, rightX, rightY, { align: "right" });

    rightY += 6;
    this.pdf.text(`Period: ${format(data.options.dateFrom, "dd/MM/yyyy")} → ${format(data.options.dateTo, "dd/MM/yyyy")}`, rightX, rightY, { align: "right" });

    // Move to below both columns
    this.currentY = Math.max(leftEndY, rightY + 8) + 8;

    // --- Thin divider line ---
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;
  }

  private addCustomerInfo(data: StatementData) {
    // Customer "Bill To" section (matching invoice style)
    this.setColor(this.accentColor);
    this.pdf.setFontSize(11);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.text("Statement For:", this.margin, this.currentY);

    this.currentY += 6;
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFontSize(11);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.text(data.customer.name, this.margin, this.currentY);

    this.currentY += 5;
    this.pdf.setFontSize(9);

    if (data.customer.address) {
      // Handle multi-line addresses
      const addressLines = data.customer.address.split("\n");
      addressLines.forEach((line) => {
        this.pdf.text(line.trim(), this.margin, this.currentY);
        this.currentY += 4;
      });
    }

    if (data.customer.vat_number) {
      this.currentY += 1;
      this.pdf.text(`VAT Number: ${data.customer.vat_number}`, this.margin, this.currentY);
      this.currentY += 4;
    }

    this.currentY += 8;
  }

  private addOutstandingTable(data: StatementData): number {
    const tableWidth = this.pageWidth - this.margin * 2;
    const colWidths = [35, 28, 28, 28, 28, 28]; // Invoice #, Date, Due Date, Amount, Paid, Remaining
    const rowHeight = 7;

    // Table header
    this.setFillColor(this.primaryColor);
    this.pdf.rect(this.margin, this.currentY, tableWidth, rowHeight + 1, "F");

    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(8);
    this.pdf.setFont("helvetica", "bold");

    let currentX = this.margin + 2;
    this.pdf.text("Invoice #", currentX, this.currentY + 5);
    currentX += colWidths[0];
    this.pdf.text("Date", currentX, this.currentY + 5);
    currentX += colWidths[1];
    this.pdf.text("Due Date", currentX, this.currentY + 5);
    currentX += colWidths[2];
    this.pdf.text("Amount", currentX, this.currentY + 5);
    currentX += colWidths[3];
    this.pdf.text("Paid", currentX, this.currentY + 5);
    currentX += colWidths[4];
    this.pdf.text("Remaining", currentX, this.currentY + 5);

    this.currentY += rowHeight + 1;

    // Calculate payments per invoice
    const paymentsByInvoice = new Map<string, number>();
    data.payments.forEach((pmt) => {
      const current = paymentsByInvoice.get(pmt.invoice_id) || 0;
      paymentsByInvoice.set(pmt.invoice_id, current + pmt.amount);
    });

    // Calculate credits per invoice
    const creditsByInvoice = new Map<string, number>();
    if (data.options.includeCreditNotes) {
      data.creditNotes.forEach((cn) => {
        if (cn.invoice_id) {
          const totalAmount = cn.amount + cn.amount * cn.vat_rate;
          const current = creditsByInvoice.get(cn.invoice_id) || 0;
          creditsByInvoice.set(cn.invoice_id, current + totalAmount);
        }
      });
    }

    // Filter to only outstanding invoices
    const outstandingInvoices = data.invoices.filter((inv) => {
      const paid = paymentsByInvoice.get(inv.id) || 0;
      const credits = creditsByInvoice.get(inv.id) || 0;
      const remaining = inv.total_amount - paid - credits;
      return remaining > 0.01; // Small threshold for floating point
    });

    // Draw rows
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8);

    let totalRemaining = 0;

    outstandingInvoices.forEach((inv, index) => {
      this.checkPageBreak(rowHeight + 5);

      const isEven = index % 2 === 0;
      if (isEven) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, this.currentY, tableWidth, rowHeight, "F");
      }

      const paidAmount = paymentsByInvoice.get(inv.id) || 0;
      const creditsAmount = creditsByInvoice.get(inv.id) || 0;
      const remaining = inv.total_amount - paidAmount - creditsAmount;
      totalRemaining += remaining;

      currentX = this.margin + 2;
      this.pdf.text(inv.invoice_number, currentX, this.currentY + 5);
      currentX += colWidths[0];
      this.pdf.text(format(new Date(inv.invoice_date), "dd/MM/yyyy"), currentX, this.currentY + 5);
      currentX += colWidths[1];
      this.pdf.text(format(new Date(inv.due_date), "dd/MM/yyyy"), currentX, this.currentY + 5);
      currentX += colWidths[2];
      this.pdf.text(`€${formatCurrencyAmount(inv.total_amount)}`, currentX, this.currentY + 5);
      currentX += colWidths[3];
      this.pdf.text(`€${formatCurrencyAmount(paidAmount + creditsAmount)}`, currentX, this.currentY + 5);
      currentX += colWidths[4];

      // Remaining in red
      this.pdf.setTextColor(220, 38, 38);
      this.pdf.text(`€${formatCurrencyAmount(remaining)}`, currentX, this.currentY + 5);
      this.pdf.setTextColor(0, 0, 0);

      this.currentY += rowHeight;
    });

    // Table border
    if (outstandingInvoices.length > 0) {
      this.pdf.setDrawColor(200, 200, 200);
      this.pdf.rect(this.margin, this.currentY - outstandingInvoices.length * rowHeight - rowHeight - 1, tableWidth, outstandingInvoices.length * rowHeight + rowHeight + 1);
    } else {
      // No outstanding invoices
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(100, 100, 100);
      this.pdf.text("No outstanding invoices for this period.", this.margin, this.currentY + 5);
      this.currentY += 10;
    }

    this.currentY += 10;

    return totalRemaining;
  }

  private addActivityTable(data: StatementData): number {
    const tableWidth = this.pageWidth - this.margin * 2;
    const colWidths = [28, 55, 22, 28, 28, 28]; // Date, Description, Type, Debit, Credit, Balance
    const rowHeight = 7;

    // Table header
    this.setFillColor(this.primaryColor);
    this.pdf.rect(this.margin, this.currentY, tableWidth, rowHeight + 1, "F");

    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(8);
    this.pdf.setFont("helvetica", "bold");

    let currentX = this.margin + 2;
    this.pdf.text("Date", currentX, this.currentY + 5);
    currentX += colWidths[0];
    this.pdf.text("Description", currentX, this.currentY + 5);
    currentX += colWidths[1];
    this.pdf.text("Type", currentX, this.currentY + 5);
    currentX += colWidths[2];
    this.pdf.text("Debit", currentX, this.currentY + 5);
    currentX += colWidths[3];
    this.pdf.text("Credit", currentX, this.currentY + 5);
    currentX += colWidths[4];
    this.pdf.text("Balance", currentX, this.currentY + 5);

    this.currentY += rowHeight + 1;

    // Collect all transactions and sort by date
    interface Transaction {
      date: Date;
      description: string;
      type: string;
      debit: number;
      credit: number;
    }

    const transactions: Transaction[] = [];

    // Add invoices (debits - increase balance)
    data.invoices.forEach((inv) => {
      transactions.push({
        date: new Date(inv.invoice_date),
        description: `Invoice ${inv.invoice_number}`,
        type: "INV",
        debit: inv.total_amount,
        credit: 0,
      });
    });

    // Add credit notes (credits - decrease balance)
    if (data.options.includeCreditNotes) {
      data.creditNotes.forEach((cn) => {
        const totalAmount = cn.amount + cn.amount * cn.vat_rate;
        transactions.push({
          date: new Date(cn.credit_note_date),
          description: `Credit Note ${cn.credit_note_number}`,
          type: "CN",
          debit: 0,
          credit: totalAmount,
        });
      });
    }

    // Add payments (credits - decrease balance)
    data.payments.forEach((pmt) => {
      transactions.push({
        date: new Date(pmt.payment_date),
        description: `Payment${pmt.method ? ` (${pmt.method})` : ""}`,
        type: "PMT",
        debit: 0,
        credit: pmt.amount,
      });
    });

    // Sort by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Draw rows
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setFontSize(8);

    let runningBalance = 0;

    transactions.forEach((txn, index) => {
      this.checkPageBreak(rowHeight + 5);

      const isEven = index % 2 === 0;
      if (isEven) {
        this.pdf.setFillColor(248, 250, 252);
        this.pdf.rect(this.margin, this.currentY, tableWidth, rowHeight, "F");
      }

      // Apply transaction: invoices add, credits/payments subtract
      runningBalance += txn.debit - txn.credit;

      currentX = this.margin + 2;
      this.pdf.text(format(txn.date, "dd/MM/yyyy"), currentX, this.currentY + 5);
      currentX += colWidths[0];

      // Truncate description if too long
      const maxDescLength = 35;
      const desc = txn.description.length > maxDescLength 
        ? txn.description.substring(0, maxDescLength - 2) + "..." 
        : txn.description;
      this.pdf.text(desc, currentX, this.currentY + 5);
      currentX += colWidths[1];

      this.pdf.text(txn.type, currentX, this.currentY + 5);
      currentX += colWidths[2];

      // Debit column - positive amount, no sign
      this.pdf.text(formatDebit(txn.debit), currentX, this.currentY + 5);
      currentX += colWidths[3];

      // Credit column - shown in parentheses
      this.pdf.text(formatCredit(txn.credit), currentX, this.currentY + 5);
      currentX += colWidths[4];

      // Balance column - color and format based on amount
      if (runningBalance > 0) {
        this.pdf.setTextColor(220, 38, 38); // Red for owing
      } else if (runningBalance < 0) {
        this.pdf.setTextColor(22, 163, 74); // Green for credit
      } else {
        this.pdf.setTextColor(100, 100, 100); // Grey for zero
      }
      this.pdf.text(formatBalance(runningBalance), currentX, this.currentY + 5);
      this.pdf.setTextColor(0, 0, 0);

      this.currentY += rowHeight;
    });

    // Table border
    if (transactions.length > 0) {
      this.pdf.setDrawColor(200, 200, 200);
      this.pdf.rect(this.margin, this.currentY - transactions.length * rowHeight - rowHeight - 1, tableWidth, transactions.length * rowHeight + rowHeight + 1);
    } else {
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(100, 100, 100);
      this.pdf.text("No transactions found for this period.", this.margin, this.currentY + 5);
      this.currentY += 10;
    }

    this.currentY += 10;

    return runningBalance;
  }

  private addTransactionsTable(data: StatementData): number {
    if (data.options.statementType === "outstanding") {
      return this.addOutstandingTable(data);
    } else {
      return this.addActivityTable(data);
    }
  }

  private addSummary(data: StatementData, finalBalance: number) {
    this.checkPageBreak(60);

    const summaryX = this.pageWidth - this.margin - 80;
    const labelX = summaryX - 30;

    // For outstanding statements, use a simpler summary
    if (data.options.statementType === "outstanding") {
      // Calculate total outstanding from invoices
      const totalOutstanding = data.invoices.reduce((sum, inv) => {
        const remaining = inv.total_amount - (inv.paid_amount || 0);
        return sum + remaining;
      }, 0);

      const openInvoiceCount = data.invoices.filter((inv) => {
        const remaining = inv.total_amount - (inv.paid_amount || 0);
        return remaining > 0.01;
      }).length;

      const boxHeight = 25;
      this.setFillColor("#f8fafc");
      this.pdf.rect(labelX - 5, this.currentY - 2, 115, boxHeight, "F");

      this.pdf.setFontSize(9);
      this.pdf.setFont("helvetica", "normal");
      this.pdf.setTextColor(100, 100, 100);

      this.pdf.text("Open Invoices:", labelX, this.currentY + 5);
      this.pdf.text(`${openInvoiceCount}`, summaryX + 30, this.currentY + 5, { align: "right" });

      this.currentY += 8;
      this.pdf.setDrawColor(100, 100, 100);
      this.pdf.line(labelX, this.currentY, summaryX + 35, this.currentY);

      this.currentY += 6;
      this.pdf.setFontSize(12);
      this.pdf.setFont("helvetica", "bold");

      if (totalOutstanding > 0) {
        this.setColor("#dc2626"); // Red
        this.pdf.text("Balance Due:", labelX, this.currentY + 2);
        this.pdf.text(`€${formatCurrencyAmount(totalOutstanding)}`, summaryX + 30, this.currentY + 2, { align: "right" });
      } else {
        this.pdf.setTextColor(100, 100, 100); // Grey
        this.pdf.setFont("helvetica", "normal");
        this.pdf.text("No balance due", labelX, this.currentY + 2);
      }

      this.currentY += 15;
      return;
    }

    // Activity statement - full summary
    const totalInvoiced = data.invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const totalCreditNotes = data.options.includeCreditNotes
      ? data.creditNotes.reduce((sum, cn) => sum + cn.amount + cn.amount * cn.vat_rate, 0)
      : 0;
    const totalPayments = data.payments.reduce((sum, pmt) => sum + pmt.amount, 0);

    // Summary box - adjust height based on whether we need the credit note
    const boxHeight = finalBalance < 0 ? 50 : 40;
    this.setFillColor("#f8fafc");
    this.pdf.rect(labelX - 5, this.currentY - 2, 115, boxHeight, "F");

    this.pdf.setFontSize(9);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setTextColor(100, 100, 100);

    this.pdf.text("Total Invoiced:", labelX, this.currentY + 5);
    this.pdf.text(`€${formatCurrencyAmount(totalInvoiced)}`, summaryX + 30, this.currentY + 5, { align: "right" });

    this.currentY += 6;
    this.pdf.text("Total Credits:", labelX, this.currentY + 5);
    this.pdf.text(formatCredit(totalCreditNotes), summaryX + 30, this.currentY + 5, { align: "right" });

    this.currentY += 6;
    this.pdf.text("Total Payments:", labelX, this.currentY + 5);
    this.pdf.text(formatCredit(totalPayments), summaryX + 30, this.currentY + 5, { align: "right" });

    this.currentY += 8;
    this.pdf.setDrawColor(100, 100, 100);
    this.pdf.line(labelX, this.currentY, summaryX + 35, this.currentY);

    this.currentY += 6;
    this.pdf.setFontSize(12);
    this.pdf.setFont("helvetica", "bold");

    // Display final balance with correct labeling
    if (finalBalance > 0) {
      // Customer owes money
      this.setColor("#dc2626"); // Red
      this.pdf.text("Balance Due:", labelX, this.currentY + 2);
      this.pdf.text(`€${formatCurrencyAmount(finalBalance)}`, summaryX + 30, this.currentY + 2, { align: "right" });
    } else if (finalBalance < 0) {
      // Customer has credit
      this.setColor("#16a34a"); // Green
      this.pdf.text("Credit Balance:", labelX, this.currentY + 2);
      this.pdf.text(`€${formatCurrencyAmount(Math.abs(finalBalance))}`, summaryX + 30, this.currentY + 2, { align: "right" });
      
      // Add credit note
      this.currentY += 8;
      this.pdf.setFontSize(8);
      this.pdf.setFont("helvetica", "italic");
      this.pdf.text("This is a credit balance in your favour.", labelX, this.currentY + 2);
    } else {
      // No balance due
      this.pdf.setTextColor(100, 100, 100); // Neutral grey
      this.pdf.text("Balance:", labelX, this.currentY + 2);
      this.pdf.text("No balance due", summaryX + 30, this.currentY + 2, { align: "right" });
    }

    this.currentY += 15;
  }

  private addVatBreakdown(data: StatementData) {
    if (!data.options.includeVatBreakdown) return;

    this.checkPageBreak(40);

    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFontSize(10);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.text("VAT Summary", this.margin, this.currentY);

    this.currentY += 6;

    // Calculate VAT totals from invoices
    const totalNet = data.invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalVat = data.invoices.reduce((sum, inv) => sum + (inv.vat_amount || 0), 0);

    this.pdf.setFontSize(9);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.text(`Net Total: €${formatCurrencyAmount(totalNet)}`, this.margin, this.currentY);
    this.currentY += 5;
    this.pdf.text(`VAT Total: €${formatCurrencyAmount(totalVat)}`, this.margin, this.currentY);
    this.currentY += 5;
    this.pdf.text(`Gross Total: €${formatCurrencyAmount(totalNet + totalVat)}`, this.margin, this.currentY);

    this.currentY += 10;
  }

  private addFooter() {
    const footerY = this.pageHeight - 15;
    this.pdf.setTextColor(150, 150, 150);
    this.pdf.setFontSize(8);
    this.pdf.text(
      "This statement is for your records. Please contact us if you have any questions.",
      this.margin,
      footerY
    );
    this.pdf.text(
      `Generated on ${format(new Date(), "dd/MM/yyyy 'at' HH:mm")}`,
      this.pageWidth - this.margin,
      footerY,
      { align: "right" }
    );
  }

  public generatePDF(data: StatementData): jsPDF {
    this.addHeader(data);
    this.addCustomerInfo(data);
    const balance = this.addTransactionsTable(data);
    this.addSummary(data, balance);
    this.addVatBreakdown(data);
    this.addFooter();

    return this.pdf;
  }
}

export const generateStatementPDF = async (
  data: StatementData,
  filename: string
): Promise<void> => {
  try {
    const generator = new StatementPDFGenerator();
    const pdf = generator.generatePDF(data);
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error("Error generating statement PDF:", error);
    throw new Error(
      `Failed to generate statement PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

export const getStatementPDFBlob = async (data: StatementData): Promise<Blob> => {
  try {
    const generator = new StatementPDFGenerator();
    const pdf = generator.generatePDF(data);
    return pdf.output("blob");
  } catch (error) {
    console.error("Error generating statement PDF blob:", error);
    throw new Error(
      `Failed to generate statement PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};
