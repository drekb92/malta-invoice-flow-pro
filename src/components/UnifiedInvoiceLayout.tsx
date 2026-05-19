import React from "react";
import {
  DocumentCompanySettings,
  DocumentBankingSettings,
  DocumentTemplateSettings,
  DocumentTemplateStyle,
  STANDARD_MARGIN_MM,
  STANDARD_FONT_STACK,
  formatMoney,
  formatDocDate,
  getDocumentStyleConfig,
} from "@/types/document";

/* ===================== RE-EXPORTS (backward compat) ===================== */
// Pages import these types from this file — keep the re-exports so nothing breaks.
export type CompanySettings = DocumentCompanySettings;
export type BankingSettings = DocumentBankingSettings;
export type TemplateSettings = DocumentTemplateSettings;
export type TemplateStyle = DocumentTemplateStyle;

/* ===================== LOCAL TYPES ===================== */

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit?: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
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
  items: InvoiceItem[];
  totals: {
    netTotal: number;
    vatTotal: number;
    grandTotal: number;
  };
  discount?: {
    type: "amount" | "percent";
    value: number;
    amount: number;
  };
}

export type DocumentType = "INVOICE" | "CREDIT NOTE" | "QUOTATION";

export interface UnifiedInvoiceLayoutProps {
  invoiceData: InvoiceData;
  companySettings?: CompanySettings;
  bankingSettings?: BankingSettings;
  templateSettings?: TemplateSettings;
  variant?: "preview" | "pdf";
  id?: string;
  documentType?: DocumentType;
  debug?: boolean;
  footerText?: string;
  notesText?: string;
  quotationTerms?: string;
}

/* ===================== UTILITIES ===================== */

const money = formatMoney;
const formatDate = formatDocDate;

const percent = (val: number) => {
  const normalized = Number(val || 0);
  const displayRate = normalized > 1 ? normalized : normalized * 100;
  return `${Math.round(displayRate)}%`;
};

const mul = (a: number, b: number) => Number(a || 0) * Number(b || 0);

/* ===================== COMPONENT ===================== */

