/**
 * @deprecated LEGACY jsPDF SERVICE - DO NOT USE FOR PRODUCTION
 * 
 * This jsPDF-based PDF generator is deprecated for production use.
 * For production PDF exports, use the Edge HTML engine via:
 * 
 * ```typescript
 * import { downloadPdfFromFunction } from "@/lib/edgePdf";
 * import { UnifiedInvoiceLayout } from "@/components/UnifiedInvoiceLayout";
 * ```
 * 
 * This file is kept for dev/testing purposes only.
 * All production document exports (Invoice, Credit Note, Quotation, Statement)
 * should use the Edge HTML → PDF pipeline for WYSIWYG consistency.
 */

import jsPDF from "jspdf";
import { InvoiceTemplate } from "./templateService";
import { formatNumber } from "@/lib/utils";

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

export class PDFGenerator {
  private pdf: jsPDF;
  private template: InvoiceTemplate;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private currentY: number = 20;

  constructor(template: InvoiceTemplate) {
    this.template = template;
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
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
  }

  private setColor(color: string) {
    const [r, g, b] = this.hexToRgb(color);
    this.pdf.setTextColor(r, g, b);
  }

  private setFillColor(color: string) {
    const [r, g, b] = this.hexToRgb(color);
    this.pdf.setFillColor(r, g, b);
  }

  private addLogo() {
    // Logo is now managed via company_settings, not template
    // This method is deprecated and will be removed
  }

  private addHeader(invoiceData: InvoiceData) {
    // Company info (right side)
    const rightX = this.pageWidth - this.margin - 80;

    const title = invoiceData.documentType || "INVOICE";

    this.setColor(this.template.primary_color);
    this.pdf.setFontSize(20);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.text(title, rightX, this.currentY);

    this.currentY += 10;
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFontSize(12);
    this.pdf.setFont("helvetica", "normal");
    this.pdf.text(`Invoice #: ${invoiceData.invoiceNumber}`, rightX, this.currentY);

    this.currentY += 6;
    this.pdf.text(`Date: ${invoiceData.invoiceDate}`, rightX, this.currentY);

    this.currentY += 6;
    this.pdf.text(`Due Date: ${invoiceData.dueDate}`, rightX, this.currentY);

    this.currentY += 15;
  }

  private addBillingInfo(invoiceData: InvoiceData) {
    // Bill To section
    this.setColor(this.template.accent_color);
    this.pdf.setFontSize(14);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.text("Bill To:", this.margin, this.currentY);

    this.currentY += 8;
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFontSize(12);
    this.pdf.setFont("helvetica", "normal");

    this.pdf.text(invoiceData.customer.name, this.margin, this.currentY);

    if (invoiceData.customer.email) {
      this.currentY += 6;
      this.pdf.text(invoiceData.customer.email, this.margin, this.currentY);
    }

    if (invoiceData.customer.address) {
      this.currentY += 6;
      const address = invoiceData.customer.address.split("\n");
      address.forEach((line) => {
        this.pdf.text(line, this.margin, this.currentY);
        this.currentY += 6;
      });
    }

    if (invoiceData.customer.vat_number) {
      this.currentY += 2;
      this.pdf.text(`VAT Number: ${invoiceData.customer.vat_number}`, this.margin, this.currentY);
      this.currentY += 6;
    }

    this.currentY += 10;
  }

  private addItemsTable(invoiceData: InvoiceData) {
    const tableStartY = this.currentY;
    const tableWidth = this.pageWidth - this.margin * 2;
    const colWidths = [80, 30, 30, 30, 30]; // Description, Qty, Price, VAT, Total
    const rowHeight = 8;

    // Table header
    this.setFillColor(this.template.primary_color);
    this.pdf.rect(this.margin, tableStartY, tableWidth, rowHeight, "F");

    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(10);
    this.pdf.setFont("helvetica", "bold");

    let currentX = this.margin + 2;
    this.pdf.text("Description", currentX, tableStartY + 5);
    currentX += colWidths[0];
    this.pdf.text("Qty", currentX, tableStartY + 5);
    currentX += colWidths[1];
    this.pdf.text("Price", currentX, tableStartY + 5);
    currentX += colWidths[2];
    this.pdf.text("VAT %", currentX, tableStartY + 5);
    currentX += colWidths[3];
    this.pdf.text("Total", currentX, tableStartY + 5);

    this.currentY = tableStartY + rowHeight;

    // Table rows
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFont("helvetica", "normal");

    invoiceData.items.forEach((item, index) => {
      const isEven = index % 2 === 0;
      if (isEven) {
        this.pdf.setFillColor(248, 248, 248);
        this.pdf.rect(this.margin, this.currentY, tableWidth, rowHeight, "F");
      }

      currentX = this.margin + 2;
      this.pdf.text(item.description, currentX, this.currentY + 5);
      currentX += colWidths[0];
      this.pdf.text(item.quantity.toString(), currentX, this.currentY + 5);
      currentX += colWidths[1];
      this.pdf.text(`€${formatNumber(item.unit_price, 2)}`, currentX, this.currentY + 5);
      currentX += colWidths[2];
      this.pdf.text(`${formatNumber(item.vat_rate * 100, 0)}%`, currentX, this.currentY + 5);
      currentX += colWidths[3];
      const itemTotal = item.quantity * item.unit_price;
      this.pdf.text(`€${formatNumber(itemTotal, 2)}`, currentX, this.currentY + 5);

      this.currentY += rowHeight;
    });

    // Table border
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.rect(this.margin, tableStartY, tableWidth, this.currentY - tableStartY);

    this.currentY += 10;
  }

  private addTotals(invoiceData: InvoiceData) {
    const totalsX = this.pageWidth - this.margin - 60;
    const labelX = totalsX - 40;

    // Subtotal
    this.pdf.setFontSize(10);
    this.pdf.text("Subtotal:", labelX, this.currentY);
    this.pdf.text(`€${formatNumber(invoiceData.totals.netTotal, 2)}`, totalsX, this.currentY);

    this.currentY += 6;
    this.pdf.text("VAT Total:", labelX, this.currentY);
    this.pdf.text(`€${formatNumber(invoiceData.totals.vatTotal, 2)}`, totalsX, this.currentY);

    this.currentY += 8;

    // Total line
    this.pdf.setDrawColor(0, 0, 0);
    this.pdf.line(labelX, this.currentY - 2, totalsX + 30, this.currentY - 2);

    this.setColor(this.template.primary_color);
    this.pdf.setFontSize(12);
    this.pdf.setFont("helvetica", "bold");
    this.pdf.text("Total:", labelX, this.currentY);
    this.pdf.text(`€${formatNumber(invoiceData.totals.grandTotal, 2)}`, totalsX, this.currentY);
  }

  private addFooter() {
    const footerY = this.pageHeight - 30;
    this.pdf.setTextColor(100, 100, 100);
    this.pdf.setFontSize(8);
    this.pdf.text("Thank you for your business!", this.margin, footerY);
    this.pdf.text("Payment terms apply as agreed.", this.margin, footerY + 4);
  }

  public generatePDF(invoiceData: InvoiceData): jsPDF {
    this.addLogo();
    this.addHeader(invoiceData);
    this.addBillingInfo(invoiceData);
    this.addItemsTable(invoiceData);
    this.addTotals(invoiceData);
    this.addFooter();

    return this.pdf;
  }
}

export const generateInvoicePDF = async (
  invoiceData: InvoiceData,
  template: InvoiceTemplate,
  filename: string,
): Promise<void> => {
  try {
    const generator = new PDFGenerator(template);
    const pdf = generator.generatePDF(invoiceData);
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};
