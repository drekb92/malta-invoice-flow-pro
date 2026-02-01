import React from "react";

/* ===================== TYPES ===================== */

export interface CompanySettings {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  locality?: string;
  postCode?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  registrationNumber?: string;
  logo?: string;
}

export interface BankingSettings {
  bankName?: string;
  accountName?: string;
  swiftCode?: string;
  iban?: string;
}

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
    address?: string; // Legacy single address field
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

// Simplified to 3 core styles
export type TemplateStyle = 'modern' | 'professional' | 'minimalist';

export interface TemplateSettings {
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  fontSize?: string; // e.g. "12px"
  layout?: string;
  headerLayout?: string;
  tableStyle?: string;
  totalsStyle?: string;
  bankingVisibility?: boolean;
  bankingStyle?: string;
  vatSummaryVisibility?: boolean;
  style?: TemplateStyle;
  // NOTE: margins exist in DB but are intentionally ignored (locked)
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
}

export interface UnifiedInvoiceLayoutProps {
  invoiceData: InvoiceData;
  companySettings?: CompanySettings;
  bankingSettings?: BankingSettings;
  templateSettings?: TemplateSettings;
  variant?: "preview" | "pdf";
  id?: string;
  documentType?: DocumentType;
  debug?: boolean;
}

/* ===================== UTILITIES ===================== */

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB");
};

