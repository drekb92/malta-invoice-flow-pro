import { format } from "date-fns";
import {
  DocumentCompanySettings,
  DocumentBankingSettings,
  DocumentTemplateSettings,
  DocumentTemplateStyle,
  STANDARD_MARGIN_MM,
  STANDARD_FONT_STACK,
  formatMoney,
  getDocumentStyleConfig,
} from "@/types/document";
import { PDF_PRINT_STYLES } from "@/lib/pdfPrintStyles";

/* ===================== RE-EXPORTS (backward compat) ===================== */
export type CompanySettings = DocumentCompanySettings;
export type BankingSettings = DocumentBankingSettings;
export type TemplateSettings = DocumentTemplateSettings;

/* ===================== STATEMENT-SPECIFIC TYPES ===================== */

export interface StatementCustomer {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  vat_number: string | null;
}

export interface StatementLine {
  id: string;
  date: string;
  description: string;
  type: "invoice" | "credit_note" | "payment";
  reference: string;
  debit: number;
  credit: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface UnifiedStatementLayoutProps {
  customer: StatementCustomer;
  companySettings?: CompanySettings;
  bankingSettings?: BankingSettings;
  templateSettings?: TemplateSettings;
  statementLines: StatementLine[];
  dateRange: DateRange;
  openingBalance: number;
  closingBalance: number;
  statementType?: "outstanding" | "activity";
  variant?: "preview" | "pdf" | "print";
  id?: string;
}

/* ===================== FORMATTERS ===================== */

const money = formatMoney;

const formatDebit = (amount: number): string => (amount <= 0 ? "" : money(amount));

const formatCredit = (amount: number): string => (amount <= 0 ? "" : `(${money(amount)})`);

const formatBalance = (amount: number): string => {
  if (amount === 0) return "€0.00";
  if (amount > 0) return money(amount);
  return `(${money(Math.abs(amount))})`;
};

/* ===================== COMPONENT ===================== */

export const UnifiedStatementLayout = ({
  customer,
  companySettings,
  bankingSettings,
  templateSettings,
  statementLines,
  dateRange,
  openingBalance,
  closingBalance,
  statementType = "activity",
  variant = "pdf",
  id = "invoice-preview-root",
}: UnifiedStatementLayoutProps) => {
  const templateStyle: DocumentTemplateStyle = templateSettings?.style || "modern";
  const isPdf = variant === "pdf" || variant === "print";

  const primary = templateSettings?.primaryColor || "#1e3a5f";
  const fontFamily = templateSettings?.fontFamily || STANDARD_FONT_STACK;
  const showBanking = templateSettings?.bankingVisibility !== false;
  const headerLayout = templateSettings?.headerLayout || "default";
  const isLogoRight = headerLayout === "logo-right" || headerLayout === "split";
  const isCentered = headerLayout === "centered";

  const styleConfig = getDocumentStyleConfig(templateStyle, primary, isPdf);

  const getAbsoluteLogoUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos${url}`;
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${url}`;
  };

  const logoUrl = getAbsoluteLogoUrl(companySettings?.logo);

  // Build company address lines — same logic as UnifiedInvoiceLayout
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

  const totalDebits = statementLines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = statementLines.reduce((sum, line) => sum + line.credit, 0);

