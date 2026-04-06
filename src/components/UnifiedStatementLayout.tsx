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
  const accent = templateSettings?.accentColor || "#26A65B";
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

  // ── Embedded stylesheet (same approach as UnifiedInvoiceLayout) ──────────
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
    }
    #${id} .stmt-inner {
      padding: ${STANDARD_MARGIN_MM}mm;
      min-height: 297mm;
      display: flex;
      flex-direction: column;
    }

    ${
      variant === "preview"
        ? `
      #${id}.statement-page {
        width: min(900px, calc(100vw - 32px));
        min-height: unset;
        border: none; box-shadow: none; border-radius: 0; overflow: visible;
      }
      #${id} .stmt-inner { min-height: unset; padding: 24px; }
    `
        : ""
    }

    /* ── Header — locked 40mm height in PDF, same as invoice ── */
    #${id} .header {
      display: flex;
      flex-direction: ${isCentered ? "column" : isLogoRight ? "row-reverse" : "row"};
      justify-content: ${isCentered ? "center" : "space-between"};
      align-items: ${isCentered ? "center" : "flex-start"};
      text-align: ${isCentered ? "center" : "inherit"};
      gap: ${isPdf ? "8mm" : "32px"};
      min-height: ${isPdf ? "40mm" : "150px"};
      box-sizing: border-box;
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
      color: ${accent};
      margin: 0 0 ${isPdf ? "2mm" : "8px"} 0;
      text-transform: uppercase;
    }
    #${id} .meta {
      font-size: ${isPdf ? "9pt" : "11px"};
      color: #4b5563;
      line-height: 1.6;
    }
    #${id} .divider { border: 0; border-top: 1px solid #e5e7eb; margin: ${isPdf ? "4mm 0 5mm 0" : "14px 0 16px 0"}; }

    /* ── Customer block ── */
    #${id} .section-label {
      font-size: ${isPdf ? "8pt" : "10px"};
      font-weight: 700;
      color: #6b7280;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: ${isPdf ? "1.5mm" : "6px"};
    }
    #${id} .stmt-for { margin-bottom: ${isPdf ? "5mm" : "20px"}; }
    #${id} .customer-name { font-size: ${isPdf ? "11pt" : "14px"}; font-weight: 700; color: #111827; margin-bottom: ${isPdf ? "1mm" : "4px"}; }
    #${id} .customer-info { font-size: ${isPdf ? "9pt" : "11px"}; color: #4b5563; line-height: 1.4; }

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
      background: ${styleConfig.tableHeaderBg};
      color: ${styleConfig.tableHeaderColor};
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #${id} table.stmt-items tbody td {
      padding: ${isPdf ? "2mm 2mm" : "8px 8px"};
      border-bottom: 1px solid #e5e7eb;
      vertical-align: middle;
    }
    #${id} table.stmt-items tbody tr.opening-row td { background: #f1f5f9; font-weight: 500; }
    #${id} table.stmt-items tbody tr.alt-row td { background: #f8fafc; }
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
      font-size: ${isPdf ? "11pt" : "16px"};
      font-weight: 700;
      break-inside: avoid;
    }

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
    #${id} .body { flex: 1; }
    #${id} .footer {
      margin-top: auto;
      padding-top: ${isPdf ? "4mm" : "14px"};
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: ${isPdf ? "8.5pt" : "10px"};
      color: #6b7280;
      line-height: 1.4;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* ── Style: modern — header background ── */
    ${
      templateStyle === "modern"
        ? `
      #${id} .header {
        background: ${styleConfig.headerBg};
        color: ${styleConfig.headerTextColor};
        padding: ${isPdf ? "5mm" : "20px"};
        margin: ${isPdf ? `-${STANDARD_MARGIN_MM}mm -${STANDARD_MARGIN_MM}mm 4mm -${STANDARD_MARGIN_MM}mm` : "-24px -24px 16px -24px"};
        height: auto;
        box-sizing: content-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      #${id} .header .company,
      #${id} .header .company strong,
      #${id} .header .meta { color: ${styleConfig.headerTextColor}; }
      #${id} .doc-title { color: ${styleConfig.headerTextColor}; }
    `
        : ""
    }

    /* ── Style: professional — top border ── */
    ${
      templateStyle === "professional"
        ? `
      #${id} .header {
        background: #ffffff;
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
      #${id} .doc-title { color: ${styleConfig.brandColor}; }
    `
        : ""
    }

    /* ── Style: minimalist ── */
    ${
      templateStyle === "minimalist"
        ? `
      #${id} .header { background: transparent !important; border: none !important; height: auto; }
      #${id} .doc-title { font-weight: 400; letter-spacing: 0.15em; color: #6b7280; font-size: ${isPdf ? "14pt" : "20px"}; }
      #${id} .divider { display: none; }
      #${id} .section-label { color: #9ca3af; font-weight: 400; }
      #${id} table.stmt-items thead th { background: transparent !important; border-bottom: 1px solid #e5e7eb; color: #9ca3af; font-weight: 500; }
      #${id} table.stmt-items tbody td { border-bottom: 1px solid #f3f4f6; }
    `
        : ""
    }

    @media print {
      html, body { margin: 0; padding: 0; width: 210mm; height: 297mm; }
      #${id}.statement-page { width: 210mm; min-height: 297mm; page-break-after: always; }
      #${id} .stmt-inner { padding: 0; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      tr, td, th { break-inside: avoid; page-break-inside: avoid; }
      .stmt-totals, .banking { break-inside: avoid; page-break-inside: avoid; }
    }
  `;

  const balanceClass = (amount: number) => (amount > 0 ? "bal-owed" : amount < 0 ? "bal-credit" : "bal-zero");

  return (
    <div id={id} className="statement-page">
      <style dangerouslySetInnerHTML={{ __html: embeddedStyles }} />
      {variant === "pdf" && <style dangerouslySetInnerHTML={{ __html: PDF_PRINT_STYLES }} />}

      <div className="stmt-inner">
        <div className="body">
          {/* HEADER — identical structure to UnifiedInvoiceLayout */}
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
              <div className="doc-title">
                {statementType === "outstanding" ? "OUTSTANDING STATEMENT" : "ACTIVITY STATEMENT"}
              </div>
              <div className="meta">
                <div>
                  <strong>Statement Date:</strong> {format(new Date(), "dd/MM/yyyy")}
                </div>
                <div>
                  <strong>Period:</strong> {format(dateRange.from, "dd/MM/yyyy")} → {format(dateRange.to, "dd/MM/yyyy")}
                </div>
              </div>
            </div>
          </div>

          {templateStyle !== "modern" && <hr className="divider" />}

          {/* CUSTOMER */}
          <div className="stmt-for">
            <div className="section-label">Statement For</div>
            <div className="customer-name">{customer.name}</div>
            <div className="customer-info">
              {customer.email && <div>{customer.email}</div>}
              {customer.address && <div style={{ whiteSpace: "pre-line" }}>{customer.address}</div>}
              {customer.vat_number && <div>VAT: {customer.vat_number}</div>}
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
              <div
                className={`closing-row ${balanceClass(closingBalance)}`}
                style={{
                  borderTop: `2px solid ${closingBalance > 0 ? "#dc2626" : closingBalance < 0 ? "#16a34a" : "#6b7280"}`,
                }}
              >
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
        </div>

        {/* FOOTER — matches invoice footer style */}
        <div className="footer">
          Statement generated on {format(new Date(), "dd MMMM yyyy")} • {companySettings?.name || "Your Company"} • All
          amounts in EUR.
        </div>
      </div>
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