export const UnifiedInvoiceLayout = ({
  invoiceData,
  companySettings,
  bankingSettings,
  templateSettings,
  variant = "preview",
  id = "invoice-preview-root",
  documentType = "INVOICE",
  footerText,
  notesText,
  quotationTerms,
}: UnifiedInvoiceLayoutProps) => {
  const templateStyle: DocumentTemplateStyle = templateSettings?.style || "modern";
  const isPdf = variant === "pdf";

  const primary = templateSettings?.primaryColor || "#1e3a5f";
  const fontFamily = templateSettings?.fontFamily || STANDARD_FONT_STACK;
  const styleConfig = getDocumentStyleConfig(templateStyle, primary, isPdf);

  const getAbsoluteLogoUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith("http")) return url;
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${url}`;
  };

  const logoUrl = getAbsoluteLogoUrl(companySettings?.logo);

  const showBanking =
    (templateSettings?.bankingVisibility ?? true) && !!bankingSettings && documentType !== "QUOTATION";
  const showVatSummary = templateSettings?.vatSummaryVisibility ?? false;

  const layoutStyle = templateSettings?.layout || "default";
  const headerLayout = templateSettings?.headerLayout || "default";
  const effectiveHeaderLayout = headerLayout === "split" ? "logo-right" : headerLayout;
  const tableStyle = templateSettings?.tableStyle || "default";
  const totalsStyle = templateSettings?.totalsStyle || "default";
  const bankingStyle = templateSettings?.bankingStyle || "default";

  const fontSize = {
    body: isPdf ? "10pt" : "12px",
    small: isPdf ? "9pt" : "11px",
    tiny: isPdf ? "8pt" : "10px",
    heading: isPdf ? "18pt" : "26px",
    subheading: isPdf ? "11pt" : "14px",
    totalLabel: isPdf ? "11pt" : "13px",
  };

  // Build company address lines
  const companyAddressLines: string[] = [];
  if (companySettings?.addressLine1) companyAddressLines.push(companySettings.addressLine1);
  if (companySettings?.addressLine2) companyAddressLines.push(companySettings.addressLine2);
  if (companySettings?.locality) companyAddressLines.push(companySettings.locality);
  if (companySettings?.postCode) companyAddressLines.push(companySettings.postCode);
  if (companyAddressLines.length === 0) {
    if (companySettings?.address) companyAddressLines.push(companySettings.address);
    const cityLine = [companySettings?.zipCode, companySettings?.city].filter(Boolean).join(" ");
    if (cityLine) companyAddressLines.push(cityLine);
    if (companySettings?.country) companyAddressLines.push(companySettings.country);
  }

  const embeddedStyles = `
    @page { size: A4; margin: ${STANDARD_MARGIN_MM}mm; }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    #${id}, #${id} * { box-sizing: border-box; }
    #${id} { background: #fff; }
    #${id}.invoice-page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      color: ${primary};
      font-family: ${fontFamily};
      font-size: ${fontSize.body};
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    #${id} .invoice-inner {
      padding: var(--m-top) var(--m-right) var(--m-bottom) var(--m-left);
      min-height: 297mm;
      display: flex;
      flex-direction: column;
    }
    ${
      variant === "preview"
        ? `
      #${id}.invoice-page {
        width: min(900px, calc(100vw - 32px));
        min-height: unset;
        border: none;
        box-shadow: none;
        border-radius: 0;
        overflow: visible;
      }
      #${id} .invoice-inner {
        min-height: unset;
        padding: 24px;
      }
    `
        : ""
    }
    #${id} .header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      min-height: ${isPdf ? `${STANDARD_MARGIN_MM * 2 + 10}mm` : "150px"};
      height: ${isPdf ? `${STANDARD_MARGIN_MM * 2 + 10}mm` : "150px"};
      box-sizing: border-box;
    }
    #${id} .header-left { flex: 0 0 56%; height: 100%; display: flex; flex-direction: column; justify-content: flex-start; }
    #${id} .header-right { flex: 1; text-align: right; height: 100%; display: flex; flex-direction: column; justify-content: flex-start; }
    #${id} .logo {
      width: auto;
      height: auto;
      max-height: ${variant === "preview" ? "60px" : "18mm"};
      max-width: ${variant === "preview" ? "160px" : "45mm"};
      object-fit: contain;
      object-position: left top;
      display: block;
      margin-bottom: ${isPdf ? "2mm" : "8px"};
    }
    #${id} .company { font-size: ${fontSize.small}; color: #4b5563; line-height: 1.4; }
    #${id} .company strong { color: #111827; font-weight: 700; }
    #${id} .doc-title {
      font-size: ${fontSize.heading};
      font-weight: 800;
      letter-spacing: 0.08em;
      color: ${primary};
      margin: 0 0 ${isPdf ? "2mm" : "8px"} 0;
      text-transform: uppercase;
    }
    #${id} .meta { font-size: ${fontSize.small}; color: #4b5563; line-height: 1.4; }
    #${id} .meta .row { display: flex; justify-content: flex-end; gap: ${isPdf ? "2mm" : "8px"}; }
    #${id} .meta .label { color: #6b7280; letter-spacing: 0.04em; }
    #${id} .meta .value { color: #111827; font-weight: 600; }
    #${id} .divider { border: 0; border-top: 1px solid #e5e7eb; margin: ${isPdf ? "4mm 0 5mm 0" : "14px 0 16px 0"}; }
    #${id} .address-block { min-width: 0; }
    #${id} .section-label {
      font-size: ${fontSize.tiny};
      font-weight: 700;
      color: #6b7280;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: ${isPdf ? "1.5mm" : "6px"};
    }
    #${id} .billto { margin-bottom: ${isPdf ? "2mm" : "8px"}; }
    #${id} .customer-name { font-size: ${fontSize.subheading}; font-weight: 700; color: #111827; margin-bottom: ${isPdf ? "1mm" : "4px"}; }
    #${id} .customer-info { font-size: ${fontSize.small}; color: #4b5563; line-height: 1.4; }
    #${id} .customer-info div { margin: ${isPdf ? "0.5mm 0" : "2px 0"}; }

    /* ── Info row: Bill To (left) + Invoice aside (right) ── */
    #${id} .info-row {
      display: flex;
      gap: ${isPdf ? "8mm" : "32px"};
      align-items: flex-start;
      margin-bottom: ${isPdf ? "5mm" : "20px"};
    }
    #${id} .info-left { flex: 0 0 52%; min-width: 0; }
    #${id} .info-right { flex: 1; min-width: 0; }
    #${id} .invoice-aside {
      font-size: ${fontSize.small};
      border: 1px solid #e5e7eb;
      border-radius: ${isPdf ? "1mm" : "4px"};
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    #${id} .aside-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: ${isPdf ? "4mm" : "16px"};
      padding: ${isPdf ? "1.5mm 3mm" : "6px 12px"};
      border-bottom: 1px solid #f1f5f9;
    }
    #${id} .aside-row:last-child { border-bottom: none; }
    #${id} .aside-label {
      color: #6b7280;
      font-size: ${fontSize.tiny};
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
      flex-shrink: 0;
    }
    #${id} .aside-value {
      color: #111827;
      font-weight: 600;
      text-align: right;
      font-variant-numeric: tabular-nums;
      word-break: break-all;
    }
    #${id} .aside-amount {
      border-top: 1px solid #e5e7eb;
      padding-top: ${isPdf ? "2mm" : "8px"};
      padding-bottom: ${isPdf ? "2mm" : "8px"};
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #${id} .aside-amount .aside-label {
      color: #374151;
      font-weight: 700;
      font-size: ${fontSize.tiny};
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    #${id} .aside-amount .aside-value {
      font-size: ${fontSize.subheading};
      font-weight: 800;
      color: ${primary};
    }
    #${id} table.items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: ${isPdf ? "3mm" : "10px"};
      font-size: ${fontSize.small};
    }
    #${id} table.items thead th {
      padding: ${isPdf ? "2.5mm 2mm" : "9px 8px"};
      border-bottom: 1px solid #e5e7eb;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: ${fontSize.tiny};
      color: #6b7280;
      background: var(--th-bg, ${styleConfig.tableHeaderBg});
      vertical-align: middle;
    }
    #${id} table.items tbody td {
      padding: ${isPdf ? "2.5mm 2mm" : "9px 8px"};
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    #${id} .desc { color: #111827; font-weight: 500; white-space: pre-wrap; word-break: break-word; }
    #${id} .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; color: #374151; }
    #${id} .muted { color: #6b7280; }
    #${id} .totals {
      width: 45%;
      margin-left: auto;
      margin-top: ${isPdf ? "3mm" : "10px"};
      font-size: ${fontSize.small};
    }
    #${id} .totals .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: ${isPdf ? "3mm" : "10px"};
      padding: ${isPdf ? "1mm 0" : "4px 0"};
      align-items: center;
    }
    #${id} .totals .label { color: #6b7280; text-align: right; }
    #${id} .totals .value { text-align: right; font-weight: 700; color: #111827; }
    #${id} .totals .total {
      border-top: 1px solid #e5e7eb;
      margin-top: ${isPdf ? "1.5mm" : "6px"};
      padding-top: ${isPdf ? "2mm" : "8px"};
    }
    #${id} .totals .total .label { font-size: ${fontSize.totalLabel}; font-weight: 800; color: #111827; }
    #${id} .totals .total .value { font-size: ${fontSize.totalLabel}; font-weight: 900; color: ${primary}; }
    #${id} .body { flex: 1; }
    #${id} .footer { margin-top: auto; padding-top: ${isPdf ? "4mm" : "14px"}; }
    #${id} .banking { font-size: ${fontSize.small}; line-height: 1.4; color: #4b5563; }
    #${id} .banking .line { margin: ${isPdf ? "0.5mm 0" : "2px 0"}; }
    #${id} .vat-total-row { background: #e2e8f0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    #${id} .vat-total-row td { border-bottom: none; }
    #${id} .thanks {
      margin-top: ${isPdf ? "3mm" : "12px"};
      padding-top: ${isPdf ? "2.5mm" : "10px"};
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: ${fontSize.small};
      color: #6b7280;
      line-height: 1.4;
    }
    #${id} .vat-summary-section {
      margin-top: ${isPdf ? "4mm" : "16px"};
      break-inside: avoid;
      page-break-inside: avoid;
      background: #f8fafc !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: ${isPdf ? "1.5mm" : "6px"};
      padding: ${isPdf ? "3mm" : "12px"};
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #${id} table.vat-summary {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: ${isPdf ? "9pt" : "11px"};
    }
    #${id} table.vat-summary thead th {
      padding: ${isPdf ? "1.5mm 1.5mm" : "5px 6px"};
      border-bottom: 1px solid #cbd5e1;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: ${isPdf ? "7pt" : "9px"};
      color: #64748b;
    }
    #${id} table.vat-summary tbody td {
      padding: ${isPdf ? "1.5mm 1.5mm" : "5px 6px"};
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      font-weight: 500;
    }
    #${id} table.vat-summary tbody tr:last-child td { border-bottom: none; }
    #${id} .terms-section {
      margin-top: ${isPdf ? "5mm" : "18px"};
      padding-top: ${isPdf ? "3mm" : "12px"};
      border-top: 1px solid #e5e7eb;
    }

    /* ── Style: modern (Split Header) ── */
    ${
      templateStyle === "modern"
        ? `
      /* Header: no own background — left/right panels carry their own */
      #${id} .header {
        background: transparent;
        padding: 0;
        gap: 0;
        align-items: stretch;
        height: auto;
        min-height: unset;
        margin: ${isPdf ? `-${STANDARD_MARGIN_MM}mm -${STANDARD_MARGIN_MM}mm 0 -${STANDARD_MARGIN_MM}mm` : "-24px -24px 0 -24px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Left panel — off-white, logo-safe */
      #${id} .header-left {
        flex: 0 0 56%;
        background: #f4f6f8;
        padding: ${isPdf ? `5mm 5mm 5mm ${STANDARD_MARGIN_MM}mm` : "20px 20px 20px 24px"};
        display: flex;
        flex-direction: column;
        justify-content: center;
        height: auto;
        min-height: ${isPdf ? "30mm" : "120px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Right panel — brand color, document title */
      #${id} .header-right {
        flex: 1;
        background: ${primary};
        padding: ${isPdf ? `5mm ${STANDARD_MARGIN_MM}mm 5mm 8mm` : "20px 24px 20px 20px"};
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-end;
        height: auto;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Company text — dark on off-white panel */
      #${id} .header .company { color: #4b5563; }
      #${id} .header .company strong { color: #111827; font-weight: 700; }
      /* Logo — no special treatment needed on off-white bg */
      #${id} .logo { margin-bottom: ${isPdf ? "2mm" : "8px"}; }
      /* Doc title — large white on brand-color panel */
      #${id} .doc-title {
        color: #ffffff !important;
        font-weight: 900;
        letter-spacing: 0.12em;
        font-size: ${isPdf ? "20pt" : "28px"};
        text-align: right;
        text-transform: uppercase;
        margin: 0;
      }
      /* Full-width brand-color divider — bleeds to page edges */
      #${id} .divider {
        border: none;
        border-top: ${isPdf ? "3pt" : "4px"} solid ${primary};
        margin: ${isPdf ? `0 -${STANDARD_MARGIN_MM}mm 5mm -${STANDARD_MARGIN_MM}mm` : "0 -24px 20px -24px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Table header */
      #${id} table.items thead th {
        background: ${styleConfig.tableHeaderBg};
        color: ${styleConfig.tableHeaderColor};
        border-bottom: none;
        letter-spacing: 0.07em;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Striped rows — capped at ~6% so vivid brand colors don't saturate */
      #${id} table.items tbody tr:nth-child(even) td {
        background: ${primary}0f;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Totals total row */
      #${id} .totals .total {
        background: ${styleConfig.totalBg};
        color: ${styleConfig.totalTextColor};
        padding: ${isPdf ? "2mm 3mm" : "8px 12px"};
        border-radius: ${isPdf ? "1mm" : "4px"};
        border-top: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .totals .total .label,
      #${id} .totals .total .value { color: ${styleConfig.totalTextColor}; }

      /* Invoice aside — brand top-border variant (echoes the divider) */
      #${id} .invoice-aside {
        border: 1px solid #e5e7eb;
        border-top: ${isPdf ? "3pt" : "3px"} solid ${primary};
        border-radius: ${isPdf ? "0 0 1mm 1mm" : "0 0 4px 4px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .aside-row { border-bottom-color: ${primary}18; }
      #${id} .aside-amount { border-top-color: ${primary}28; background: ${primary}0d; -webkit-print-color-adjust: exact !important; }
      #${id} .aside-amount .aside-value { color: ${primary}; font-weight: 700; }

      /* Banking — modern */
      #${id} .banking {
        background: ${primary}0c;
        border: 1px solid ${primary}30;
        padding: ${isPdf ? "2.5mm 4mm" : "10px 16px"};
        border-radius: ${isPdf ? "1mm" : "4px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .banking .section-label { color: ${primary}; font-weight: 700; margin-bottom: ${isPdf ? "1.5mm" : "6px"}; }

      /* VAT Summary — modern */
      #${id} .vat-summary-section {
        background: ${primary}08 !important;
        border: 1px solid ${primary}28 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .vat-summary-section .section-label { color: ${primary}; font-weight: 700; }
      #${id} table.vat-summary thead th { color: ${primary}; border-bottom: 1px solid ${primary}28; }
      #${id} .vat-total-row { background: ${primary}18 !important; }
      #${id} .vat-total-row td { color: ${primary} !important; }
    `
        : ""
    }

    /* ── Style: professional ── */
    ${
      templateStyle === "professional"
        ? `
      #${id} .header {
        background: ${styleConfig.headerBg};
        color: ${styleConfig.headerTextColor};
        padding: ${isPdf ? "5mm" : "20px"};
        margin: ${isPdf ? `-${STANDARD_MARGIN_MM}mm -${STANDARD_MARGIN_MM}mm 4mm -${STANDARD_MARGIN_MM}mm` : "-24px -24px 16px -24px"};
        padding-left: ${isPdf ? `${STANDARD_MARGIN_MM}mm` : "24px"};
        padding-right: ${isPdf ? `${STANDARD_MARGIN_MM}mm` : "24px"};
        border-top: ${styleConfig.headerBorderStyle};
        height: auto;
        box-sizing: content-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .doc-title { color: ${styleConfig.brandColor}; font-weight: 800; letter-spacing: 0.1em; }
      #${id} .meta .row:first-child .value { color: ${primary}; font-weight: 700; }
      #${id} table.items thead th {
        background: ${styleConfig.tableHeaderBg};
        color: ${styleConfig.tableHeaderColor};
        border-bottom: ${"tableHeaderBorder" in styleConfig ? styleConfig.tableHeaderBorder : "none"};
        letter-spacing: 0.07em;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} table.items tbody tr:nth-child(even) td { background: ${styleConfig.rowAltBg}; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      /* Invoice aside — professional */
      #${id} .invoice-aside {
        border-color: ${primary}20;
        border-top: ${isPdf ? "2pt" : "3px"} solid ${primary};
        border-radius: ${isPdf ? "0 0 1mm 1mm" : "0 0 4px 4px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .aside-row { border-bottom-color: ${primary}12; }
      #${id} .aside-amount { border-top-color: ${primary}20; background: ${primary}06; }
      #${id} .aside-amount .aside-value { color: ${primary}; }

      #${id} .totals {
        background: ${primary}04;
        border: 1px solid ${primary}18;
        border-radius: ${isPdf ? "1.5mm" : "6px"};
        padding: ${isPdf ? "2mm 3mm" : "8px 12px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .totals .total {
        border-top: 2px solid ${styleConfig.brandColor};
        padding: ${isPdf ? "2.5mm 0" : "10px 0"};
        margin-top: ${isPdf ? "2mm" : "8px"};
      }
      #${id} .totals .total .label { color: #111827; font-weight: 700; font-size: ${fontSize.totalLabel}; }
      #${id} .totals .total .value { color: ${styleConfig.totalTextColor}; font-weight: 900; font-size: ${isPdf ? "13pt" : "17px"}; }

      /* Banking — professional */
      #${id} .banking {
        border: 1px solid ${primary}22;
        padding: ${isPdf ? "2.5mm 3mm" : "10px 12px"};
        background: ${primary}06;
        border-radius: ${isPdf ? "1mm" : "4px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .banking .section-label { color: ${primary}; font-weight: 700; margin-bottom: ${isPdf ? "1.5mm" : "6px"}; }

      /* VAT Summary — professional */
      #${id} .vat-summary-section {
        background: #ffffff !important;
        border: none !important;
        border-top: ${isPdf ? "1.2mm" : "2px"} solid ${primary} !important;
        border-radius: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .vat-summary-section .section-label { color: ${primary}; font-weight: 700; }
      #${id} table.vat-summary thead th { color: ${primary}; border-bottom: 2px solid ${primary}; }
      #${id} .vat-total-row { background: #f9fafb !important; }
      #${id} .vat-total-row td { color: ${primary} !important; }
    `
        : ""
    }

    /* ── Style: minimalist ── */
    ${
      templateStyle === "minimalist"
        ? `
      #${id}.invoice-page { background: #ffffff !important; }
      #${id} .invoice-inner { background: #ffffff !important; }
      #${id} .header {
        background: transparent !important;
        padding-bottom: ${isPdf ? "5mm" : "20px"};
        margin-bottom: ${isPdf ? "4mm" : "16px"};
        border: none;
        border-bottom: 1px solid #ececec;
        height: auto;
      }
      #${id} .doc-title {
        font-weight: 500;
        letter-spacing: 0.18em;
        color: #6b7280;
        font-size: ${isPdf ? "14pt" : "20px"};
      }
      #${id} .doc-title::before {
        content: '';
        display: block;
        width: ${isPdf ? "6mm" : "24px"};
        height: ${isPdf ? "0.3mm" : "1px"};
        background: #c4c4c4;
        margin-left: auto;
        margin-bottom: ${isPdf ? "2mm" : "8px"};
      }
      #${id} .divider { display: none; }
      #${id} .section-label { color: #9ca3af; font-weight: 400; letter-spacing: 0.12em; }
      #${id} table.items thead th {
        background: transparent !important;
        border-bottom: 1px solid #d1d5db;
        color: #4b5563;
        font-weight: 600;
        letter-spacing: 0.07em;
      }
      #${id} table.items tbody td { border-bottom: 1px solid #e5e7eb; background: #ffffff; }
      #${id} .totals { margin-top: ${isPdf ? "6mm" : "24px"}; padding-top: ${isPdf ? "3mm" : "12px"}; border-top: 1px solid #e5e7eb; }
      #${id} .totals .row .label { color: #6b7280; }
      #${id} .totals .row .value { color: #374151; }
      #${id} .totals .total { border-top: none; margin-top: ${isPdf ? "3mm" : "12px"}; padding-top: ${isPdf ? "2mm" : "8px"}; }
      #${id} .totals .total .label { font-weight: 600; color: #374151; letter-spacing: 0.04em; }
      #${id} .totals .total .value { font-weight: 800; color: ${styleConfig.totalTextColor} !important; }
      /* Invoice aside — minimalist */
      #${id} .invoice-aside {
        border-color: #e5e7eb;
        background: #fafafa;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .aside-row { border-bottom-color: #efefef; }
      #${id} .aside-label { color: #9ca3af; letter-spacing: 0.08em; }
      #${id} .aside-amount { border-top-color: #e5e7eb; background: transparent; }
      #${id} .aside-amount .aside-label { color: #6b7280; }
      #${id} .aside-amount .aside-value { color: ${primary}; font-weight: 800; }

      /* Banking — minimalist */
      #${id} .banking {
        margin-top: ${isPdf ? "4mm" : "16px"};
        padding: ${isPdf ? "3mm" : "12px"};
        border: 1px solid #e5e7eb;
        border-radius: ${isPdf ? "1mm" : "4px"};
        background: #fafafa !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .banking .section-label { color: #9ca3af; font-weight: 400; letter-spacing: 0.1em; margin-bottom: ${isPdf ? "1.5mm" : "6px"}; }
      #${id} .banking .line strong { font-weight: 400; color: #9ca3af; }
      #${id} .thanks { text-align: left; border-top: 1px solid #f0f0f0; color: #9ca3af; }

      /* VAT Summary — minimalist */
      #${id} .vat-summary-section {
        background: transparent !important;
        border: none !important;
        border-top: 1px solid #e5e7eb !important;
        border-radius: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      #${id} .vat-summary-section .section-label { color: #9ca3af; font-weight: 400; letter-spacing: 0.1em; }
      #${id} table.vat-summary thead th {
        color: #9ca3af;
        font-weight: 400;
        letter-spacing: 0.08em;
        border-bottom: 1px solid #e5e7eb;
        text-transform: lowercase;
      }
      #${id} table.vat-summary tbody td { color: #6b7280; border-bottom: 1px solid #e5e7eb; }
      #${id} .vat-total-row { background: transparent !important; }
      #${id} .vat-total-row td { color: ${primary} !important; font-weight: 600 !important; border-top: 1px solid #e5e7eb; }
    `
        : ""
    }

    /* ── Layout: compact ── */
    ${
      layoutStyle === "compact"
        ? `
      #${id} table.items thead th { padding: ${isPdf ? "1.5mm 2mm" : "5px 8px"}; }
      #${id} table.items tbody td { padding: ${isPdf ? "1.5mm 2mm" : "5px 8px"}; }
      #${id} .totals .row { padding: ${isPdf ? "0.5mm 0" : "2px 0"}; }
      #${id} .billto { margin-bottom: ${isPdf ? "2mm" : "8px"}; }
      #${id} .header { min-height: ${isPdf ? "28mm" : "110px"}; height: ${isPdf ? "28mm" : "110px"}; }
    `
        : ""
    }

    /* ── Layout: cleanMinimal ── */
    ${
      layoutStyle === "cleanMinimal"
        ? `
      #${id} .divider { display: none; }
      #${id} .section-label { display: none; }
      #${id} .billto .section-label { display: block; }
      #${id} .billto { margin-bottom: ${isPdf ? "5mm" : "20px"}; border-bottom: 1px solid #f3f4f6; padding-bottom: ${isPdf ? "3mm" : "12px"}; }
      #${id} .thanks { border-top: 1px solid #f3f4f6; }
    `
        : ""
    }

    /* ── Header Layout: centered ── */
    ${
      effectiveHeaderLayout === "centered"
        ? `
      #${id} .header { flex-direction: column; align-items: center; text-align: center; height: auto; }
      #${id} .header-left { align-items: center; flex: none; width: 100%; }
      #${id} .header-right { text-align: center; flex: none; width: 100%; }
      #${id} .logo { margin-left: auto; margin-right: auto; display: block; }
      #${id} .company { text-align: center; }
      #${id} .meta .row { justify-content: center; }
      #${id} .doc-title { text-align: center; }
    `
        : ""
    }

    /* ── Header Layout: logo-right ── */
    ${
      effectiveHeaderLayout === "logo-right"
        ? `
      #${id} .header { flex-direction: row-reverse; gap: ${isPdf ? "8mm" : "32px"}; align-items: flex-start; }
      #${id} .header-left { flex: 0 0 40%; align-items: flex-end; text-align: right; }
      #${id} .header-right { flex: 1; text-align: left; }
      #${id} .logo { margin-left: auto; display: block; }
      #${id} .company { text-align: right; }
      #${id} .meta .row { justify-content: flex-start; }
      #${id} .doc-title { text-align: left; }
    `
        : ""
    }

    /* ── Table Style: striped ── */
    ${
      tableStyle === "striped"
        ? `
      #${id} table.items tbody tr:nth-child(odd) td { background: #f8fafc; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      #${id} table.items tbody tr:nth-child(even) td { background: #ffffff; }
      #${id} table.items tbody td { border-bottom: none; }
    `
        : ""
    }

    /* ── Table Style: bordered ── */
    ${
      tableStyle === "bordered"
        ? `
      #${id} table.items { border: 1px solid #d1d5db; }
      #${id} table.items thead th { border-right: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; }
      #${id} table.items tbody td { border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
      #${id} table.items thead th:last-child, #${id} table.items tbody td:last-child { border-right: none; }
    `
        : ""
    }

    /* ── Table Style: minimal ── */
    ${
      tableStyle === "minimal"
        ? `
      #${id} table.items thead th { background: transparent !important; border-bottom: 1px solid #d1d5db; color: #4b5563; font-weight: 600; letter-spacing: 0.07em; }
      #${id} table.items tbody td { border-bottom: 1px solid #e5e7eb; }
      #${id} table.items tbody tr:last-child td { border-bottom: none; }
    `
        : ""
    }

    /* ── Totals Style: boxed ── */
    ${
      totalsStyle === "boxed"
        ? `
      #${id} .totals { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: ${isPdf ? "1.5mm" : "6px"}; padding: ${isPdf ? "3mm 4mm" : "12px 16px"}; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      #${id} .totals .total { border-top: 1px solid #cbd5e1; margin-top: ${isPdf ? "2mm" : "8px"}; padding-top: ${isPdf ? "2mm" : "8px"}; }
    `
        : ""
    }

    /* ── Totals Style: highlighted ── */
    ${
      totalsStyle === "highlighted"
        ? `
      #${id} .totals .total { background: ${primary}; padding: ${isPdf ? "2mm 3mm" : "8px 12px"}; border-radius: ${isPdf ? "1mm" : "4px"}; border-top: none; margin-top: ${isPdf ? "2mm" : "8px"}; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      #${id} .totals .total .label, #${id} .totals .total .value { color: #ffffff !important; }
    `
        : ""
    }

    /* ── Banking Style: boxed ── */
    ${
      bankingStyle === "boxed"
        ? `
      #${id} .banking { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: ${isPdf ? "1.5mm" : "6px"}; padding: ${isPdf ? "3mm 4mm" : "12px 16px"}; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    `
        : ""
    }

    /* ── Banking Style: minimal ── */
    ${
      bankingStyle === "minimal"
        ? `
      #${id} .banking .section-label { display: none; }
      #${id} .banking .line strong { font-weight: 400; color: #9ca3af; }
      #${id} .banking { font-size: ${isPdf ? "8.5pt" : "11px"}; color: #6b7280; }
    `
        : ""
    }

    @media print {
      html, body { margin: 0; padding: 0; width: 210mm; height: 297mm; }
      #${id}.invoice-page { width: 210mm; min-height: 297mm; page-break-after: always; }
      #${id} .invoice-inner { padding: 0; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      tr, td, th { break-inside: avoid; page-break-inside: avoid; }
      .totals-section, .banking-section { break-inside: avoid; page-break-inside: avoid; }
    }
  `;

  const lockedVars: React.CSSProperties = {
    ...({
      ["--m-top" as any]: `${STANDARD_MARGIN_MM}mm`,
      ["--m-right" as any]: `${STANDARD_MARGIN_MM}mm`,
      ["--m-bottom" as any]: `${STANDARD_MARGIN_MM}mm`,
      ["--m-left" as any]: `${STANDARD_MARGIN_MM}mm`,
      ["--color-primary" as any]: primary,
      ["--font" as any]: templateSettings?.fontFamily || "Figtree",
      ["--th-bg" as any]: styleConfig.tableHeaderBg,
    } as any),
  };

  return (
    <div id={id} className="invoice-page" style={lockedVars}>
      <style dangerouslySetInnerHTML={{ __html: embeddedStyles }} />
      <div id="invoice-inner" className="invoice-inner">
        <div className="body">
          {/* HEADER */}
          <div className="header">
            <div className="header-left">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="logo" />
              ) : (
                <div style={{ height: variant === "preview" ? 76 : 90 }} />
              )}
              <div className="company">
                {companySettings?.name && <strong>{companySettings.name}</strong>}
                {companyAddressLines.map((l, idx) => (
                  <div key={idx}>{l}</div>
                ))}
                {companySettings?.email && <div>{companySettings.email}</div>}
                {companySettings?.phone && <div>{companySettings.phone}</div>}
                {companySettings?.taxId && <div>VAT: {companySettings.taxId}</div>}
                {companySettings?.registrationNumber && <div>Reg: {companySettings.registrationNumber}</div>}
              </div>
            </div>
            <div className="header-right">
              <div className="doc-title">{documentType}</div>
            </div>
          </div>

          <hr className="divider" />

          {/* INFO ROW — Bill To (left) + Invoice reference aside (right) */}
          <div className="info-row">
            <div className="info-left">
              <div className="address-block billto">
                <div className="section-label">Bill To</div>
                <div className="customer-name">{invoiceData.customer.name}</div>
                <div className="customer-info">
                  {invoiceData.customer.address_line1 && <div>{invoiceData.customer.address_line1}</div>}
                  {invoiceData.customer.address_line2 && <div>{invoiceData.customer.address_line2}</div>}
                  {invoiceData.customer.locality && <div>{invoiceData.customer.locality}</div>}
                  {invoiceData.customer.post_code && <div>{invoiceData.customer.post_code}</div>}
                  {!invoiceData.customer.address_line1 && invoiceData.customer.address && (
                    <div>{invoiceData.customer.address}</div>
                  )}
                  {invoiceData.customer.email && <div>{invoiceData.customer.email}</div>}
                  {invoiceData.customer.vat_number && <div>VAT No: {invoiceData.customer.vat_number}</div>}
                </div>
              </div>
            </div>
            <div className="info-right">
              <div className="invoice-aside">
                <div className="aside-row">
                  <span className="aside-label">No</span>
                  <span className="aside-value">{invoiceData.invoiceNumber}</span>
                </div>
                <div className="aside-row">
                  <span className="aside-label">Issue Date</span>
                  <span className="aside-value">{formatDate(invoiceData.invoiceDate)}</span>
                </div>
                <div className="aside-row">
                  <span className="aside-label">{documentType === "QUOTATION" ? "Valid Until" : "Due Date"}</span>
                  <span className="aside-value">{formatDate(invoiceData.dueDate)}</span>
                </div>
                <div className="aside-row aside-amount">
                  <span className="aside-label">
                    {documentType === "CREDIT NOTE" ? "Credit Total" : documentType === "QUOTATION" ? "Quote Total" : "Amount Due"}
                  </span>
                  <span className="aside-value">{money(invoiceData.totals.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ITEMS TABLE */}
          <table className="items">
            <colgroup>
              <col style={{ width: "46%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "16%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Description</th>
                <th className="num">Qty</th>
                <th className="num">Unit Price</th>
                <th className="num">VAT</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoiceData.items.map((item, i) => (
                <tr key={i}>
                  <td className="desc">{item.description}</td>
                  <td className="num muted">{item.quantity}</td>
                  <td className="num muted">{money(item.unit_price)}</td>
                  <td className="num muted">{percent(item.vat_rate)}</td>
                  <td className="num">{money(mul(item.quantity, item.unit_price))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* TOTALS */}
          <div className="totals totals-section">
            <div className="row">
              <div className="label">Subtotal</div>
              <div className="value">{money(invoiceData.totals.netTotal + (invoiceData.discount?.amount || 0))}</div>
            </div>
            {invoiceData.discount?.amount ? (
              <>
                <div className="row">
                  <div className="label">
                    Discount{invoiceData.discount.type === "percent" ? ` (${invoiceData.discount.value}%)` : ""}
                  </div>
                  <div className="value">−{money(invoiceData.discount.amount)}</div>
                </div>
                <div className="row">
                  <div className="label">Taxable Amount</div>
                  <div className="value">{money(invoiceData.totals.netTotal)}</div>
                </div>
              </>
            ) : null}
            <div className="row">
              <div className="label">VAT</div>
              <div className="value">{money(invoiceData.totals.vatTotal)}</div>
            </div>
            <div className="row total">
              <div className="label">Total</div>
              <div className="value">{money(invoiceData.totals.grandTotal)}</div>
            </div>
          </div>

          {/* VAT SUMMARY */}
          {showVatSummary &&
            (() => {
              const vatGroups = invoiceData.items.reduce(
                (acc, item) => {
                  const rate = Number(item.vat_rate) || 0;
                  const netAmount = mul(item.quantity, item.unit_price);
                  if (!acc[rate]) acc[rate] = { netAmount: 0, vatAmount: 0 };
                  acc[rate].netAmount += netAmount;
                  const discountRatio = invoiceData.discount?.amount
                    ? invoiceData.discount.amount / (invoiceData.totals.netTotal + invoiceData.discount.amount)
                    : 0;
                  const discountedNet = netAmount * (1 - discountRatio);
                  const normalizedRate = rate > 1 ? rate / 100 : rate;
                  acc[rate].vatAmount += discountedNet * normalizedRate;
                  return acc;
                },
                {} as Record<number, { netAmount: number; vatAmount: number }>,
              );

              const sortedRates = Object.keys(vatGroups)
                .map(Number)
                .sort((a, b) => a - b);
              if (sortedRates.length === 0) return null;
              const totalNet = sortedRates.reduce((sum, r) => sum + vatGroups[r].netAmount, 0);
              const totalVat = sortedRates.reduce((sum, r) => sum + vatGroups[r].vatAmount, 0);

              return (
                <div className="vat-summary-section">
                  <div className="section-label">VAT Summary</div>
                  <table className="vat-summary">
                    <colgroup>
                      <col />
                      <col />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Rate</th>
                        <th className="num">Net Amount</th>
                        <th className="num">VAT Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRates.map((rate) => {
                        const group = vatGroups[rate];
                        const displayRate = rate > 1 ? rate : rate * 100;
                        return (
                          <tr key={rate}>
                            <td>{displayRate}%</td>
                            <td className="num">{money(group.netAmount)}</td>
                            <td className="num">{money(group.vatAmount)}</td>
                          </tr>
                        );
                      })}
                      <tr className="vat-total-row">
                        <td style={{ fontWeight: 600 }}>Total</td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {money(totalNet)}
                        </td>
                        <td className="num" style={{ fontWeight: 600 }}>
                          {money(totalVat)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}
        </div>

        {/* FOOTER */}
        <div className="footer">
          {showBanking && (
            <div className="banking banking-section">
              <div className="section-label">Banking Details</div>
              {bankingSettings?.bankName && (
                <div className="line">
                  <strong>Bank:</strong> {bankingSettings.bankName}
                </div>
              )}
              {bankingSettings?.accountName && (
                <div className="line">
                  <strong>Account:</strong> {bankingSettings.accountName}
                </div>
              )}
              {bankingSettings?.iban && (
                <div className="line">
                  <strong>IBAN:</strong> {bankingSettings.iban}
                </div>
              )}
              {bankingSettings?.swiftCode && (
                <div className="line">
                  <strong>SWIFT:</strong> {bankingSettings.swiftCode}
                </div>
              )}
            </div>
          )}

          {documentType === "QUOTATION" &&
            (() => {
              const defaultTerms = [
                `This quotation is valid until ${formatDate(invoiceData.dueDate)}.`,
                "Work will commence upon acceptance.",
                "Any additional services will be quoted separately.",
              ];
              const termLines = quotationTerms
                ? quotationTerms.split("\n").filter((line) => line.trim())
                : defaultTerms;
              const validUntil = formatDate(invoiceData.dueDate);
              const resolvedTerms = termLines.map((line) => line.replace(/\{\{valid_until_date\}\}/g, validUntil));
              return (
                <div className="terms-section">
                  <div className="section-label">Terms &amp; Conditions</div>
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: isPdf ? "4mm" : "16px",
                      fontSize: isPdf ? "8pt" : "10px",
                      color: "#9ca3af",
                      lineHeight: 1.6,
                    }}
                  >
                    {resolvedTerms.map((term, i) => (
                      <li key={i}>{term}</li>
                    ))}
                  </ol>
                </div>
              );
            })()}

          {notesText && templateSettings?.notesVisibility !== false && (
            <div style={{ marginTop: "12px", marginBottom: "8px" }}>
              <div className="section-label" style={{ color: primary }}>
                Notes
              </div>
              <div style={{ fontSize: "8pt", color: "#6b7280", whiteSpace: "pre-line", lineHeight: "1.4" }}>
                {notesText}
              </div>
            </div>
          )}

          <div className="thanks">{footerText || "Thank you for your business. All amounts in EUR."}</div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedInvoiceLayout;
