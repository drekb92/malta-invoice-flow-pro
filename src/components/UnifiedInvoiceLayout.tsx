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

const percent = (val: number) => `${Number(val || 0)}%`;

const mul = (a: number, b: number) => Number(a || 0) * Number(b || 0);

/* ===================== CONSTANTS ===================== */

// Locked margins (user requested “standard, not editable”)
const STANDARD_MARGIN_MM = 20;

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
  const primary = templateSettings?.primaryColor || "var(--color-primary, #111827)";
  const accent = templateSettings?.accentColor || "var(--color-accent, #26A65B)";
  const fontFamily = templateSettings?.fontFamily || "var(--font, Inter)";

  const getAbsoluteLogoUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith("http")) return url;
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${url}`;
  };

  const logoUrl = getAbsoluteLogoUrl(companySettings?.logo);

  const showBanking = (templateSettings?.bankingVisibility ?? true) && !!bankingSettings;

  const embeddedStyles = `
    @page { size: A4; margin: 0; }

    /* Reset – scoped to the invoice only */
    #${id}, #${id} * { box-sizing: border-box; }
    #${id} { background: #fff; }

    /* Canvas */
    #${id}.invoice-page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      color: ${primary};
      font-family: ${fontFamily}, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      font-size: ${templateSettings?.fontSize || "12px"};
      line-height: 1.35;
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

    /* Header */
    #${id} .header {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: flex-start;
    }
    #${id} .header-left { flex: 0 0 56%; }
    #${id} .header-right { flex: 1; text-align: right; }
    #${id} .logo {
      height: auto;
      max-height: ${variant === "preview" ? "76px" : "90px"};
      max-width: 240px;
      display: block;
      margin-bottom: 8px;
    }
    #${id} .company {
      font-size: 11px;
      color: #4b5563;
      line-height: 1.35;
    }
    #${id} .company strong { color: #111827; font-weight: 700; }
    #${id} .doc-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: ${accent};
      margin: 0 0 8px 0;
      text-transform: uppercase;
    }
    #${id} .meta {
      font-size: 11px;
      color: #4b5563;
      line-height: 1.35;
    }
    #${id} .meta .row { display: flex; justify-content: flex-end; gap: 8px; }
    #${id} .meta .label { color: #6b7280; }
    #${id} .meta .value { color: #111827; font-weight: 600; }

    #${id} .divider {
      border: 0;
      border-top: 1px solid #e5e7eb;
      margin: 14px 0 16px 0;
    }

    /* Sections */
    #${id} .section-label {
      font-size: 10px;
      font-weight: 700;
      color: #6b7280;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    #${id} .billto { margin-bottom: 16px; }
    #${id} .customer-name {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }
    #${id} .customer-info {
      font-size: 11px;
      color: #4b5563;
      line-height: 1.35;
    }
    #${id} .customer-info div { margin: 2px 0; }

    /* Table */
    #${id} table.items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin-top: 10px;
      font-size: 11px;
    }
    #${id} table.items thead th {
      padding: 9px 8px;
      border-bottom: 1px solid #e5e7eb;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 10px;
      color: #6b7280;
      background: var(--th-bg, #f9fafb);
    }
    #${id} table.items tbody td {
      padding: 9px 8px;
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

    /* Totals */
    #${id} .totals {
      width: 45%;
      margin-left: auto;
      margin-top: 10px;
      font-size: 11px;
    }
    #${id} .totals .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      padding: 4px 0;
      align-items: center;
    }
    #${id} .totals .label { color: #6b7280; text-align: right; }
    #${id} .totals .value { text-align: right; font-weight: 700; color: #111827; }
    #${id} .totals .total {
      border-top: 1px solid #e5e7eb;
      margin-top: 6px;
      padding-top: 8px;
    }
    #${id} .totals .total .label { font-size: 13px; font-weight: 800; color: #111827; }
    #${id} .totals .total .value { font-size: 13px; font-weight: 900; color: ${accent}; }

    /* Footer pinned for short invoices */
    #${id} .body { flex: 1; }
    #${id} .footer {
      margin-top: auto;
      padding-top: 14px;
    }
    #${id} .banking {
      font-size: 11px;
      line-height: 1.35;
      color: #4b5563;
    }
    #${id} .banking .line { margin: 2px 0; }
    #${id} .thanks {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.4;
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

  const companyAddressLines = [
    companySettings?.address,
    [companySettings?.zipCode, companySettings?.city].filter(Boolean).join(" ") || undefined,
    companySettings?.country,
  ].filter(Boolean) as string[];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: embeddedStyles }} />
      <div id={id} className="invoice-page" style={lockedVars}>
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

            {/* BILL TO */}
            <div className="billto">
              <div className="section-label">Bill To</div>
              <div className="customer-name">{invoiceData.customer.name}</div>
              <div className="customer-info">
                {invoiceData.customer.email && <div>{invoiceData.customer.email}</div>}
                {invoiceData.customer.address && <div className="desc">{invoiceData.customer.address}</div>}
                {invoiceData.customer.vat_number && <div>VAT: {invoiceData.customer.vat_number}</div>}
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

            {/* TOTALS */}
            <div className="totals totals-section">
              {invoiceData.discount?.amount ? (
                <>
                  <div className="row">
                    <div className="label">Subtotal</div>
                    <div className="value">{money(invoiceData.totals.netTotal + invoiceData.discount.amount)}</div>
                  </div>
                  <div className="row">
                    <div className="label">
                      Discount{invoiceData.discount.type === "percent" ? ` (${invoiceData.discount.value}%)` : ""}
                    </div>
                    <div className="value">- {money(invoiceData.discount.amount)}</div>
                  </div>
                </>
              ) : (
                <div className="row">
                  <div className="label">Subtotal</div>
                  <div className="value">{money(invoiceData.totals.netTotal)}</div>
                </div>
              )}

              <div className="row">
                <div className="label">VAT</div>
                <div className="value">{money(invoiceData.totals.vatTotal)}</div>
              </div>
              <div className="row total">
                <div className="label">Total</div>
                <div className="value">{money(invoiceData.totals.grandTotal)}</div>
              </div>
            </div>
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
    </>
  );
};

export default UnifiedInvoiceLayout;
