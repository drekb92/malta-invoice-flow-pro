import React from "react";

/* ===================== TYPES ===================== */

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
    address?: string;
    vat_number?: string;
  };
  items: InvoiceItem[];
  totals: {
    netTotal: number;
    vatTotal: number;
    grandTotal: number;
  };
}

export type DocumentType = "INVOICE" | "CREDIT NOTE" | "QUOTATION";

export interface UnifiedInvoiceLayoutProps {
  invoiceData: InvoiceData;
  companySettings?: CompanySettings;
  bankingSettings?: BankingSettings;
  variant?: "preview" | "pdf" | "print";
  id?: string;
  documentType?: DocumentType;
}

/* ===================== UTILITIES ===================== */

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB");
};

const money = (val: number) =>
  `€${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (val: number) => `${val}%`;
const mul = (a: number, b: number) => a * b;

/* ===================== COMPONENT ===================== */

export const UnifiedInvoiceLayout = ({
  invoiceData,
  companySettings,
  bankingSettings,
  variant = "preview",
  id = "unified-invoice",
  documentType = "INVOICE",
}: UnifiedInvoiceLayoutProps) => {
  const primaryColor = "#26A65B";
  const fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  const TYPE = {
    body: "12px",
    muted: "11px",
    section: "11px",
    customer: "15px",
    tableHeader: "11px",
    totals: "12px",
    total: "16px",
    h1: "28px",
  };

  const getAbsoluteLogoUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith("http")) return url;
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${url}`;
  };

  const logoUrl = getAbsoluteLogoUrl(companySettings?.logo);

  /* ===================== CONTAINER ===================== */

  const baseContainer: React.CSSProperties = {
    width: "21cm",
    minHeight: "29.7cm",
    height: "29.7cm",
    backgroundColor: "white",
    padding: "20mm",
    boxSizing: "border-box",
    fontFamily,
    fontSize: TYPE.body,
    color: "#1f2937",
    position: "relative",
  };

  const containerStyle =
    variant === "pdf" || variant === "print"
      ? baseContainer
      : { ...baseContainer, maxWidth: "900px", margin: "20px auto", border: "1px solid #e5e7eb" };

  /* ===================== RENDER ===================== */

  return (
    <div id={id} style={containerStyle}>
      {/* ================= MAIN CONTENT ================= */}
      <div style={{ paddingBottom: "180px" }}>
        {" "}
        {/* Reserve space for footer */}
        {/* ================= HEADER ================= */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ maxWidth: "55%", minHeight: logoUrl ? "60px" : "auto" }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ maxHeight: "60px", marginBottom: "8px", display: "block" }} />
            ) : (
              <div style={{ height: "60px", marginBottom: "8px" }} />
            )}
            <div style={{ fontSize: TYPE.muted, lineHeight: 1.5 }}>
              <strong style={{ display: "block", marginBottom: "2px" }}>{companySettings?.name}</strong>
              <div>{companySettings?.address}</div>
              <div>{companySettings?.email}</div>
              <div>VAT: {companySettings?.taxId}</div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: TYPE.h1,
                color: primaryColor,
                letterSpacing: "0.08em",
                fontWeight: 700,
                marginBottom: "8px",
              }}
            >
              {documentType}
            </div>
            <div style={{ fontSize: TYPE.muted, lineHeight: 1.5 }}>
              <div>Invoice #: {invoiceData.invoiceNumber}</div>
              <div>Date: {formatDate(invoiceData.invoiceDate)}</div>
              <div>Due Date: {formatDate(invoiceData.dueDate)}</div>
            </div>
          </div>
        </div>
        <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #e5e7eb" }} />
        {/* ================= BILL TO ================= */}
        <div style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontSize: TYPE.section,
              letterSpacing: "0.08em",
              fontWeight: 600,
              marginBottom: "6px",
              color: "#6b7280",
            }}
          >
            BILL TO
          </div>
          <div style={{ fontSize: TYPE.customer, fontWeight: 600, marginBottom: "4px" }}>
            {invoiceData.customer.name}
          </div>
          <div style={{ fontSize: TYPE.body, lineHeight: 1.5, color: "#4b5563" }}>
            {invoiceData.customer.email && <div>{invoiceData.customer.email}</div>}
            {invoiceData.customer.address && <div>{invoiceData.customer.address}</div>}
          </div>
        </div>
        {/* ================= TABLE ================= */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: "20px",
          }}
        >
          <thead>
            <tr>
              {["Description", "Qty", "Unit Price", "VAT", "Total"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    textAlign: i === 0 ? "left" : "right",
                    padding: "10px 8px",
                    fontSize: TYPE.tableHeader,
                    fontWeight: 600,
                    borderBottom: "1px solid #e5e7eb",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoiceData.items.map((item, i) => (
              <tr key={i}>
                <td style={{ padding: "10px 8px", color: "#374151" }}>{item.description}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: "#6b7280" }}>{item.quantity}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: "#6b7280" }}>{money(item.unit_price)}</td>
                <td style={{ padding: "10px 8px", textAlign: "right", color: "#6b7280" }}>{percent(item.vat_rate)}</td>
                <td
                  style={{
                    padding: "10px 8px",
                    textAlign: "right",
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  {money(mul(item.quantity, item.unit_price))}
                </td>
              </tr>
            ))}

            {/* Totals rows */}
            <tr style={{ borderTop: "1px solid #e5e7eb" }}>
              <td
                colSpan={4}
                style={{
                  padding: "8px",
                  textAlign: "right",
                  fontSize: TYPE.totals,
                  color: "#6b7280",
                  paddingTop: "16px",
                }}
              >
                Subtotal:
              </td>
              <td
                style={{
                  padding: "8px",
                  textAlign: "right",
                  fontSize: TYPE.totals,
                  fontWeight: 600,
                  color: "#111827",
                  paddingTop: "16px",
                }}
              >
                {money(invoiceData.totals.netTotal)}
              </td>
            </tr>
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: "8px",
                  textAlign: "right",
                  fontSize: TYPE.totals,
                  color: "#6b7280",
                }}
              >
                VAT:
              </td>
              <td
                style={{
                  padding: "8px",
                  textAlign: "right",
                  fontSize: TYPE.totals,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {money(invoiceData.totals.vatTotal)}
              </td>
            </tr>
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: "12px 8px",
                  textAlign: "right",
                  fontSize: TYPE.total,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Total:
              </td>
              <td
                style={{
                  padding: "12px 8px",
                  textAlign: "right",
                  fontSize: TYPE.total,
                  fontWeight: 700,
                  color: primaryColor,
                }}
              >
                {money(invoiceData.totals.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ================= FOOTER (ABSOLUTE POSITIONED) ================= */}
      <div
        style={{
          position: "absolute",
          bottom: "20mm",
          left: "20mm",
          right: "20mm",
        }}
      >
        {/* Banking Details */}
        <div
          style={{
            fontSize: TYPE.muted,
            lineHeight: 1.6,
            color: "#4b5563",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: TYPE.section,
              fontWeight: 600,
              marginBottom: "8px",
              color: "#374151",
              letterSpacing: "0.05em",
            }}
          >
            BANKING DETAILS
          </div>
          {bankingSettings?.bankName && (
            <div>
              <strong>Bank:</strong> {bankingSettings.bankName}
            </div>
          )}
          {bankingSettings?.accountName && (
            <div>
              <strong>Account:</strong> {bankingSettings.accountName}
            </div>
          )}
          {bankingSettings?.iban && (
            <div>
              <strong>IBAN:</strong> {bankingSettings.iban}
            </div>
          )}
          {bankingSettings?.swiftCode && (
            <div>
              <strong>SWIFT:</strong> {bankingSettings.swiftCode}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            paddingTop: "16px",
            borderTop: "1px solid #e5e7eb",
            textAlign: "center",
            fontSize: TYPE.muted,
            color: "#6b7280",
            lineHeight: 1.6,
          }}
        >
          Thank you for your business
          <br />
          All amounts in EUR.
        </div>
      </div>
    </div>
  );
};

// Demo data for preview
const demoData: InvoiceData = {
  invoiceNumber: "INV-2025-009",
  invoiceDate: "2025-01-12",
  dueDate: "2025-10-01",
  customer: {
    name: "Anna Sultana",
    email: "usaboy007@hotmail.com",
    address: "JP Projects St. Leonard Street",
  },
  items: [
    { description: "Testing 111225", quantity: 1, unit_price: 1000.0, vat_rate: 18 },
    { description: "Testing 2 111225", quantity: 1, unit_price: 500.0, vat_rate: 18 },
  ],
  totals: {
    netTotal: 1500.0,
    vatTotal: 270.0,
    grandTotal: 1770.0,
  },
};

const demoCompany: CompanySettings = {
  name: "InvPro Ltd",
  address: "Biebjan Court, Flat 4, Sqaq Blas Street, Nadur",
  email: "derck92@gmail.com",
  taxId: "MT 2456 1568",
};

const demoBanking: BankingSettings = {
  bankName: "BOV",
  accountName: "Derek Borg",
  iban: "LT86239081629848703",
  swiftCode: "REVOLT21",
};

export default () => (
  <div style={{ padding: "20px", backgroundColor: "#f3f4f6", minHeight: "100vh" }}>
    <UnifiedInvoiceLayout
      invoiceData={demoData}
      companySettings={demoCompany}
      bankingSettings={demoBanking}
      variant="preview"
      documentType="INVOICE"
    />
  </div>
);
