import React from "react";

/* ===================== TYPES ===================== */

export interface CompanySettings {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
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
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customer: {
    name: string;
    email?: string;
    address?: string;
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
  variant?: "preview" | "pdf";
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

  const getAbsoluteLogoUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith("http")) return url;
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${url}`;
  };

  const logoUrl = getAbsoluteLogoUrl(companySettings?.logo);

  /* ===================== STYLES ===================== */

  // Embedded CSS for html2pdf.app - ensures styles travel with HTML
  const embeddedStyles = `
    @page {
      size: A4;
      margin: 0;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .invoice-container {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      background: white;
      position: relative;
    }
    
    .header-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    
    .header-left {
      flex: 0 0 55%;
    }
    
    .header-right {
      flex: 0 0 45%;
      text-align: right;
    }
    
    .logo {
      max-height: 60px;
      margin-bottom: 8px;
      display: block;
    }
    
    .logo-spacer {
      height: 60px;
      margin-bottom: 8px;
    }
    
    .company-info {
      font-size: 11px;
      line-height: 1.5;
      color: #4b5563;
    }
    
    .document-title {
      font-size: 28px;
      color: ${primaryColor};
      font-weight: bold;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }
    
    .invoice-meta {
      font-size: 11px;
      line-height: 1.5;
      color: #4b5563;
    }
    
    .divider {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 20px 0;
    }
    
    .section-label {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    
    .customer-name {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
      color: #111827;
    }
    
    .customer-info {
      font-size: 12px;
      line-height: 1.5;
      color: #4b5563;
    }
    
    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    .invoice-table thead th {
      padding: 10px 8px;
      font-size: 11px;
      font-weight: 600;
      border-bottom: 1px solid #e5e7eb;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .invoice-table thead th:first-child {
      text-align: left;
    }
    
    .invoice-table thead th:not(:first-child) {
      text-align: right;
    }
    
    .invoice-table tbody td {
      padding: 10px 8px;
    }
    
    .invoice-table tbody td:first-child {
      color: #374151;
      text-align: left;
    }
    
    .invoice-table tbody td:not(:first-child) {
      text-align: right;
      color: #6b7280;
    }
    
    .invoice-table tbody td.total-col {
      font-weight: 600;
      color: #111827;
    }
    
    .totals-row {
      border-top: 1px solid #e5e7eb;
    }
    
    .totals-row td:first-child {
      padding-top: 16px;
    }
    
    .totals-label {
      text-align: right;
      font-size: 12px;
      color: #6b7280;
    }
    
    .totals-value {
      text-align: right;
      font-size: 12px;
      font-weight: 600;
      color: #111827;
    }
    
    .grand-total-row .totals-label {
      font-size: 16px;
      font-weight: bold;
      color: #111827;
      padding: 12px 8px;
    }
    
    .grand-total-row .totals-value {
      font-size: 16px;
      font-weight: bold;
      color: ${primaryColor};
      padding: 12px 8px;
    }
    
    .content-wrapper {
      min-height: calc(297mm - 40mm - 180px);
    }
    
    .footer-section {
      margin-top: 40px;
    }
    
    .banking-details {
      font-size: 11px;
      line-height: 1.6;
      color: #4b5563;
      margin-bottom: 20px;
    }
    
    .footer-message {
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.6;
    }
    
    /* Preview mode specific */
    ${
      variant === "preview"
        ? `
      .invoice-container {
        max-width: 900px;
        margin: 20px auto;
        border: 1px solid #e5e7eb;
      }
    `
        : ""
    }
  `;

  /* ===================== RENDER ===================== */

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: embeddedStyles }} />
      <div id={id} className="invoice-container">
        <div className="content-wrapper">
          {/* HEADER */}
          <div className="header-section">
            <div className="header-left">
              {logoUrl ? <img src={logoUrl} alt="Logo" className="logo" /> : <div className="logo-spacer" />}
              <div className="company-info">
                <strong>{companySettings?.name}</strong>
                <div>{companySettings?.address}</div>
                <div>{companySettings?.email}</div>
                <div>VAT: {companySettings?.taxId}</div>
              </div>
            </div>

            <div className="header-right">
              <div className="document-title">{documentType}</div>
              <div className="invoice-meta">
                <div>Invoice #: {invoiceData.invoiceNumber}</div>
                <div>Date: {formatDate(invoiceData.invoiceDate)}</div>
                <div>Due Date: {formatDate(invoiceData.dueDate)}</div>
              </div>
            </div>
          </div>

          <hr className="divider" />

          {/* BILL TO */}
          <div style={{ marginBottom: "24px" }}>
            <div className="section-label">BILL TO</div>
            <div className="customer-name">{invoiceData.customer.name}</div>
            <div className="customer-info">
              {invoiceData.customer.email && <div>{invoiceData.customer.email}</div>}
              {invoiceData.customer.address && <div>{invoiceData.customer.address}</div>}
            </div>
          </div>

          {/* TABLE */}
          <table className="invoice-table">
            <thead>
              <tr>
                <th>DESCRIPTION</th>
                <th>QTY</th>
                <th>UNIT PRICE</th>
                <th>VAT</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {invoiceData.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{money(item.unit_price)}</td>
                  <td>{percent(item.vat_rate)}</td>
                  <td className="total-col">{money(mul(item.quantity, item.unit_price))}</td>
                </tr>
              ))}

              {/* Totals */}
              <tr className="totals-row">
                <td colSpan={4} className="totals-label" style={{ paddingTop: "16px" }}>
                  Subtotal:
                </td>
                <td className="totals-value" style={{ paddingTop: "16px" }}>
                  {money(invoiceData.totals.netTotal)}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="totals-label" style={{ padding: "8px" }}>
                  VAT:
                </td>
                <td className="totals-value" style={{ padding: "8px" }}>
                  {money(invoiceData.totals.vatTotal)}
                </td>
              </tr>
              <tr className="grand-total-row">
                <td colSpan={4} className="totals-label">
                  Total:
                </td>
                <td className="totals-value">{money(invoiceData.totals.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="footer-section">
          <div className="banking-details">
            <div className="section-label">BANKING DETAILS</div>
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

          <div className="footer-message">
            Thank you for your business
            <br />
            All amounts in EUR.
          </div>
        </div>
      </div>
    </>
  );
};

// Demo data
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
