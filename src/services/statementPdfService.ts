import jsPDF from "jspdf";
import { formatNumber } from "@/lib/utils";
import { format } from "date-fns";

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
  original_invoice_id?: string | null;
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
    // Company info (left side)
    this.setColor(this.primaryColor);
    this.pdf.setFontSize(16);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.text(data.company.name || "Your Company", this.margin, this.currentY);

    this.currentY += 6;
    this.pdf.setTextColor(100, 100, 100);
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
    if (data.company.email) {
      this.pdf.text(data.company.email, this.margin, this.currentY);
      this.currentY += 4;
    }
    if (data.company.vat_number) {
      this.pdf.text(`VAT: ${data.company.vat_number}`, this.margin, this.currentY);
      this.currentY += 4;
    }

    // Statement title (right side)
    const titleY = 20;
    this.setColor(this.primaryColor);
    this.pdf.setFontSize(24);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.text("STATEMENT", this.pageWidth - this.margin, titleY, { align: "right" });

    this.pdf.setFontSize(10);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.setTextColor(100, 100, 100);
    this.pdf.text(
      `Date: ${format(data.generatedAt, "dd/MM/yyyy")}`,
      this.pageWidth - this.margin,
      titleY + 8,
      { align: "right" }
    );
    this.pdf.text(
      `Period: ${format(data.options.dateFrom, "dd/MM/yyyy")} - ${format(data.options.dateTo, "dd/MM/yyyy")}`,
      this.pageWidth - this.margin,
      titleY + 14,
      { align: "right" }
    );

    const typeLabel = data.options.statementType === "outstanding" ? "Outstanding Only" : "Activity Statement";
    this.pdf.text(`Type: ${typeLabel}`, this.pageWidth - this.margin, titleY + 20, { align: "right" });

    this.currentY = Math.max(this.currentY, titleY + 30) + 10;
  }

  private addCustomerInfo(data: StatementData) {
    // Customer box
    this.setFillColor("#f8fafc");
    this.pdf.rect(this.margin, this.currentY, this.pageWidth - this.margin * 2, 25, "F");

    this.currentY += 6;
    this.setColor(this.accentColor);
    this.pdf.setFontSize(10);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.text("Statement For:", this.margin + 4, this.currentY);

    this.currentY += 5;
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFontSize(11);
    this.pdf.text(data.customer.name, this.margin + 4, this.currentY);

    this.currentY += 5;
    this.pdf.setFontSize(9);
    this.pdf.setFont("helvetica", "normal");
    if (data.customer.address) {
      this.pdf.text(data.customer.address, this.margin + 4, this.currentY);
      this.currentY += 4;
    }
    if (data.customer.vat_number) {
      this.pdf.text(`VAT: ${data.customer.vat_number}`, this.margin + 4, this.currentY);
    }

    this.currentY += 15;
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
        if (cn.original_invoice_id) {
          const totalAmount = cn.amount + cn.amount * cn.vat_rate;
          const current = creditsByInvoice.get(cn.original_invoice_id) || 0;
          creditsByInvoice.set(cn.original_invoice_id, current + totalAmount);
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
      this.pdf.text(`€${formatNumber(inv.total_amount, 2)}`, currentX, this.currentY + 5);
      currentX += colWidths[3];
      this.pdf.text(`€${formatNumber(paidAmount + creditsAmount, 2)}`, currentX, this.currentY + 5);
      currentX += colWidths[4];

      // Remaining in red
      this.pdf.setTextColor(220, 38, 38);
      this.pdf.text(`€${formatNumber(remaining, 2)}`, currentX, this.currentY + 5);
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

      this.pdf.text(txn.debit > 0 ? `€${formatNumber(txn.debit, 2)}` : "", currentX, this.currentY + 5);
      currentX += colWidths[3];

      this.pdf.text(txn.credit > 0 ? `€${formatNumber(txn.credit, 2)}` : "", currentX, this.currentY + 5);
      currentX += colWidths[4];

      // Color and format balance based on amount
      if (runningBalance > 0) {
        this.pdf.setTextColor(220, 38, 38); // Red for owing
        this.pdf.text(`€${formatNumber(runningBalance, 2)}`, currentX, this.currentY + 5);
      } else if (runningBalance < 0) {
        this.pdf.setTextColor(22, 163, 74); // Green for credit
        this.pdf.text(`(€${formatNumber(Math.abs(runningBalance), 2)})`, currentX, this.currentY + 5);
      } else {
        this.pdf.setTextColor(100, 100, 100); // Grey for zero
        this.pdf.text(`€0.00`, currentX, this.currentY + 5);
      }
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
        this.pdf.text(`€${formatNumber(totalOutstanding, 2)}`, summaryX + 30, this.currentY + 2, { align: "right" });
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
    this.pdf.text(`€${formatNumber(totalInvoiced, 2)}`, summaryX + 30, this.currentY + 5, { align: "right" });

    this.currentY += 6;
    this.pdf.text("Total Credits:", labelX, this.currentY + 5);
    this.pdf.text(`-€${formatNumber(totalCreditNotes, 2)}`, summaryX + 30, this.currentY + 5, { align: "right" });

    this.currentY += 6;
    this.pdf.text("Total Payments:", labelX, this.currentY + 5);
    this.pdf.text(`-€${formatNumber(totalPayments, 2)}`, summaryX + 30, this.currentY + 5, { align: "right" });

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
      this.pdf.text(`€${formatNumber(finalBalance, 2)}`, summaryX + 30, this.currentY + 2, { align: "right" });
    } else if (finalBalance < 0) {
      // Customer has credit
      this.setColor("#16a34a"); // Green
      this.pdf.text("Credit Balance:", labelX, this.currentY + 2);
      this.pdf.text(`€${formatNumber(Math.abs(finalBalance), 2)}`, summaryX + 30, this.currentY + 2, { align: "right" });
      
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
    this.pdf.text(`Net Total: €${formatNumber(totalNet, 2)}`, this.margin, this.currentY);
    this.currentY += 5;
    this.pdf.text(`VAT Total: €${formatNumber(totalVat, 2)}`, this.margin, this.currentY);
    this.currentY += 5;
    this.pdf.text(`Gross Total: €${formatNumber(totalNet + totalVat, 2)}`, this.margin, this.currentY);

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
