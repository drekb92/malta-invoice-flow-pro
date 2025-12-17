import React from "react";
import { formatDate, money, percent, mul } from "@/lib/invoiceUtils";
import { PDF_PRINT_STYLES } from "@/lib/pdfPrintStyles";

// Type definitions for all required data
export interface CompanySettings {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
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
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  branch?: string;
}

export interface TemplateSettings {
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  fontSize?: string;
  layout?: "default" | "cleanMinimal" | "compact";
  headerLayout?: "default" | "centered" | "split";
  tableStyle?: "default" | "striped" | "bordered" | "minimal";
  totalsStyle?: "default" | "boxed" | "highlighted";
  bankingVisibility?: boolean;
  bankingStyle?: "default" | "boxed" | "minimal";
  companyPosition?: "left" | "right" | "top-right";
  bankingPosition?: "after-totals" | "bottom" | "footer";
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
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
    address?: string;
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
  variant?: "preview" | "pdf" | "print";
  id?: string;
  debug?: boolean;
  templateId?: string;
  documentType?: DocumentType;
}

export const UnifiedInvoiceLayout = ({
  invoiceData,
  companySettings,
  bankingSettings,
  templateSettings,
  variant = "preview",
  id = "unified-invoice",
  debug = false,
  templateId,
  documentType = "INVOICE",
}: UnifiedInvoiceLayoutProps) => {
  // Labels
  const getDocumentTitle = () => documentType;
  const getNumberLabel = () => {
    switch (documentType) {
      case "CREDIT NOTE":
        return "Credit Note #:";
      case "QUOTATION":
        return "Quotation #:";
      default:
        return "Invoice #:";
    }
  };

  // Branding settings (kept)
  const primaryColor = templateSettings?.primaryColor || "#26A65B";
  const accentColor = templateSettings?.accentColor || "#1F2D3D";
  const fontFamily = templateSettings?.fontFamily || "Inter";

  // Typography scale (consistent everywhere)
  const TYPE = {
    body: "12px",
    muted: "11px",
    section: "11px",
    customer: "15px",
    tableHeader: "11px",
    totals: "12px",
    total: "16px",
  } as const;

  const baseFontSize = templateSettings?.fontSize || TYPE.body;

  // Visibility + margins
  const bankingVisibility = templateSettings?.bankingVisibility !== false;

  const marginTop = templateSettings?.marginTop || 20;
  const marginRight = templateSettings?.marginRight || 20;
  const marginBottom = templateSettings?.marginBottom || 20;
  const marginLeft = templateSettings?.marginLeft || 20;

  // Absolute logo URL
  const getAbsoluteLogoUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) {
      return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos${url}`;
    }
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${url}`;
  };
  const logoUrl = getAbsoluteLogoUrl(companySettings?.logo);

  // Debug helpers
  const validateCompanySettings = () => {
    if (!companySettings) return { valid: false, missing: ["All company settings"] };
    const missing: string[] = [];
    if (!companySettings.name) missing.push("name");
    if (!companySettings.email) missing.push("email");
    if (!companySettings.address) missing.push("address");
    if (!companySettings.logo) missing.push("logo");
    return { valid: missing.length === 0, missing };
  };

  const validateBankingSettings = () => {
    if (!bankingSettings) return { valid: false, missing: ["All banking settings"] };
    const missing: string[] = [];
    if (!bankingSettings.bankName) missing.push("bankName");
    if (!bankingSettings.accountName) missing.push("accountName");
    if (!bankingSettings.iban && !bankingSettings.accountNumber) missing.push("iban/accountNumber");
    return { valid: missing.length === 0, missing };
  };

  const validateInvoiceData = () => {
    const missing: string[] = [];
    if (!invoiceData.invoiceNumber) missing.push("invoiceNumber");
    if (!invoiceData.customer?.name) missing.push("customer.name");
    if (!invoiceData.items || invoiceData.items.length === 0) missing.push("items");
    return { valid: missing.length === 0, missing };
  };

  const renderDebugPanel = () => {
    if (!debug) return null;

    const companyValidation = validateCompanySettings();
    const bankingValidation = validateBankingSettings();
    const invoiceValidation = validateInvoiceData();

    return (
      <div
        style={{
          position: variant === "pdf" ? "relative" : "absolute",
          top: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
          border: "2px solid #f59e0b",
          borderRadius: "4px",
          padding: "12px 16px",
          fontSize: "11px",
          fontFamily: "monospace",
          zIndex: 1000,
          marginBottom: variant === "pdf" ? "1rem" : "0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ marginBottom: "8px", fontSize: "13px", fontWeight: "bold", color: "#92400e" }}>
          🔍 DEBUG MODE - Invoice Template Rendering
        </div>

        <div style={{ marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid #fbbf24" }}>
          <strong style={{ color: "#92400e" }}>Template:</strong>
          <div style={{ marginLeft: "8px", color: "#78350f" }}>
            {templateId ? `ID: ${templateId}` : "ID: Not provided"}
          </div>
          <div style={{ marginLeft: "8px", color: "#78350f" }}>
            Variant: <strong>{variant}</strong> | Forced Layout: <strong>cleanMinimal</strong>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          <div
            style={{
              padding: "6px",
              background: companyValidation.valid ? "#d1fae5" : "#fee2e2",
              borderRadius: "4px",
              border: `1px solid ${companyValidation.valid ? "#10b981" : "#ef4444"}`,
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                marginBottom: "4px",
                color: companyValidation.valid ? "#065f46" : "#991b1b",
              }}
            >
              {companyValidation.valid ? "✓" : "⚠"} Company
            </div>
            {companyValidation.valid ? (
              <div style={{ color: "#065f46" }}>{companySettings?.name || "N/A"}</div>
            ) : (
              <div style={{ color: "#991b1b", fontSize: "10px" }}>Missing: {companyValidation.missing.join(", ")}</div>
            )}
          </div>

          <div
            style={{
              padding: "6px",
              background: bankingValidation.valid ? "#d1fae5" : "#fee2e2",
              borderRadius: "4px",
              border: `1px solid ${bankingValidation.valid ? "#10b981" : "#ef4444"}`,
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                marginBottom: "4px",
                color: bankingValidation.valid ? "#065f46" : "#991b1b",
              }}
            >
              {bankingValidation.valid ? "✓" : "⚠"} Banking
            </div>
            {bankingValidation.valid ? (
              <div style={{ color: "#065f46" }}>{bankingSettings?.bankName || "N/A"}</div>
            ) : (
              <div style={{ color: "#991b1b", fontSize: "10px" }}>Missing: {bankingValidation.missing.join(", ")}</div>
            )}
          </div>

          <div
            style={{
              padding: "6px",
              background: invoiceValidation.valid ? "#d1fae5" : "#fee2e2",
              borderRadius: "4px",
              border: `1px solid ${invoiceValidation.valid ? "#10b981" : "#ef4444"}`,
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                marginBottom: "4px",
                color: invoiceValidation.valid ? "#065f46" : "#991b1b",
              }}
            >
              {invoiceValidation.valid ? "✓" : "⚠"} Invoice
            </div>
            {invoiceValidation.valid ? (
              <div style={{ color: "#065f46" }}>{invoiceData.invoiceNumber}</div>
            ) : (
              <div style={{ color: "#991b1b", fontSize: "10px" }}>Missing: {invoiceValidation.missing.join(", ")}</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: "8px", fontSize: "10px", color: "#92400e", fontStyle: "italic" }}>
          Debug helps validate preview and PDF use identical data sources.
        </div>
      </div>
    );
  };

  // CSS variables
  const cssVariables = {
    "--invoice-font-family": `'${fontFamily}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
    "--invoice-font-size": baseFontSize,
    "--invoice-primary-color": primaryColor,
    "--invoice-accent-color": accentColor,
    "--invoice-margin-top": `${marginTop}mm`,
    "--invoice-margin-right": `${marginRight}mm`,
    "--invoice-margin-bottom": `${marginBottom}mm`,
    "--invoice-margin-left": `${marginLeft}mm`,
  } as React.CSSProperties;

  // Container styling
  const containerStyle: React.CSSProperties =
    variant === "pdf"
      ? {
          ...cssVariables,
          width: "21cm",
          minHeight: "29.7cm",
          backgroundColor: "white",
          paddingTop: "var(--invoice-margin-top)",
          paddingRight: "var(--invoice-margin-right)",
          paddingBottom: "var(--invoice-margin-bottom)",
          paddingLeft: "var(--invoice-margin-left)",
          boxSizing: "border-box",
          fontFamily: "var(--invoice-font-family)",
          fontSize: "var(--invoice-font-size)",
          color: "var(--invoice-accent-color)",
          position: "relative",
        }
      : variant === "print"
        ? {
            ...cssVariables,
            width: "21cm",
            minHeight: "29.7cm",
            backgroundColor: "white",
            padding: "1.5cm",
            boxSizing: "border-box",
            fontFamily: "var(--invoice-font-family)",
            fontSize: "var(--invoice-font-size)",
            color: "var(--invoice-accent-color)",
          }
        : {
            ...cssVariables,
            fontFamily: "var(--invoice-font-family)",
            fontSize: "var(--invoice-font-size)",
            color: "var(--invoice-accent-color)",
            backgroundColor: "white",
            padding: "2rem",
          };

  const containerClassName =
    variant === "pdf"
      ? "bg-white"
      : variant === "print"
        ? "bg-white print:shadow-none"
        : "bg-white max-w-4xl mx-auto shadow-lg";

  // ✅ FORCE SINGLE STYLE: Always render the clean minimal layout
  return (
    <div id={id} className={containerClassName} style={containerStyle}>
      {/* PDF Print Styles */}
      {variant === "pdf" && <style dangerouslySetInnerHTML={{ __html: PDF_PRINT_STYLES }} />}

      {/* Debug Panel */}
      {renderDebugPanel()}

      {/* Header Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
        {/* Left: Logo + Company */}
        <div style={{ maxWidth: "58%" }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Company Logo"
              crossOrigin="anonymous"
              style={{
                maxHeight: variant === "pdf" ? "42px" : "50px",
                width: "auto",
                objectFit: "contain",
                marginBottom: companySettings ? "8px" : "0",
              }}
            />
          )}

          {companySettings && (
            <div style={{ fontSize: TYPE.muted, color: "#6b7280", lineHeight: 1.35 }}>
              {companySettings.name && <div style={{ fontWeight: 500, color: "#111827" }}>{companySettings.name}</div>}
              {companySettings.address && <div style={{ whiteSpace: "pre-line" }}>{companySettings.address}</div>}
              {companySettings.city && (
                <div>
                  {companySettings.city}
                  {companySettings.state && `, ${companySettings.state}`} {companySettings.zipCode}
                </div>
              )}
              {companySettings.phone && <div>Tel: {companySettings.phone}</div>}
              {companySettings.email && <div>{companySettings.email}</div>}
              {companySettings.taxId && <div>VAT: {companySettings.taxId}</div>}
            </div>
          )}
        </div>

        {/* Right: Document Title + Meta */}
        <div
          style={{
            textAlign: "right",
            padding: "10px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            minWidth: "240px",
          }}
        >
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 300,
              letterSpacing: "0.08em",
              marginBottom: "6px",
              color: primaryColor,
            }}
          >
            {getDocumentTitle()}
          </h1>

          <div style={{ fontSize: TYPE.muted, color: "#6b7280", lineHeight: 1.35 }}>
            <div>
              <span style={{ fontWeight: 500, color: "#9ca3af" }}>{getNumberLabel()}</span>{" "}
              <span style={{ color: "#374151" }}>{invoiceData.invoiceNumber}</span>
            </div>
            <div>
              <span style={{ fontWeight: 500, color: "#9ca3af" }}>Date:</span>{" "}
              <span style={{ color: "#374151" }}>{formatDate(invoiceData.invoiceDate)}</span>
            </div>
            <div>
              <span style={{ fontWeight: 500, color: "#9ca3af" }}>
                {documentType === "QUOTATION" ? "Valid Until:" : "Due:"}
              </span>{" "}
              <span style={{ color: "#374151" }}>{formatDate(invoiceData.dueDate)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: "22px" }} />

      {/* Customer Info */}
      <div style={{ marginBottom: "26px" }}>
        <div
          style={{
            fontSize: TYPE.section,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#6b7280",
            marginBottom: "6px",
          }}
        >
          Bill To
        </div>

        <div style={{ fontSize: TYPE.customer, fontWeight: 600, color: "#111827" }}>{invoiceData.customer.name}</div>

        {invoiceData.customer.email && (
          <div style={{ fontSize: TYPE.body, color: "#6b7280", marginTop: "4px", lineHeight: 1.35 }}>
            {invoiceData.customer.email}
          </div>
        )}

        {invoiceData.customer.address && (
          <div
            style={{
              fontSize: TYPE.body,
              color: "#6b7280",
              marginTop: "6px",
              whiteSpace: "pre-line",
              lineHeight: 1.35,
            }}
          >
            {invoiceData.customer.address}
          </div>
        )}

        {invoiceData.customer.vat_number && (
          <div style={{ fontSize: TYPE.body, color: "#6b7280", marginTop: "6px", lineHeight: 1.35 }}>
            <span style={{ fontWeight: 500, color: "#9ca3af" }}>VAT:</span> {invoiceData.customer.vat_number}
          </div>
        )}
      </div>

      {/* Items Table */}
      <div style={{ marginBottom: "28px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "46%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "16%" }} />
          </colgroup>

          <thead>
            <tr
              style={{
                backgroundColor: "#f9fafb",
                borderTop: "1px solid #e5e7eb",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              {["Description", "Qty", "Unit Price", "VAT", "Total"].map((h, idx) => (
                <th
                  key={h}
                  style={{
                    textAlign: idx === 0 ? "left" : "right",
                    padding: "9px 0",
                    fontSize: TYPE.tableHeader,
                    fontWeight: 600,
                    color: "#374151",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {invoiceData.items.map((item, index) => {
              const lineTotal = mul(item.quantity, item.unit_price);
              return (
                <tr
                  key={index}
                  style={{
                    borderBottom: "1px solid #f3f4f6",
                    breakInside: "avoid",
                    pageBreakInside: "avoid",
                  }}
                >
                  <td
                    style={{
                      padding: "10px 0",
                      color: "#111827",
                      fontSize: TYPE.body,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      lineHeight: 1.35,
                    }}
                  >
                    {item.description}
                  </td>

                  <td
                    style={{
                      padding: "10px 0",
                      textAlign: "right",
                      color: "#6b7280",
                      fontSize: TYPE.body,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.quantity} {item.unit || ""}
                  </td>

                  <td
                    style={{
                      padding: "10px 0",
                      textAlign: "right",
                      color: "#6b7280",
                      fontSize: TYPE.body,
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {money(item.unit_price)}
                  </td>

                  <td
                    style={{
                      padding: "10px 0",
                      textAlign: "right",
                      color: "#6b7280",
                      fontSize: TYPE.body,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {percent(item.vat_rate)}
                  </td>

                  <td
                    style={{
                      padding: "10px 0",
                      textAlign: "right",
                      fontWeight: 600,
                      fontSize: TYPE.body,
                      whiteSpace: "nowrap",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {money(lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Section: Banking + Totals */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginTop: "24px",
          gap: "24px",
          breakInside: "avoid",
          pageBreakInside: "avoid",
        }}
      >
        {/* Banking Details (single column, tighter spacing) */}
        {bankingVisibility &&
          bankingSettings &&
          (bankingSettings.bankName ||
            bankingSettings.iban ||
            bankingSettings.swiftCode ||
            bankingSettings.accountName) && (
            <div style={{ width: "52%" }}>
              <div
                style={{
                  fontSize: TYPE.section,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#6b7280",
                  marginBottom: "8px",
                }}
              >
                Banking Details
              </div>

              <div style={{ fontSize: TYPE.body, color: "#374151", lineHeight: 1.25 }}>
                {bankingSettings.bankName && (
                  <div style={{ marginBottom: "4px" }}>
                    <span style={{ color: "#9ca3af", fontWeight: 500 }}>Bank:</span> {bankingSettings.bankName}
                  </div>
                )}
                {bankingSettings.accountName && (
                  <div style={{ marginBottom: "4px" }}>
                    <span style={{ color: "#9ca3af", fontWeight: 500 }}>Account Name:</span>{" "}
                    {bankingSettings.accountName}
                  </div>
                )}
                {bankingSettings.iban && (
                  <div style={{ marginBottom: "4px" }}>
                    <span style={{ color: "#9ca3af", fontWeight: 500 }}>IBAN:</span> {bankingSettings.iban}
                  </div>
                )}
                {bankingSettings.swiftCode && (
                  <div>
                    <span style={{ color: "#9ca3af", fontWeight: 500 }}>SWIFT:</span> {bankingSettings.swiftCode}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Totals */}
        <div style={{ width: "280px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: TYPE.totals,
              color: "#6b7280",
              lineHeight: 1.25,
            }}
          >
            <span>Subtotal:</span>
            <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {money(invoiceData.totals.netTotal + (invoiceData.discount?.amount || 0))}
            </span>
          </div>

          {invoiceData.discount && invoiceData.discount.amount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: TYPE.totals,
                color: "#6b7280",
                marginTop: "6px",
                lineHeight: 1.25,
              }}
            >
              <span>
                Discount
                {invoiceData.discount.type === "percent" ? ` (${percent(invoiceData.discount.value / 100)})` : ""}:
              </span>
              <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                —{money(invoiceData.discount.amount)}
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: TYPE.totals,
              color: "#6b7280",
              marginTop: "6px",
              lineHeight: 1.25,
            }}
          >
            <span>VAT:</span>
            <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {money(invoiceData.totals.vatTotal)}
            </span>
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", margin: "10px 0" }} />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: TYPE.total,
              fontWeight: 700,
              color: "#111827",
              lineHeight: 1.2,
            }}
          >
            <span>Total:</span>
            <span style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              {money(invoiceData.totals.grandTotal)}
            </span>
          </div>

          <div style={{ height: "2px", background: primaryColor, marginTop: "8px" }} />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "48px",
          paddingTop: "14px",
          borderTop: "1px solid #e5e7eb",
          textAlign: "center",
          fontSize: TYPE.muted,
          color: "#6b7280",
          opacity: 0.9,
          lineHeight: 1.35,
        }}
      >
        <div style={{ margin: 0 }}>Thank you for your business</div>
        <div style={{ marginTop: "6px", fontSize: TYPE.muted, color: "#9ca3af" }}>All amounts in EUR.</div>
      </div>
    </div>
  );
};
