import React from "react";
import { formatDate, money, percent, mul } from "@/lib/invoiceUtils";
import { PDF_PRINT_STYLES } from "@/lib/pdfPrintStyles";

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
  const fontFamily = "Inter";

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
    height: "29.7cm", // ✅ FIXED HEIGHT
    minHeight: "29.7cm",
    backgroundColor: "white",
    padding: "20mm",
    boxSizing: "border-box",
    fontFamily,
    fontSize: TYPE.body,
    color: "#1f2937",
    display: "flex",
    flexDirection: "column",
  };

  const containerStyle =
    variant === "pdf" || variant === "print"
      ? baseContainer
      : { ...baseContainer, maxWidth: "900px", margin: "0 auto" };

  /* ===================== RENDER ===================== */

  return (
    <div id={id} style={containerStyle}>
      {variant === "pdf" && <style dangerouslySetInnerHTML={{ __html: PDF_PRINT_STYLES }} />}

      {/* ================= HEADER ================= */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ maxWidth: "55%" }}>
          {logoUrl && <img src={logoUrl} alt="Logo" style={{ maxHeight: "60px", marginBottom: "8px" }} />}
          <div style={{ fontSize: TYPE.muted, lineHeight: 1.35 }}>
            <strong>{companySettings?.name}</strong>
            <div>{companySettings?.address}</div>
            <div>{companySettings?.email}</div>
            <div>VAT: {companySettings?.taxId}</div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: TYPE.h1, color: primaryColor, letterSpacing: "0.08em" }}>{documentType}</div>
          <div style={{ fontSize: TYPE.muted, lineHeight: 1.35 }}>
            Invoice #: {invoiceData.invoiceNumber}
            <br />
            Date: {formatDate(invoiceData.invoiceDate)}
            <br />
            Due Date: {formatDate(invoiceData.dueDate)}
          </div>
        </div>
      </div>

      <hr style={{ margin: "18px 0", borderColor: "#e5e7eb" }} />

      {/* ================= BILL TO ================= */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: TYPE.section, letterSpacing: "0.08em" }}>BILL TO</div>
        <div style={{ fontSize: TYPE.customer, fontWeight: 600 }}>{invoiceData.customer.name}</div>
        <div style={{ fontSize: TYPE.body, lineHeight: 1.35 }}>
          {invoiceData.customer.email}
          <br />
          {invoiceData.customer.address}
        </div>
      </div>

      {/* ================= TABLE ================= */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {["Description", "Qty", "Unit Price", "VAT", "Total"].map((h, i) => (
              <th
                key={h}
                style={{
                  textAlign: i === 0 ? "left" : "right",
                  padding: "8px",
                  fontSize: TYPE.tableHeader,
                  borderBottom: "1px solid #e5e7eb",
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
              <td style={{ padding: "8px" }}>{item.description}</td>
              <td style={{ padding: "8px", textAlign: "right" }}>{item.quantity}</td>
              <td style={{ padding: "8px", textAlign: "right" }}>{money(item.unit_price)}</td>
              <td style={{ padding: "8px", textAlign: "right" }}>{percent(item.vat_rate)}</td>
              <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>
                {money(mul(item.quantity, item.unit_price))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 🔥 FLEX SPACER — THIS IS THE KEY FIX */}
      <div style={{ flexGrow: 1 }} />

      {/* ================= BOTTOM ================= */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontSize: TYPE.body, lineHeight: 1.25 }}>
            <div style={{ fontSize: TYPE.section }}>BANKING DETAILS</div>
            <div>Bank: {bankingSettings?.bankName}</div>
            <div>Account Name: {bankingSettings?.accountName}</div>
            <div>IBAN: {bankingSettings?.iban}</div>
            <div>SWIFT: {bankingSettings?.swiftCode}</div>
          </div>

          <div style={{ width: "280px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Subtotal:</span>
              <span>{money(invoiceData.totals.netTotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>VAT:</span>
              <span>{money(invoiceData.totals.vatTotal)}</span>
            </div>
            <div style={{ borderTop: "1px solid #e5e7eb", margin: "8px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: TYPE.total, fontWeight: 700 }}>
              <span>Total:</span>
              <span>{money(invoiceData.totals.grandTotal)}</span>
            </div>
            <div style={{ height: "2px", background: primaryColor, marginTop: "6px" }} />
          </div>
        </div>

        <div
          style={{
            marginTop: "16px",
            paddingTop: "10px",
            borderTop: "1px solid #e5e7eb",
            textAlign: "center",
            fontSize: TYPE.muted,
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
