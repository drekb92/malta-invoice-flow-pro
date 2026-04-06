/**
 * src/types/document.ts
 *
 * Single source of truth for all shared types used across document layouts.
 * Import from here in UnifiedInvoiceLayout, UnifiedStatementLayout, and
 * any other document-rendering component so they can never silently diverge.
 */

// ─── Company ────────────────────────────────────────────────────────────────

export interface DocumentCompanySettings {
  name?: string;
  email?: string;
  phone?: string;
  /** Legacy single-line address — kept for backward compat */
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

// ─── Banking ────────────────────────────────────────────────────────────────

export interface DocumentBankingSettings {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  branch?: string;
}

// ─── Template ───────────────────────────────────────────────────────────────

export type DocumentTemplateStyle = "modern" | "professional" | "minimalist";

/**
 * Full template settings shared by ALL document types.
 * Adding a field here automatically makes it available to every layout.
 */
export interface DocumentTemplateSettings {
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  fontSize?: string;
  layout?: string;
  headerLayout?: string;
  tableStyle?: string;
  totalsStyle?: string;
  bankingVisibility?: boolean;
  bankingStyle?: string;
  vatSummaryVisibility?: boolean;
  notesVisibility?: boolean;
  style?: DocumentTemplateStyle;
  includeVatBreakdown?: boolean;
  includePaymentInstructions?: boolean;
  /** Margins are intentionally locked to STANDARD_MARGIN_MM — these are ignored at render time */
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
}

// ─── Shared layout constants ─────────────────────────────────────────────────

/** A4 margin used on ALL document types — 15mm matches @page rule in PDF_PRINT_STYLES */
export const STANDARD_MARGIN_MM = 15;

/** Standard header height in PDF mode — keeps logo/company block identical across docs */
export const STANDARD_HEADER_HEIGHT_MM = 40;

/** Standard logo constraints in PDF mode */
export const STANDARD_LOGO_MAX_HEIGHT_MM = 18;
export const STANDARD_LOGO_MAX_WIDTH_MM = 45;

/** Standard font stack fallback — same for all documents */
export const STANDARD_FONT_STACK = "Inter, Helvetica Neue, Helvetica, Arial, sans-serif";

// ─── Shared formatters ───────────────────────────────────────────────────────

/**
 * Format a monetary value as €X,XXX.XX using en-IE locale (correct for Malta/EU).
 * Single formatter used by ALL document types.
 */
export const formatMoney = (val: number): string =>
  `€${Number(val || 0).toLocaleString("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * Format a date string as DD/MM/YYYY (en-GB locale).
 */
export const formatDocDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB");
};

// ─── Style config helper (shared logic for all document types) ───────────────

/**
 * Derives style-specific colour/layout config from template settings.
 * Used by both UnifiedInvoiceLayout and UnifiedStatementLayout so they
 * always produce identical header, table-header, and total styling.
 */
export function getDocumentStyleConfig(
  style: DocumentTemplateStyle,
  primaryColor: string,
  isPdf: boolean
) {
  const brandTextColor = getContrastTextColor(primaryColor);
  const brandDarkColor = darkenColor(primaryColor, 20);

  switch (style) {
    case "modern":
      return {
        headerBg: primaryColor,
        headerTextColor: brandTextColor,
        headerBorderStyle: "none" as const,
        tableHeaderBg: primaryColor,
        tableHeaderColor: brandTextColor,
        rowAltBg: "#f8fafc",
        totalBg: primaryColor,
        totalTextColor: brandTextColor,
        brandColor: primaryColor,
        brandDarkColor,
      };

    case "professional":
      return {
        headerBg: "#ffffff",
        headerTextColor: "#111827",
        headerBorderStyle: `${isPdf ? "1.2mm" : "4px"} solid ${primaryColor}`,
        tableHeaderBg: "#f9fafb",
        tableHeaderColor: "#374151",
        tableHeaderBorder: `2px solid ${primaryColor}`,
        rowAltBg: "#f9fafb",
        totalBg: "transparent",
        totalTextColor: primaryColor,
        brandColor: primaryColor,
        brandDarkColor,
      };

    case "minimalist":
      return {
        headerBg: "transparent",
        headerTextColor: "#374151",
        headerBorderStyle: "none" as const,
        tableHeaderBg: "transparent",
        tableHeaderColor: "#9ca3af",
        rowAltBg: "transparent",
        totalBg: "transparent",
        totalTextColor: primaryColor,
        brandColor: primaryColor,
        brandDarkColor,
      };

    default:
      return {
        headerBg: "transparent",
        headerTextColor: "#111827",
        headerBorderStyle: "none" as const,
        tableHeaderBg: "#f9fafb",
        tableHeaderColor: "#374151",
        rowAltBg: "#f9fafb",
        totalBg: "transparent",
        totalTextColor: "#111827",
        brandColor: primaryColor,
        brandDarkColor,
      };
  }
}

// ─── Private colour helpers (used by getDocumentStyleConfig) ─────────────────

function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1f2937" : "#ffffff";
}

function darkenColor(hexColor: string, pct: number): string {
  const hex = hexColor.replace("#", "");
  const r = Math.max(0, Math.floor(parseInt(hex.substring(0, 2), 16) * (1 - pct / 100)));
  const g = Math.max(0, Math.floor(parseInt(hex.substring(2, 4), 16) * (1 - pct / 100)));
  const b = Math.max(0, Math.floor(parseInt(hex.substring(4, 6), 16) * (1 - pct / 100)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