  // ── Embedded stylesheet ──────────────────────────────────────────────────
  const embeddedStyles = `
    @page { size: A4; margin: ${STANDARD_MARGIN_MM}mm; }
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    #${id}, #${id} * { box-sizing: border-box; }
    #${id} { background: #fff; }
    #${id}.statement-page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      color: ${primary};
      font-family: ${fontFamily};
      font-size: ${isPdf ? "10pt" : "12px"};
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }

    /* ── Page wrapper table — enables <thead> repeat on multi-page print ── */
    #${id} .stmt-page-wrap {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    /* stmt-repeat-header repeats at top of every print page */
    #${id} .stmt-repeat-header {
      display: table-header-group;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    /* Header cell: side padding provides visual inset; no top/bottom (header handles it) */
    #${id} .stmt-header-cell {
      padding: 0 ${STANDARD_MARGIN_MM}mm 0;
      vertical-align: top;
    }
    /* Body cell: no top (divider provides gap), side + bottom margins */
    #${id} .stmt-body-cell {
      padding: 0 ${STANDARD_MARGIN_MM}mm ${STANDARD_MARGIN_MM}mm;
      vertical-align: top;
    }
    #${id} .stmt-body {
      display: flex;
      flex-direction: column;
    }
    #${id} .stmt-content { flex: 1; }
    /* Outer wrapper rows MUST allow page breaks — the single tbody tr/td holds all content.
       Without this, break-inside:avoid (from PDF_PRINT_STYLES) pushes the entire tbody to
       page 2, leaving page 1 blank after the header. Inner stmt-items rows still avoid. */
    #${id} .stmt-page-wrap > tbody > tr,
    #${id} .stmt-body-cell {
      break-inside: auto;
      page-break-inside: auto;
    }

    ${
      variant === "preview"
        ? `
      #${id}.statement-page {
        width: min(900px, calc(100vw - 32px));
        min-height: unset;
        border: none; box-shadow: none; border-radius: 0; overflow: visible;
      }
      #${id} .stmt-header-cell { padding: 0 24px 0; }
      #${id} .stmt-body-cell { padding: 0 24px 24px; }
    `
        : ""
    }

    /* ── Header ── */
    #${id} .header {
      display: flex;
      flex-direction: ${isCentered ? "column" : isLogoRight ? "row-reverse" : "row"};
      justify-content: ${isCentered ? "center" : "space-between"};
      align-items: ${isCentered ? "center" : "flex-start"};
      text-align: ${isCentered ? "center" : "inherit"};
      gap: ${isPdf ? "8mm" : "32px"};
      min-height: ${isPdf ? "28mm" : "110px"};
      box-sizing: border-box;
      padding: ${isPdf ? `5mm 0` : "20px 0"};
    }
    #${id} .header-left {
      flex: ${isLogoRight ? "0 0 40%" : "0 0 56%"};
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      ${isCentered ? "align-items: center; width: 100%;" : ""}
    }
    #${id} .header-right {
      flex: 1;
      text-align: ${isLogoRight ? "left" : isCentered ? "center" : "right"};
      ${isCentered ? "width: 100%;" : ""}
    }
    #${id} .logo {
      width: auto; height: auto;
      max-height: ${isPdf ? "18mm" : "60px"};
      max-width: ${isPdf ? "45mm" : "160px"};
      object-fit: contain;
      object-position: ${isLogoRight ? "right top" : isCentered ? "center top" : "left top"};
      display: block;
      margin-bottom: ${isPdf ? "2mm" : "8px"};
      ${isCentered ? "margin-left: auto; margin-right: auto;" : ""}
      ${isLogoRight ? "margin-left: auto;" : ""}
    }
    #${id} .company {
      font-size: ${isPdf ? "9pt" : "11px"};
      color: #4b5563;
      line-height: 1.4;
    }
    #${id} .company strong { color: #111827; font-weight: 700; }
    #${id} .doc-title {
      font-size: ${isPdf ? "18pt" : "26px"};
      font-weight: 800;
      letter-spacing: 0.08em;
      color: ${primary};
      margin: 0;
      text-transform: uppercase;
    }
    #${id} .doc-subtitle {
      font-size: ${isPdf ? "8pt" : "11px"};
      font-weight: 400;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #6b7280;
      text-align: right;
      margin-top: ${isPdf ? "1.5mm" : "5px"};
    }
    #${id} .meta {
      font-size: ${isPdf ? "9pt" : "11px"};
      color: #4b5563;
      line-height: 1.6;
    }
    #${id} .divider { border: 0; border-top: 1px solid #e5e7eb; margin: ${isPdf ? "0 0 5mm 0" : "0 0 16px 0"}; }

    /* ── Customer block ── */
    #${id} .section-label {
      font-size: ${isPdf ? "8pt" : "10px"};
      font-weight: 700;
      color: #6b7280;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: ${isPdf ? "1.5mm" : "6px"};
    }
    #${id} .stmt-for { margin-bottom: ${isPdf ? "2mm" : "8px"}; }
    #${id} .customer-name { font-size: ${isPdf ? "11pt" : "14px"}; font-weight: 700; color: #111827; margin-bottom: ${isPdf ? "1mm" : "4px"}; }
    #${id} .customer-info { font-size: ${isPdf ? "9pt" : "11px"}; color: #4b5563; line-height: 1.4; }

    /* ── Info row: Statement For (left) + Statement aside (right) ── */
    #${id} .stmt-info-row {
      display: flex;
      gap: ${isPdf ? "8mm" : "32px"};
      align-items: flex-start;
      margin-bottom: ${isPdf ? "5mm" : "20px"};
    }
    #${id} .stmt-info-left { flex: 0 0 52%; min-width: 0; }
    #${id} .stmt-info-right { flex: 1; min-width: 0; }
    #${id} .stmt-aside {
      font-size: ${isPdf ? "9pt" : "11px"};
      border: 1px solid #e5e7eb;
      border-radius: ${isPdf ? "1mm" : "4px"};
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    #${id} .stmt-aside-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: ${isPdf ? "4mm" : "16px"};
      padding: ${isPdf ? "1.5mm 3mm" : "6px 12px"};
      border-bottom: 1px solid #f1f5f9;
    }
    #${id} .stmt-aside-row:last-child { border-bottom: none; }
    #${id} .stmt-aside-label {
      color: #6b7280;
      font-size: ${isPdf ? "7.5pt" : "10px"};
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
      flex-shrink: 0;
    }
    #${id} .stmt-aside-value {
      color: #111827;
      font-weight: 600;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    /* ── Statement table ── */
    #${id} table.stmt-items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: ${isPdf ? "9pt" : "12px"};
      margin-bottom: ${isPdf ? "5mm" : "20px"};
    }
    #${id} table.stmt-items thead th {
      padding: ${isPdf ? "2.5mm 2mm" : "10px 8px"};
      font-weight: 600;
      font-size: ${isPdf ? "8pt" : "11px"};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      vertical-align: middle;
      background: ${styleConfig.tableHeaderBg};
      color: ${styleConfig.tableHeaderColor};
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #${id} table.stmt-items tbody td {
      padding: ${isPdf ? "3mm 2mm" : "10px 8px"};
      border-bottom: 1px solid #e5e7eb;
      vertical-align: middle;
    }
    #${id} table.stmt-items tbody tr.opening-row td {
      background: #f1f5f9;
      font-weight: 500;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #${id} table.stmt-items tbody tr.alt-row td {
      background: #f8fafc;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #${id} .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    #${id} .type-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: ${isPdf ? "7pt" : "10px"};
      font-weight: 500;
      white-space: nowrap;
    }
    #${id} .type-inv  { background: #dbeafe; color: #1e40af; }
    #${id} .type-cn   { background: #fef3c7; color: #92400e; }
    #${id} .type-pmt  { background: #d1fae5; color: #065f46; }
    #${id} .bal-owed  { color: #dc2626; font-weight: 600; }
    #${id} .bal-credit { color: #16a34a; font-weight: 600; }
    #${id} .bal-zero  { color: #6b7280; font-weight: 600; }

    /* ── Totals ── */
    #${id} .stmt-totals {
      border-top: 2px solid #e5e7eb;
      padding-top: ${isPdf ? "4mm" : "16px"};
      display: flex;
      justify-content: flex-end;
      margin-bottom: ${isPdf ? "5mm" : "20px"};
      break-inside: avoid;
      page-break-inside: avoid;
    }
    #${id} .totals-inner { width: ${isPdf ? "70mm" : "280px"}; }
    #${id} .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: ${isPdf ? "9pt" : "13px"};
      margin-bottom: ${isPdf ? "1.5mm" : "6px"};
    }
    #${id} .totals-row .lbl { color: #6b7280; }
    #${id} .totals-row .val { font-weight: 500; white-space: nowrap; font-variant-numeric: tabular-nums; }
    #${id} .closing-row {
      display: flex;
      justify-content: space-between;
      margin-top: ${isPdf ? "2.5mm" : "10px"};
      padding-top: ${isPdf ? "2.5mm" : "10px"};
      border-top: 2px solid #e5e7eb;
      font-size: ${isPdf ? "11pt" : "16px"};
      font-weight: 700;
      break-inside: avoid;
    }
    #${id} .closing-row.bal-owed  { border-top-color: #dc2626; }
    #${id} .closing-row.bal-credit { border-top-color: #16a34a; }
    #${id} .closing-row.bal-zero  { border-top-color: #6b7280; }

    /* ── Banking ── */
    #${id} .banking {
      margin-top: ${isPdf ? "5mm" : "20px"};
      padding-top: ${isPdf ? "4mm" : "16px"};
      border-top: 1px solid #e5e7eb;
      font-size: ${isPdf ? "9pt" : "13px"};
      color: #374151;
      line-height: 1.6;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    #${id} .banking .line { margin: ${isPdf ? "0.5mm 0" : "2px 0"}; }
    #${id} .banking .line .lbl { color: #6b7280; }

    /* ── Footer ── */
    #${id} .footer {
      margin-top: ${isPdf ? "8mm" : "32px"};
      padding-top: ${isPdf ? "4mm" : "14px"};
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: ${isPdf ? "8.5pt" : "10px"};
      color: #6b7280;
      line-height: 1.4;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* ── Style: modern (Split Header) ── */
    ${
      templateStyle === "modern"
        ? `
      /* Modern: zero-padding header cell — panels handle their own inset */
      #${id} .stmt-header-cell { padding: 0; }

      /* Header: no own background — left/right panels carry their own */
      #${id} .header {
        background: transparent;
        padding: 0;
        gap: 0;
        align-items: stretch;
        height: auto;
        min-height: unset;
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
        min-height: ${isPdf ? "28mm" : "110px"};
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
      /* Doc title — large white on brand-color panel */
      #${id} .doc-title {
        color: #ffffff !important;
        font-weight: 900;
        letter-spacing: 0.08em;
        font-size: ${isPdf ? "14pt" : "20px"};
        text-align: right;
        text-transform: uppercase;
        margin: 0;
        line-height: 1.25;
        word-break: break-word;
      }
      /* Subtitle — semi-transparent white on brand panel */
      #${id} .doc-subtitle { color: rgba(255,255,255,0.72); }
      /* Full-width brand-color divider (cell has 0 padding so this IS edge-to-edge) */
      #${id} .divider {
        display: block;
        border: none;
        border-top: ${isPdf ? "3pt" : "4px"} solid ${primary};
        margin: 0 0 ${isPdf ? "5mm" : "20px"} 0;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Statement aside — brand top-border (echoes the divider) */
      #${id} .stmt-aside {
        border: 1px solid #e5e7eb;
        border-top: ${isPdf ? "3pt" : "3px"} solid ${primary};
        border-radius: ${isPdf ? "0 0 1mm 1mm" : "0 0 4px 4px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .stmt-aside-row { border-bottom-color: ${primary}18; }
      #${id} .stmt-aside-label { color: #6b7280; }
      #${id} .stmt-aside-value { color: ${primary}; font-weight: 600; }
      #${id} table.stmt-items thead th { letter-spacing: 0.07em; }
      /* Alt rows — brand-tinted (matches invoice template) */
      #${id} table.stmt-items tbody tr.alt-row td {
        background: ${primary}0f;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Opening balance row — brand tinted */
      #${id} table.stmt-items tbody tr.opening-row td {
        background: ${primary}12;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      /* Banking — modern */
      #${id} .banking {
        margin-top: ${isPdf ? "4mm" : "16px"};
        background: ${primary}0c;
        border: 1px solid ${primary}30;
        border-top: none;
        padding: ${isPdf ? "2.5mm 4mm" : "10px 16px"};
        border-radius: ${isPdf ? "1mm" : "4px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .banking .section-label { color: ${primary}; font-weight: 700; margin-bottom: ${isPdf ? "1.5mm" : "6px"}; }
    `
        : ""
    }

    /* ── Style: professional — top border ── */
    ${
      templateStyle === "professional"
        ? `
      #${id} .header {
        background: ${styleConfig.headerBg};
        padding: ${isPdf ? `5mm 0` : "20px 0"};
        border-top: ${styleConfig.headerBorderStyle};
        height: auto;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .doc-title { color: ${styleConfig.brandColor}; font-weight: 800; letter-spacing: 0.1em; }
      #${id} .stmt-aside {
        border-color: ${primary}20;
        border-top: ${isPdf ? "2pt" : "3px"} solid ${primary};
        border-radius: ${isPdf ? "0 0 1mm 1mm" : "0 0 4px 4px"};
        background: ${primary}04;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .stmt-aside-row { border-bottom-color: ${primary}12; }
      #${id} .stmt-aside-value { color: ${primary}; }
      #${id} table.stmt-items thead th { letter-spacing: 0.07em; }
      #${id} .stmt-totals .totals-inner {
        background: ${primary}04;
        border: 1px solid ${primary}18;
        border-radius: ${isPdf ? "1.5mm" : "6px"};
        padding: ${isPdf ? "2mm 3mm" : "8px 12px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} table.stmt-items tbody tr.alt-row td {
        background: ${styleConfig.rowAltBg};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .banking {
        margin-top: ${isPdf ? "4mm" : "16px"};
        border: 1px solid ${primary}22;
        border-top: none;
        padding: ${isPdf ? "2.5mm 3mm" : "10px 12px"};
        background: ${primary}06;
        border-radius: ${isPdf ? "1mm" : "4px"};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .banking .section-label { color: ${primary}; font-weight: 700; }
    `
        : ""
    }

    /* ── Style: minimalist ── */
    ${
      templateStyle === "minimalist"
        ? `
      #${id} .header {
        background: transparent !important;
        border: none;
        border-bottom: 1px solid #ececec;
        height: auto;
        padding: ${isPdf ? `5mm 0 4mm` : "20px 0 16px"};
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
      #${id} .section-label { color: #9ca3af; font-weight: 400; letter-spacing: 0.08em; }
      #${id} table.stmt-items thead th {
        background: transparent !important;
        border-bottom: 1px solid #d1d5db;
        color: #4b5563;
        font-weight: 600;
        letter-spacing: 0.07em;
      }
      #${id} table.stmt-items tbody td {
        padding: ${isPdf ? "3.5mm 2mm" : "12px 8px"};
        border-bottom: 1px solid #e5e7eb;
      }
      /* Subtle row separation for minimalist — avoids pure-transparent blur */
      #${id} table.stmt-items tbody tr.alt-row td {
        background: #f9fafb;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .stmt-totals { border-top-color: #e5e7eb; }
      #${id} .banking {
        margin-top: ${isPdf ? "4mm" : "16px"};
        padding: ${isPdf ? "3mm" : "12px"};
        border: 1px solid #e5e7eb;
        border-top: none;
        border-radius: ${isPdf ? "1mm" : "4px"};
        background: #fafafa !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .stmt-aside {
        border-color: #e5e7eb;
        background: #fafafa;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .stmt-aside-row { border-bottom-color: #efefef; }
      #${id} .stmt-aside-label { color: #9ca3af; letter-spacing: 0.08em; }
      #${id} .stmt-aside-value { color: #374151; }
      #${id} .banking .section-label { color: #9ca3af; font-weight: 400; letter-spacing: 0.1em; }
      #${id} .banking .line .lbl { color: #9ca3af; }
      #${id} .footer { text-align: left; }
      /* Subtitle — restrained, lighter weight */
      #${id} .doc-subtitle { color: #9ca3af; font-weight: 300; letter-spacing: 0.15em; }
      /* Type badges — plain text, no coloured pill */
      #${id} .type-badge { background: transparent !important; color: #6b7280; padding: 0; font-weight: 400; letter-spacing: 0.06em; }
      #${id} .type-inv, #${id} .type-cn, #${id} .type-pmt { background: transparent !important; color: #6b7280; }
    `
        : ""
    }

    @media print {
      html, body { margin: 0; padding: 0; width: 210mm; }
      #${id}.statement-page { width: 210mm; min-height: 297mm; }
      #${id} .stmt-repeat-header { display: table-header-group !important; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      /* Only avoid breaks on inner item rows — outer wrapper rows must allow breaks */
      #${id} table.stmt-items tr,
      #${id} table.stmt-items td,
      #${id} table.stmt-items th { break-inside: avoid; page-break-inside: avoid; }
      #${id} .stmt-page-wrap > tbody > tr,
      #${id} .stmt-body-cell { break-inside: auto !important; page-break-inside: auto !important; }
      #${id} .stmt-totals, #${id} .banking { break-inside: avoid; page-break-inside: avoid; }
    }
  `;

  const balanceClass = (amount: number) => (amount > 0 ? "bal-owed" : amount < 0 ? "bal-credit" : "bal-zero");

  return (
    <div id={id} className="statement-page">
      <style dangerouslySetInnerHTML={{ __html: embeddedStyles }} />
      {variant === "pdf" && <style dangerouslySetInnerHTML={{ __html: PDF_PRINT_STYLES }} />}

      {/*
        Outer <table> with <thead> — the only reliable cross-browser way to repeat
        a decorative header on every page of a multi-page print/PDF document.
        <thead> with display:table-header-group repeats at the top of each page.
      */}
      <table className="stmt-page-wrap">
        <thead className="stmt-repeat-header">
          <tr>
            <td className="stmt-header-cell">
              {/* Full decorative header — repeats on every printed page */}
              <div className="header">
                <div className="header-left">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="logo" crossOrigin="anonymous" />
                  ) : (
                    <div style={{ height: isPdf ? "18mm" : 60 }} />
                  )}
                  <div className="company">
                    {companySettings?.name && <strong>{companySettings.name}</strong>}
                    {companyAddressLines.map((l, idx) => (
                      <div key={idx}>{l}</div>
                    ))}
                    {companySettings?.email && <div>{companySettings.email}</div>}
                    {companySettings?.phone && <div>{companySettings.phone}</div>}
                    {companySettings?.taxId && <div>VAT: {companySettings.taxId}</div>}
                  </div>
                </div>
                <div className="header-right">
                  <div className="doc-title">STATEMENT</div>
                  <div className="doc-subtitle">
                    {statementType === "outstanding" ? "Outstanding" : "Activity"}
                  </div>
                </div>
              </div>
              <hr className="divider" />
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td className="stmt-body-cell">
              <div className="stmt-body">
                <div className="stmt-content">

                  {/* INFO ROW — Statement For (left) + Statement reference aside (right) */}
                  <div className="stmt-info-row">
                    <div className="stmt-info-left">
                      <div className="stmt-for">
                        <div className="section-label">Statement For</div>
                        <div className="customer-name">{customer.name}</div>
                        <div className="customer-info">
                          {customer.email && <div>{customer.email}</div>}
                          {customer.address && <div style={{ whiteSpace: "pre-line" }}>{customer.address}</div>}
                          {customer.vat_number && <div>VAT: {customer.vat_number}</div>}
                        </div>
                      </div>
                    </div>
                    <div className="stmt-info-right">
                      <div className="stmt-aside">
                        <div className="stmt-aside-row">
                          <span className="stmt-aside-label">Statement Date</span>
                          <span className="stmt-aside-value">{format(new Date(), "dd/MM/yyyy")}</span>
                        </div>
                        <div className="stmt-aside-row">
                          <span className="stmt-aside-label">Period From</span>
                          <span className="stmt-aside-value">{format(dateRange.from, "dd/MM/yyyy")}</span>
                        </div>
                        <div className="stmt-aside-row">
                          <span className="stmt-aside-label">Period To</span>
                          <span className="stmt-aside-value">{format(dateRange.to, "dd/MM/yyyy")}</span>
                        </div>
                        <div className="stmt-aside-row">
                          <span className="stmt-aside-label">Type</span>
                          <span className="stmt-aside-value">{statementType === "outstanding" ? "Outstanding" : "Activity"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* STATEMENT TABLE */}
                  <table className="stmt-items">
                    <colgroup>
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "38%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "13%" }} />
                      <col style={{ width: "13%" }} />
                      <col style={{ width: "14%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Date</th>
                        <th style={{ textAlign: "left" }}>Description</th>
                        <th style={{ textAlign: "center" }}>Type</th>
                        <th className="num">Debit</th>
                        <th className="num">Credit</th>
                        <th className="num">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Opening balance row */}
                      {statementType === "activity" && (
                        <tr className="opening-row">
                          <td>{format(dateRange.from, "dd/MM/yyyy")}</td>
                          <td colSpan={4}>Opening Balance</td>
                          <td className={`num ${balanceClass(openingBalance)}`}>{formatBalance(openingBalance)}</td>
                        </tr>
                      )}

                      {/* Transaction rows */}
                      {statementLines.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>
                            No transactions for this period.
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          let running = openingBalance;
                          return statementLines.map((line, index) => {
                            running += line.debit - line.credit;
                            const typeLabel = line.type === "invoice" ? "INV" : line.type === "credit_note" ? "CN" : "PMT";
                            const typeClass =
                              line.type === "invoice" ? "type-inv" : line.type === "credit_note" ? "type-cn" : "type-pmt";
                            return (
                              <tr key={line.id} className={index % 2 !== 0 ? "alt-row" : ""}>
                                <td>{format(new Date(line.date), "dd/MM/yyyy")}</td>
                                <td style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                  {line.description}
                                  {line.reference && (
                                    <span style={{ color: "#9ca3af", marginLeft: "0.5rem" }}>({line.reference})</span>
                                  )}
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  <span className={`type-badge ${typeClass}`}>{typeLabel}</span>
                                </td>
                                <td className="num">{formatDebit(line.debit)}</td>
                                <td className="num">{formatCredit(line.credit)}</td>
                                <td className={`num ${balanceClass(running)}`}>{formatBalance(running)}</td>
                              </tr>
                            );
                          });
                        })()
                      )}
                    </tbody>
                  </table>

                  {/* TOTALS */}
                  <div className="stmt-totals">
                    <div className="totals-inner">
                      <div className="totals-row">
                        <span className="lbl">Total Debits:</span>
                        <span className="val">{money(totalDebits)}</span>
                      </div>
                      <div className="totals-row">
                        <span className="lbl">Total Credits:</span>
                        <span className="val">{formatCredit(totalCredits)}</span>
                      </div>
                      <div className={`closing-row ${balanceClass(closingBalance)}`}>
                        <span>{closingBalance > 0 ? "Balance Due:" : closingBalance < 0 ? "Credit Balance:" : "Balance:"}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatBalance(closingBalance)}</span>
                      </div>
                      {closingBalance < 0 && (
                        <div
                          style={{ fontSize: isPdf ? "8pt" : "10px", color: "#16a34a", marginTop: "4px", textAlign: "right" }}
                        >
                          This is a credit balance in your favour.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BANKING DETAILS */}
                  {showBanking && bankingSettings && (bankingSettings.bankName || bankingSettings.iban) && (
                    <div className="banking">
                      <div className="section-label">Banking Details</div>
                      {bankingSettings.bankName && (
                        <div className="line">
                          <span className="lbl">Bank: </span>
                          {bankingSettings.bankName}
                        </div>
                      )}
                      {bankingSettings.accountName && (
                        <div className="line">
                          <span className="lbl">Account Name: </span>
                          {bankingSettings.accountName}
                        </div>
                      )}
                      {bankingSettings.iban && (
                        <div className="line">
                          <span className="lbl">IBAN: </span>
                          {bankingSettings.iban}
                        </div>
                      )}
                      {bankingSettings.swiftCode && (
                        <div className="line">
                          <span className="lbl">SWIFT/BIC: </span>
                          {bankingSettings.swiftCode}
                        </div>
                      )}
                      {bankingSettings.accountNumber && !bankingSettings.iban && (
                        <div className="line">
                          <span className="lbl">Account Number: </span>
                          {bankingSettings.accountNumber}
                        </div>
                      )}
                    </div>
                  )}

                </div>{/* end stmt-content */}

                {/* FOOTER */}
                <div className="footer">
                  Statement generated on {format(new Date(), "dd MMMM yyyy")} • {companySettings?.name || "Your Company"} • All
                  amounts in EUR.
                </div>

              </div>{/* end stmt-body */}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

/* ===================== LEGACY COMPAT (keep StatementModal working) ===================== */

export interface LegacyStatementData {
  customer: StatementCustomer;
  invoices: Array<{
    id: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    status: string;
    total_amount: number;
    amount: number;
    vat_amount: number;
    paid_amount?: number;
  }>;
  creditNotes: Array<{
    id: string;
    credit_note_number: string;
    credit_note_date: string;
    amount: number;
    vat_rate: number;
    reason: string;
    invoice_id?: string | null;
  }>;
  payments: Array<{
    id: string;
    payment_date: string;
    amount: number;
    method: string | null;
    invoice_id: string;
  }>;
  company: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    addressLine1?: string;
    addressLine2?: string;
    locality?: string;
    postCode?: string;
    city?: string;
    country?: string;
    vat_number?: string;
    logo?: string;
  };
  options: {
    dateFrom: Date;
    dateTo: Date;
    statementType: "outstanding" | "activity";
    includeCreditNotes: boolean;
    includeVatBreakdown: boolean;
  };
  generatedAt: Date;
}