const money = (val: number) =>
  `€${Number(val || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const percent = (val: number) => {
  const normalized = Number(val || 0);
  // Normalize: if value is <= 1 (like 0.18), multiply by 100 to get 18%
  const displayRate = normalized > 1 ? normalized : normalized * 100;
  return `${Math.round(displayRate)}%`;
};

const mul = (a: number, b: number) => Number(a || 0) * Number(b || 0);

/**
 * Calculate readable text color based on background luminance.
 * Returns white for dark backgrounds, a dark version of the color for light backgrounds.
 */
const getContrastTextColor = (hexColor: string): string => {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate relative luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white for dark backgrounds, dark color for light backgrounds
  return luminance > 0.5 ? '#1f2937' : '#ffffff';
};

/**
 * Darken a hex color by a percentage (for readable text on light backgrounds)
 */
const darkenColor = (hexColor: string, percent: number): string => {
  const hex = hexColor.replace('#', '');
  const r = Math.max(0, Math.floor(parseInt(hex.substring(0, 2), 16) * (1 - percent / 100)));
  const g = Math.max(0, Math.floor(parseInt(hex.substring(2, 4), 16) * (1 - percent / 100)));
  const b = Math.max(0, Math.floor(parseInt(hex.substring(4, 6), 16) * (1 - percent / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

/* ===================== CONSTANTS ===================== */

// Locked margins (user requested “standard, not editable”)
const STANDARD_MARGIN_MM = 15;

/* ===================== COMPONENT ===================== */

export const UnifiedInvoiceLayout = ({
  invoiceData,
  companySettings,
  bankingSettings,
  templateSettings,
  variant = "preview",
  id = "invoice-preview-root",
  documentType = "INVOICE",
}: UnifiedInvoiceLayoutProps) => {
  const templateStyle = templateSettings?.style || 'modern';
  
  // Standard sans-serif font stack for consistency
  const STANDARD_FONT_STACK = 'Inter, Helvetica Neue, Helvetica, Arial, sans-serif';
  
  // Determine if rendering for PDF (must be defined before getStyleConfig)
  const isPdf = variant === "pdf";
  
  // Get style-specific settings
  const getStyleConfig = () => {
    const brandColor = templateSettings?.primaryColor || '#1e3a5f';
    // Calculate contrast-aware text color for the brand color
    const brandTextColor = getContrastTextColor(brandColor);
    // Darker version of brand color for text on light backgrounds
    const brandDarkColor = darkenColor(brandColor, 20);
    
    switch (templateStyle) {
      case 'modern':
        // MODERN: Solid brand color header with white/contrast text
        return {
          fontFamily: STANDARD_FONT_STACK,
          headerBg: brandColor,
          headerTextColor: brandTextColor,
          headerBorderStyle: 'none',
          tableBorder: '1px solid #e5e7eb',
          tableHeaderBg: brandColor,
          tableHeaderColor: brandTextColor,
          rowAltBg: '#f8fafc',
          totalBg: brandColor,
          totalTextColor: brandTextColor,
          brandColor,
          brandDarkColor,
        };
      case 'professional':
        // PROFESSIONAL: White header with 4px TOP border in brand color
        return {
          fontFamily: STANDARD_FONT_STACK,
          headerBg: '#ffffff',
          headerTextColor: '#111827',
          headerBorderStyle: `${isPdf ? '1.2mm' : '4px'} solid ${brandColor}`,
          tableBorder: '1px solid #e5e7eb',
          tableHeaderBg: '#f9fafb',
          tableHeaderColor: '#374151',
          tableHeaderBorder: `2px solid ${brandColor}`,
          rowAltBg: '#f9fafb',
          totalBg: 'transparent',
          totalTextColor: brandColor,
          brandColor,
          brandDarkColor,
        };
      case 'minimalist':
        // MINIMALIST: No colored header/borders, brand color ONLY for Total Amount
        return {
          fontFamily: STANDARD_FONT_STACK,
          headerBg: 'transparent',
          headerTextColor: '#374151',
          headerBorderStyle: 'none',
          tableBorder: 'none',
          tableHeaderBg: 'transparent',
          tableHeaderColor: '#9ca3af',
          rowAltBg: 'transparent',
          totalBg: 'transparent',
          totalTextColor: brandColor, // Only place brand color is used
          brandColor,
          brandDarkColor,
        };
      default:
        return {
          fontFamily: STANDARD_FONT_STACK,
          headerBg: 'transparent',
          headerTextColor: '#111827',
          headerBorderStyle: 'none',
          tableBorder: '1px solid #e5e7eb',
          tableHeaderBg: '#f9fafb',
          tableHeaderColor: '#374151',
          rowAltBg: '#f9fafb',
          totalBg: 'transparent',
          totalTextColor: '#111827',
          brandColor,
          brandDarkColor,
        };
    }
  };

  const styleConfig = getStyleConfig();
  const primary = templateSettings?.primaryColor || "var(--color-primary, #111827)";
  const accent = templateSettings?.accentColor || "var(--color-accent, #26A65B)";
  const fontFamily = templateSettings?.fontFamily || styleConfig.fontFamily;

  const getAbsoluteLogoUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith("http")) return url;
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${url}`;
  };

  const logoUrl = getAbsoluteLogoUrl(companySettings?.logo);

  const showBanking = (templateSettings?.bankingVisibility ?? true) && !!bankingSettings;
  const showVatSummary = templateSettings?.vatSummaryVisibility ?? false; // Hidden by default

  // Standardized font sizes for all templates
  
  const fontSize = {
    body: isPdf ? '10pt' : '12px',
    small: isPdf ? '9pt' : '11px',
    tiny: isPdf ? '8pt' : '10px',
    heading: isPdf ? '18pt' : '26px',
    subheading: isPdf ? '11pt' : '14px',
    totalLabel: isPdf ? '11pt' : '13px',
  };

  const embeddedStyles = `
    /* A4 page setup with standard margins */
    @page { 
      size: A4; 
      margin: 15mm; 
    }

    /* Force exact colors for print */
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    /* Reset – scoped to the invoice only */
    #${id}, #${id} * { box-sizing: border-box; }
    #${id} { background: #fff; }

    /* Canvas - A4 dimensions with consistent sans-serif font */
    #${id}.invoice-page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      color: ${primary};
      font-family: ${fontFamily};
      font-size: ${fontSize.body};
      line-height: 1.4;
    }

    /* Inner (locked margins) */
    #${id} .invoice-inner {
      padding: var(--m-top) var(--m-right) var(--m-bottom) var(--m-left);
      min-height: 297mm;
      display: flex;
      flex-direction: column;
    }

    /* Preview framing */
    ${
      variant === "preview"
        ? `
      #${id}.invoice-page {
        width: min(900px, calc(100vw - 32px));
        min-height: unset;
        border: 1px solid #e5e7eb;
        box-shadow: 0 8px 30px rgba(0,0,0,0.06);
        border-radius: 12px;
        overflow: hidden;
      }
      #${id} .invoice-inner {
        min-height: unset;
        padding: 24px;
      }
    `
        : ""
    }

    /* Header - Standardized 40mm height */
    #${id} .header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
      min-height: ${isPdf ? '40mm' : '150px'};
      height: ${isPdf ? '40mm' : '150px'};
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
      margin-bottom: ${isPdf ? '2mm' : '8px'};
    }
    #${id} .company {
      font-size: ${fontSize.small};
      color: #4b5563;
      line-height: 1.4;
    }
    #${id} .company strong { color: #111827; font-weight: 700; }
    #${id} .doc-title {
      font-size: ${fontSize.heading};
      font-weight: 800;
      letter-spacing: 0.08em;
      color: ${accent};
      margin: 0 0 ${isPdf ? '2mm' : '8px'} 0;
      text-transform: uppercase;
    }
    #${id} .meta {
      font-size: ${fontSize.small};
      color: #4b5563;
      line-height: 1.4;
    }
    #${id} .meta .row { display: flex; justify-content: flex-end; gap: ${isPdf ? '2mm' : '8px'}; }
    #${id} .meta .label { color: #6b7280; }
    #${id} .meta .value { color: #111827; font-weight: 600; }

    #${id} .divider {
      border: 0;
      border-top: 1px solid #e5e7eb;
      margin: ${isPdf ? '4mm 0 5mm 0' : '14px 0 16px 0'};
    }

    /* Address Grid - Bill To / Ship To aligned horizontally */
    #${id} .address-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: ${isPdf ? '8mm' : '32px'};
      margin-bottom: ${isPdf ? '5mm' : '20px'};
    }
    #${id} .address-block {
      min-width: 0;
    }

    /* Sections */
    #${id} .section-label {
      font-size: ${fontSize.tiny};
      font-weight: 700;
      color: #6b7280;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: ${isPdf ? '1.5mm' : '6px'};
    }
    #${id} .billto { margin-bottom: ${isPdf ? '4mm' : '16px'}; }
    #${id} .customer-name {
      font-size: ${fontSize.subheading};
      font-weight: 700;
      color: #111827;
      margin-bottom: ${isPdf ? '1mm' : '4px'};
    }
    #${id} .customer-info {
      font-size: ${fontSize.small};
      color: #4b5563;
      line-height: 1.4;
    }
    #${id} .customer-info div { margin: ${isPdf ? '0.5mm 0' : '2px 0'}; }

    /* Table */
    #${id} table.items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: ${isPdf ? '3mm' : '10px'};
      font-size: ${fontSize.small};
    }
    #${id} table.items thead th {
      padding: ${isPdf ? '2.5mm 2mm' : '9px 8px'};
      border-bottom: 1px solid #e5e7eb;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: ${fontSize.tiny};
      color: #6b7280;
      background: var(--th-bg, #f9fafb);
    }
    #${id} table.items tbody td {
      padding: ${isPdf ? '2.5mm 2mm' : '9px 8px'};
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    #${id} .desc {
      color: #111827;
      font-weight: 500;
      white-space: pre-wrap;
      word-break: break-word;
    }
    #${id} .num {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      color: #374151;
    }
    #${id} .muted { color: #6b7280; }

    /* Tax Invoice Label */
    #${id} .tax-invoice-label {
      font-size: ${fontSize.tiny};
      font-weight: 700;
      color: #6b7280;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: ${isPdf ? '1mm' : '4px'};
    }

    /* Customer VAT Number - Prominent Display */
    #${id} .customer-vat {
      margin-top: ${isPdf ? '2mm' : '8px'};
      padding: ${isPdf ? '2mm 3mm' : '6px 10px'};
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: ${isPdf ? '1mm' : '4px'};
      display: inline-block;
    }
    #${id} .customer-vat .vat-label {
      font-size: ${fontSize.tiny};
      color: #6b7280;
      font-weight: 600;
      margin-right: ${isPdf ? '2mm' : '6px'};
    }
    #${id} .customer-vat .vat-value {
      font-size: ${fontSize.small};
      color: #111827;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    /* VAT Summary Table - Compact, appears BELOW Grand Total */
    #${id} .vat-summary-section {
      margin-top: ${isPdf ? '4mm' : '16px'};
      break-inside: avoid;
      page-break-inside: avoid;
      background: #f8fafc !important;
      border: 1px solid #e2e8f0 !important;
      border-radius: ${isPdf ? '1.5mm' : '6px'};
      padding: ${isPdf ? '3mm' : '12px'};
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #${id} .vat-summary-section .section-label {
      margin-bottom: ${isPdf ? '1.5mm' : '6px'};
      color: #64748b !important;
      font-size: ${isPdf ? '7pt' : '9px'};
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    #${id} table.vat-summary {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: ${isPdf ? '9pt' : '11px'};
      background: transparent !important;
    }
    #${id} table.vat-summary colgroup col:first-child { width: 34%; }
    #${id} table.vat-summary colgroup col:nth-child(2) { width: 33%; }
    #${id} table.vat-summary colgroup col:nth-child(3) { width: 33%; }
    #${id} table.vat-summary thead th {
      padding: ${isPdf ? '1.5mm 1.5mm' : '5px 6px'};
      border-bottom: 1px solid #cbd5e1;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: ${isPdf ? '7pt' : '9px'};
      color: #64748b !important;
      background: transparent !important;
    }
    #${id} table.vat-summary tbody td {
      padding: ${isPdf ? '1.5mm 1.5mm' : '5px 6px'};
      border-bottom: 1px solid #e2e8f0;
      color: #334155 !important;
      font-weight: 500;
      background: transparent !important;
    }
    #${id} table.vat-summary tbody tr:last-child td {
      border-bottom: none;
    }
    #${id} table.vat-summary .vat-summary-total {
      font-weight: 600 !important;
      background: #e2e8f0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Totals */
    #${id} .totals {
      width: 45%;
      margin-left: auto;
      margin-top: ${isPdf ? '3mm' : '10px'};
      font-size: ${fontSize.small};
    }
    #${id} .totals .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: ${isPdf ? '3mm' : '10px'};
      padding: ${isPdf ? '1mm 0' : '4px 0'};
      align-items: center;
    }
    #${id} .totals .label { color: #6b7280; text-align: right; }
    #${id} .totals .value { text-align: right; font-weight: 700; color: #111827; }
    #${id} .totals .total {
      border-top: 1px solid #e5e7eb;
      margin-top: ${isPdf ? '1.5mm' : '6px'};
      padding-top: ${isPdf ? '2mm' : '8px'};
    }
    #${id} .totals .total .label { font-size: ${fontSize.totalLabel}; font-weight: 800; color: #111827; }
    #${id} .totals .total .value { font-size: ${fontSize.totalLabel}; font-weight: 900; color: ${accent}; }

    /* Footer pinned for short invoices */
    #${id} .body { flex: 1; }
    #${id} .footer {
      margin-top: auto;
      padding-top: ${isPdf ? '4mm' : '14px'};
    }
    #${id} .banking {
      font-size: ${fontSize.small};
      line-height: 1.4;
      color: #4b5563;
    }
    #${id} .banking .line { margin: ${isPdf ? '0.5mm 0' : '2px 0'}; }
    #${id} .thanks {
      margin-top: ${isPdf ? '3mm' : '12px'};
      padding-top: ${isPdf ? '2.5mm' : '10px'};
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: ${fontSize.small};
      color: #6b7280;
      line-height: 1.4;
    }

    /* ============ STYLE-SPECIFIC OVERRIDES ============ */
    
    ${templateStyle === 'modern' ? `
      /* MODERN: Solid brand color header with white/contrast text */
      #${id} .header {
        background: ${styleConfig.headerBg};
        color: ${styleConfig.headerTextColor};
        padding: ${isPdf ? '5mm' : '20px'};
        margin: ${isPdf ? '-15mm -15mm 4mm -15mm' : '-24px -24px 16px -24px'};
        border-radius: 0;
        min-height: ${isPdf ? '40mm' : '150px'};
        height: auto;
        box-sizing: content-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .header .company,
      #${id} .header .company strong,
      #${id} .header .meta,
      #${id} .header .meta .label,
      #${id} .header .meta .value,
      #${id} .header .tax-invoice-label {
        color: ${styleConfig.headerTextColor};
      }
      #${id} .doc-title {
        color: ${styleConfig.headerTextColor};
        font-weight: 900;
      }
      #${id} table.items thead th {
        background: ${styleConfig.tableHeaderBg};
        color: ${styleConfig.tableHeaderColor};
        border-bottom: none;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} table.items tbody tr:nth-child(even) {
        background: ${styleConfig.rowAltBg};
      }
      #${id} .totals .total {
        background: ${styleConfig.totalBg};
        color: ${styleConfig.totalTextColor};
        padding: ${isPdf ? '2mm 3mm' : '8px 12px'};
        border-radius: ${isPdf ? '1mm' : '4px'};
        border-top: none;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .totals .total .label,
      #${id} .totals .total .value {
        color: ${styleConfig.totalTextColor};
      }
    ` : ''}

    ${templateStyle === 'professional' ? `
      /* PROFESSIONAL: White header with 4px TOP border in brand color */
      #${id} .header {
        background: ${styleConfig.headerBg};
        color: ${styleConfig.headerTextColor};
        padding: ${isPdf ? '5mm' : '20px'};
        margin: ${isPdf ? '-15mm -15mm 4mm -15mm' : '-24px -24px 16px -24px'};
        padding-left: ${isPdf ? '15mm' : '24px'};
        padding-right: ${isPdf ? '15mm' : '24px'};
        border-top: ${styleConfig.headerBorderStyle};
        min-height: ${isPdf ? '40mm' : '150px'};
        height: auto;
        box-sizing: content-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .header .company,
      #${id} .header .company strong {
        color: #111827;
      }
      #${id} .header .meta .label {
        color: #6b7280;
      }
      #${id} .header .meta .value {
        color: #111827;
      }
      #${id} .doc-title {
        color: ${styleConfig.brandColor};
        font-weight: 800;
      }
      #${id} .tax-invoice-label {
        color: #6b7280;
      }
      #${id} table.items thead th {
        background: ${styleConfig.tableHeaderBg};
        color: ${styleConfig.tableHeaderColor};
        border-bottom: ${styleConfig.tableHeaderBorder};
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} table.items tbody tr:nth-child(even) {
        background: ${styleConfig.rowAltBg};
      }
      #${id} .totals .total {
        border-top: 2px solid ${styleConfig.brandColor};
        padding: ${isPdf ? '2mm 0' : '8px 0'};
        margin-top: ${isPdf ? '2mm' : '8px'};
      }
      #${id} .totals .total .label {
        color: #111827;
        font-weight: 700;
      }
      #${id} .totals .total .value {
        color: ${styleConfig.totalTextColor};
        font-weight: 800;
      }
    ` : ''}

    ${templateStyle === 'minimalist' ? `
      /* MINIMALIST: No colored header/borders. Brand color ONLY for Total Amount */
      #${id}.invoice-page {
        background: #ffffff !important;
      }
      #${id} .invoice-inner {
        background: #ffffff !important;
      }
      #${id} .header {
        background: transparent !important;
        padding-bottom: ${isPdf ? '8mm' : '32px'};
        border: none !important;
      }
      #${id} .header .company,
      #${id} .header .company strong {
        color: #374151;
      }
      #${id} .header .meta .label {
        color: #9ca3af;
      }
      #${id} .header .meta .value {
        color: #374151;
      }
      #${id} .doc-title {
        font-weight: 400;
        letter-spacing: 0.15em;
        color: #6b7280;
        font-size: ${isPdf ? '14pt' : '20px'};
      }
      #${id} .tax-invoice-label {
        color: #9ca3af;
      }
      #${id} .divider {
        display: none;
      }
      #${id} .section-label {
        color: #9ca3af;
        font-weight: 400;
        letter-spacing: 0.12em;
      }
      #${id} table.items {
        margin-top: ${isPdf ? '6mm' : '24px'};
        background: #ffffff;
      }
      #${id} table.items thead th {
        background: transparent !important;
        border-bottom: 1px solid #e5e7eb;
        color: #9ca3af;
        font-weight: 500;
      }
      #${id} table.items tbody td {
        border-bottom: 1px solid #f3f4f6;
        background: #ffffff;
      }
      #${id} .totals {
        margin-top: ${isPdf ? '6mm' : '24px'};
        padding-top: ${isPdf ? '3mm' : '12px'};
        border-top: 1px solid #e5e7eb;
        background: transparent;
      }
      #${id} .totals .row .label {
        color: #6b7280;
      }
      #${id} .totals .row .value {
        color: #374151;
      }
      #${id} .totals .total {
        border-top: none;
        margin-top: ${isPdf ? '3mm' : '12px'};
        padding-top: ${isPdf ? '2mm' : '8px'};
      }
      #${id} .totals .total .label {
        font-weight: 600;
        color: #374151;
      }
      #${id} .totals .total .value {
        font-weight: 700;
        color: ${styleConfig.totalTextColor} !important;
      }
      #${id} .banking {
        margin-top: ${isPdf ? '6mm' : '24px'};
        background: transparent;
      }
      #${id} .thanks {
        border-top: 1px solid #f3f4f6;
        color: #9ca3af;
      }
      #${id} .vat-summary-section {
        background: #fafafa !important;
        border: 1px solid #f3f4f6 !important;
      }
    ` : ''}

    /* Print-specific overrides */
    @media print {
      html, body {
        margin: 0;
        padding: 0;
        width: 210mm;
        height: 297mm;
      }
      #${id}.invoice-page {
        width: 210mm;
        min-height: 297mm;
        page-break-after: always;
      }
      #${id} .invoice-inner {
        padding: 0; /* @page margin handles this */
      }
      /* Ensure table headers repeat */
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      /* Prevent row splits */
      tr, td, th {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      /* Keep sections together */
      .totals-section, .banking-section {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  `;

  // Locked margins via inline CSS vars (overrides any template-driven values)
  const lockedVars: React.CSSProperties = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...({
      ["--m-top" as any]: `${STANDARD_MARGIN_MM}mm`,
      ["--m-right" as any]: `${STANDARD_MARGIN_MM}mm`,
      ["--m-bottom" as any]: `${STANDARD_MARGIN_MM}mm`,
      ["--m-left" as any]: `${STANDARD_MARGIN_MM}mm`,
      ["--color-primary" as any]: templateSettings?.primaryColor || "#111827",
      ["--color-accent" as any]: templateSettings?.accentColor || "#26A65B",
      ["--font" as any]: templateSettings?.fontFamily || "Inter",
      ["--th-bg" as any]: (templateSettings as any)?.line_item_header_bg || "#f9fafb",
    } as any),
  };

  // Build company address lines using new structured fields or fallback to legacy
  const companyAddressLines: string[] = [];
  if (companySettings?.addressLine1) companyAddressLines.push(companySettings.addressLine1);
  if (companySettings?.addressLine2) companyAddressLines.push(companySettings.addressLine2);
  if (companySettings?.locality) companyAddressLines.push(companySettings.locality);
  if (companySettings?.postCode) companyAddressLines.push(companySettings.postCode);
  
  // Fallback to legacy address if new fields are empty
  if (companyAddressLines.length === 0) {
    if (companySettings?.address) companyAddressLines.push(companySettings.address);
    const cityLine = [companySettings?.zipCode, companySettings?.city].filter(Boolean).join(" ");
    if (cityLine) companyAddressLines.push(cityLine);
    if (companySettings?.country) companyAddressLines.push(companySettings.country);
  }

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
                <div className="tax-invoice-label">TAX INVOICE</div>
                <div className="doc-title">{documentType}</div>
                <div className="meta">
                  <div className="row">
                    <span className="label">No:</span>
                    <span className="value">{invoiceData.invoiceNumber}</span>
                  </div>
                  <div className="row">
                    <span className="label">Date:</span>
                    <span className="value">{formatDate(invoiceData.invoiceDate)}</span>
                  </div>
                  <div className="row">
                    <span className="label">Due:</span>
                    <span className="value">{formatDate(invoiceData.dueDate)}</span>
                  </div>
                </div>
              </div>
            </div>

            <hr className="divider" />

            {/* BILL TO (Ship To removed) */}
            <div className="address-block billto">
              <div className="section-label">Bill To</div>
              <div className="customer-name">{invoiceData.customer.name}</div>
              <div className="customer-info">
                {/* Structured address fields */}
                {invoiceData.customer.address_line1 && <div>{invoiceData.customer.address_line1}</div>}
                {invoiceData.customer.address_line2 && <div>{invoiceData.customer.address_line2}</div>}
                {invoiceData.customer.locality && <div>{invoiceData.customer.locality}</div>}
                {invoiceData.customer.post_code && <div>{invoiceData.customer.post_code}</div>}
                {/* Legacy address field fallback */}
                {!invoiceData.customer.address_line1 && invoiceData.customer.address && (
                  <div className="desc">{invoiceData.customer.address}</div>
                )}
                {/* VAT Number - inline with customer details */}
                {invoiceData.customer.vat_number && (
                  <div>VAT No: {invoiceData.customer.vat_number}</div>
                )}
              </div>
            </div>

            {/* ITEMS */}
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

            {/* TOTALS - Discount applied BEFORE VAT */}
            <div className="totals totals-section">
              {/* Subtotal (Net Amount) */}
              <div className="row">
                <div className="label">Subtotal</div>
                <div className="value">{money(invoiceData.totals.netTotal + (invoiceData.discount?.amount || 0))}</div>
              </div>
              
              {/* Discount (if any) */}
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

              {/* VAT (on taxable amount, after discount) */}
              <div className="row">
                <div className="label">VAT</div>
                <div className="value">{money(invoiceData.totals.vatTotal)}</div>
              </div>
              
              {/* Total */}
              <div className="row total">
                <div className="label">Total</div>
                <div className="value">{money(invoiceData.totals.grandTotal)}</div>
              </div>
            </div>

            {/* VAT SUMMARY TABLE - Compact layout BELOW totals (hidden by default) */}
            {showVatSummary && (() => {
              // Group items by VAT rate and calculate totals
              const vatGroups = invoiceData.items.reduce((acc, item) => {
                const rate = Number(item.vat_rate) || 0;
                const netAmount = mul(item.quantity, item.unit_price);
                if (!acc[rate]) {
                  acc[rate] = { netAmount: 0, vatAmount: 0 };
                }
                acc[rate].netAmount += netAmount;
                // Apply proportional discount if exists
                const discountRatio = invoiceData.discount?.amount 
                  ? invoiceData.discount.amount / (invoiceData.totals.netTotal + invoiceData.discount.amount)
                  : 0;
                const discountedNet = netAmount * (1 - discountRatio);
                const normalizedRate = rate > 1 ? rate / 100 : rate;
                const vatAmount = discountedNet * normalizedRate;
                acc[rate].vatAmount += vatAmount;
                return acc;
              }, {} as Record<number, { netAmount: number; vatAmount: number }>);

              const sortedRates = Object.keys(vatGroups)
                .map(Number)
                .sort((a, b) => a - b);

              // Only show if there are items
              if (sortedRates.length === 0) return null;

              // Calculate totals for the summary row
              const totalNet = sortedRates.reduce((sum, rate) => sum + vatGroups[rate].netAmount, 0);
              const totalVat = sortedRates.reduce((sum, rate) => sum + vatGroups[rate].vatAmount, 0);

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
                      {/* Total row */}
                      <tr className="vat-summary-total">
                        <td style={{ fontWeight: 600 }}>Total</td>
                        <td className="num" style={{ fontWeight: 600 }}>{money(totalNet)}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{money(totalVat)}</td>
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

            <div className="thanks">
              Thank you for your business
              <br />
              All amounts in EUR.
            </div>
          </div>
        </div>
      </div>
  );
};

export default UnifiedInvoiceLayout;