export function convertLegacyStatementData(data: LegacyStatementData): {
  customer: StatementCustomer;
  companySettings: CompanySettings;
  statementLines: StatementLine[];
  dateRange: DateRange;
  openingBalance: number;
  closingBalance: number;
  statementType: "outstanding" | "activity";
} {
  const { customer, company, invoices, creditNotes, payments, options } = data;
  const lines: StatementLine[] = [];

  invoices.forEach((inv) => {
    lines.push({
      id: inv.id,
      date: inv.invoice_date,
      description: `Invoice ${inv.invoice_number}`,
      type: "invoice",
      reference: inv.invoice_number,
      debit: inv.total_amount,
      credit: 0,
    });
  });

  if (options.includeCreditNotes) {
    creditNotes.forEach((cn) => {
      const totalAmount = cn.amount + cn.amount * cn.vat_rate;
      lines.push({
        id: cn.id,
        date: cn.credit_note_date,
        description: `Credit Note ${cn.credit_note_number}`,
        type: "credit_note",
        reference: cn.credit_note_number,
        debit: 0,
        credit: totalAmount,
      });
    });
  }

  payments.forEach((pmt) => {
    lines.push({
      id: pmt.id,
      date: pmt.payment_date,
      description: `Payment${pmt.method ? ` (${pmt.method})` : ""}`,
      type: "payment",
      reference: "",
      debit: 0,
      credit: pmt.amount,
    });
  });

  lines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);

  return {
    customer,
    companySettings: {
      name: company.name,
      email: company.email,
      phone: company.phone,
      address: company.address,
      addressLine1: company.addressLine1,
      addressLine2: company.addressLine2,
      locality: company.locality,
      postCode: company.postCode,
      city: company.city,
      country: company.country,
      taxId: company.vat_number,
      logo: company.logo,
    },
    statementLines: lines,
    dateRange: { from: options.dateFrom, to: options.dateTo },
    openingBalance: 0,
    closingBalance: totalDebits - totalCredits,
    statementType: options.statementType,
  };
}

export type { LegacyStatementData as StatementData };
export type StatementInvoice = LegacyStatementData["invoices"][0];
export type StatementCreditNote = LegacyStatementData["creditNotes"][0];
export type StatementPayment = LegacyStatementData["payments"][0];
