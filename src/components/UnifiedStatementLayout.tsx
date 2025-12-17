import { format } from 'date-fns';
import { PDF_PRINT_STYLES } from '@/lib/pdfPrintStyles';

// Re-use types from UnifiedInvoiceLayout for consistency
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
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  bankingVisibility?: boolean;
}

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
  type: 'invoice' | 'credit_note' | 'payment';
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
  statementType?: 'outstanding' | 'activity';
  variant?: 'preview' | 'pdf' | 'print';
  id?: string;
  templateId?: string;
}

// Format currency with thousands separators: €X,XXX.XX
const formatCurrency = (amount: number): string => {
  return `€${Math.abs(amount).toLocaleString('en-IE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

// Format debit amount (positive, no sign)
const formatDebit = (amount: number): string => {
  if (amount <= 0) return "";
  return formatCurrency(amount);
};

// Format credit amount in parentheses
const formatCredit = (amount: number): string => {
  if (amount <= 0) return "";
  return `(${formatCurrency(amount)})`;
};

// Format balance: positive normal, negative in parentheses
const formatBalance = (amount: number): string => {
  if (amount === 0) return "€0.00";
  if (amount > 0) return formatCurrency(amount);
  return `(${formatCurrency(Math.abs(amount))})`;
};

export const UnifiedStatementLayout = ({
  customer,
  companySettings,
  bankingSettings,
  templateSettings,
  statementLines,
  dateRange,
  openingBalance,
  closingBalance,
  statementType = 'activity',
  variant = 'pdf',
  id = 'invoice-preview-root',
  templateId,
}: UnifiedStatementLayoutProps) => {
  // Default template settings - matching invoice defaults
  const primaryColor = templateSettings?.primaryColor || '#26A65B';
  const accentColor = templateSettings?.accentColor || '#1F2D3D';
  const fontFamily = templateSettings?.fontFamily || 'Inter';
  const fontSize = templateSettings?.fontSize || '14px';
  const bankingVisibility = templateSettings?.bankingVisibility !== false;

  // Margins for PDF variant
  const marginTop = templateSettings?.marginTop || 20;
  const marginRight = templateSettings?.marginRight || 20;
  const marginBottom = templateSettings?.marginBottom || 20;
  const marginLeft = templateSettings?.marginLeft || 20;

  // Get absolute logo URL
  const getAbsoluteLogoUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) {
      return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos${url}`;
    }
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${url}`;
  };

  const logoUrl = getAbsoluteLogoUrl(companySettings?.logo);

  // Calculate totals
  const totalDebits = statementLines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = statementLines.reduce((sum, line) => sum + line.credit, 0);

  // CSS variables for consistent styling (matching invoice layout)
  const cssVariables = {
    '--invoice-font-family': `'${fontFamily}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
    '--invoice-font-size': fontSize,
    '--invoice-primary-color': primaryColor,
    '--invoice-accent-color': accentColor,
    '--invoice-margin-top': `${marginTop}mm`,
    '--invoice-margin-right': `${marginRight}mm`,
    '--invoice-margin-bottom': `${marginBottom}mm`,
    '--invoice-margin-left': `${marginLeft}mm`,
  } as React.CSSProperties;

  // Container styling based on variant using CSS variables
  const containerStyle: React.CSSProperties = variant === 'pdf'
    ? {
        ...cssVariables,
        width: '21cm',
        minHeight: '29.7cm',
        backgroundColor: 'white',
        paddingTop: 'var(--invoice-margin-top)',
        paddingRight: 'var(--invoice-margin-right)',
        paddingBottom: 'var(--invoice-margin-bottom)',
        paddingLeft: 'var(--invoice-margin-left)',
        boxSizing: 'border-box',
        fontFamily: 'var(--invoice-font-family)',
        fontSize: 'var(--invoice-font-size)',
        color: 'var(--invoice-accent-color)',
        position: 'relative',
      }
    : variant === 'print'
    ? {
        ...cssVariables,
        width: '21cm',
        minHeight: '29.7cm',
        backgroundColor: 'white',
        padding: '1.5cm',
        boxSizing: 'border-box',
        fontFamily: 'var(--invoice-font-family)',
        fontSize: 'var(--invoice-font-size)',
        color: 'var(--invoice-accent-color)',
      }
    : {
        ...cssVariables,
        fontFamily: 'var(--invoice-font-family)',
        fontSize: 'var(--invoice-font-size)',
        color: 'var(--invoice-accent-color)',
        backgroundColor: 'white',
        padding: '2rem',
      };

  const containerClassName = variant === 'pdf'
    ? 'bg-white'
    : variant === 'print'
    ? 'bg-white print:shadow-none'
    : 'bg-white max-w-4xl mx-auto shadow-lg';

  // Row style helper for alternating colors
  const getRowStyle = (index: number): React.CSSProperties => ({
    backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white',
    pageBreakInside: 'avoid',
  });

  return (
    <div
      id={id}
      className={containerClassName}
      style={containerStyle}
    >
      {/* PDF Print Styles */}
      {variant === 'pdf' && <style dangerouslySetInnerHTML={{ __html: PDF_PRINT_STYLES }} />}

      {/* Header Section - matching invoice layout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        {/* Logo */}
        {logoUrl && (
          <div>
            <img
              src={logoUrl}
              alt="Company Logo"
              crossOrigin="anonymous"
              style={{
                maxHeight: '60px',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>
        )}

        {/* Document Title and Meta */}
        <div style={{ textAlign: 'right' }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 300,
              letterSpacing: '0.1em',
              marginBottom: '1rem',
              color: 'var(--invoice-primary-color)',
            }}
          >
            {statementType === 'outstanding' ? 'OUTSTANDING STATEMENT' : 'ACTIVITY STATEMENT'}
          </h1>
          <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
            <div>
              <span style={{ fontWeight: 500 }}>Statement Date:</span> {format(new Date(), 'dd/MM/yyyy')}
            </div>
            <div>
              <span style={{ fontWeight: 500 }}>Period:</span> {format(dateRange.from, 'dd/MM/yyyy')} → {format(dateRange.to, 'dd/MM/yyyy')}
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #e5e7eb', marginBottom: '1.5rem' }} />

      {/* Two Column: Company Info + Customer Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Company Info */}
        <div>
          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#6b7280',
              marginBottom: '0.5rem',
            }}
          >
            From
          </div>
          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
            {companySettings?.name || 'Your Company'}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
            {companySettings?.address && <div>{companySettings.address}</div>}
            {(companySettings?.city || companySettings?.country) && (
              <div>{[companySettings.city, companySettings.state, companySettings.zipCode, companySettings.country].filter(Boolean).join(', ')}</div>
            )}
            {companySettings?.phone && <div>Tel: {companySettings.phone}</div>}
            {companySettings?.email && <div>{companySettings.email}</div>}
            {companySettings?.taxId && <div>VAT: {companySettings.taxId}</div>}
          </div>
        </div>

        {/* Customer Info */}
        <div>
          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#6b7280',
              marginBottom: '0.5rem',
            }}
          >
            Statement For
          </div>
          <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
            {customer.name}
          </div>
          <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
            {customer.email && <div>{customer.email}</div>}
            {customer.address && (
              <div style={{ whiteSpace: 'pre-line' }}>{customer.address}</div>
            )}
            {customer.vat_number && <div>VAT: {customer.vat_number}</div>}
          </div>
        </div>
      </div>

      {/* Statement Table */}
      <div style={{ marginBottom: '1.5rem' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          fontSize: '12px',
          tableLayout: 'fixed', // Fixed table layout for consistent columns
        }}>
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '38%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: 'var(--invoice-primary-color)' }}>
              <th style={{ color: 'white', padding: '10px 8px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Date</th>
              <th style={{ color: 'white', padding: '10px 8px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</th>
              <th style={{ color: 'white', padding: '10px 8px', textAlign: 'center', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Type</th>
              <th style={{ color: 'white', padding: '10px 8px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Debit</th>
              <th style={{ color: 'white', padding: '10px 8px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Credit</th>
              <th style={{ color: 'white', padding: '10px 8px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {/* Opening Balance Row */}
            {statementType === 'activity' && (
              <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 500, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{format(dateRange.from, 'dd/MM/yyyy')}</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }} colSpan={4}>Opening Balance</td>
                <td style={{ 
                  padding: '8px', 
                  borderBottom: '1px solid #e5e7eb', 
                  textAlign: 'right',
                  color: openingBalance > 0 ? '#dc2626' : openingBalance < 0 ? '#16a34a' : '#6b7280',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatBalance(openingBalance)}
                </td>
              </tr>
            )}

            {/* Transaction Rows */}
            {statementLines.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>
                  No transactions for this period.
                </td>
              </tr>
            ) : (
              (() => {
                let runningBalance = openingBalance;
                return statementLines.map((line, index) => {
                  runningBalance += line.debit - line.credit;
                  const balanceColor = runningBalance > 0 ? '#dc2626' : runningBalance < 0 ? '#16a34a' : '#6b7280';
                  const typeLabel = line.type === 'invoice' ? 'INV' : line.type === 'credit_note' ? 'CN' : 'PMT';
                  
                  return (
                    <tr key={line.id} style={{ 
                      ...getRowStyle(index),
                      breakInside: 'avoid',
                      pageBreakInside: 'avoid',
                    }}>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                        {format(new Date(line.date), 'dd/MM/yyyy')}
                      </td>
                      <td style={{ 
                        padding: '8px', 
                        borderBottom: '1px solid #e5e7eb',
                        whiteSpace: 'normal',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}>
                        {line.description}
                        {line.reference && (
                          <span style={{ color: '#9ca3af', marginLeft: '0.5rem' }}>({line.reference})</span>
                        )}
                      </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                        <span style={{ 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontSize: '10px',
                          fontWeight: 500,
                          backgroundColor: line.type === 'invoice' ? '#dbeafe' : line.type === 'credit_note' ? '#fef3c7' : '#d1fae5',
                          color: line.type === 'invoice' ? '#1e40af' : line.type === 'credit_note' ? '#92400e' : '#065f46',
                          whiteSpace: 'nowrap',
                        }}>
                          {typeLabel}
                        </span>
                      </td>
                      <td style={{ 
                        padding: '8px', 
                        borderBottom: '1px solid #e5e7eb', 
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {formatDebit(line.debit)}
                      </td>
                      <td style={{ 
                        padding: '8px', 
                        borderBottom: '1px solid #e5e7eb', 
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {formatCredit(line.credit)}
                      </td>
                      <td style={{ 
                        padding: '8px', 
                        borderBottom: '1px solid #e5e7eb', 
                        textAlign: 'right',
                        color: balanceColor,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {formatBalance(runningBalance)}
                      </td>
                    </tr>
                  );
                });
              })()
            )}
          </tbody>
        </table>
      </div>

      {/* Totals Section - avoid page break */}
      <div style={{ 
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
      }}>
        <div style={{ 
          borderTop: '2px solid #e5e7eb', 
          paddingTop: '1rem',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <div style={{ width: '280px' }}>
            {/* Summary rows */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '13px' }}>
              <span style={{ color: '#6b7280' }}>Total Debits:</span>
              <span style={{ fontWeight: 500, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalDebits)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '13px' }}>
              <span style={{ color: '#6b7280' }}>Total Credits:</span>
              <span style={{ fontWeight: 500, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatCredit(totalCredits)}</span>
            </div>

            {/* Closing Balance - prominent */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: `2px solid ${closingBalance > 0 ? '#dc2626' : closingBalance < 0 ? '#16a34a' : '#6b7280'}`,
              fontSize: '16px',
              fontWeight: 700,
              color: closingBalance > 0 ? '#dc2626' : closingBalance < 0 ? '#16a34a' : '#6b7280',
            }}>
              <span>{closingBalance > 0 ? 'Balance Due:' : closingBalance < 0 ? 'Credit Balance:' : 'Balance:'}</span>
              <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatBalance(closingBalance)}</span>
            </div>

            {/* Credit balance note */}
            {closingBalance < 0 && (
              <div style={{ fontSize: '10px', color: '#16a34a', marginTop: '0.25rem', textAlign: 'right' }}>
                This is a credit balance in your favour.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Banking Details - if visible, keep together with totals */}
      {bankingVisibility && bankingSettings && (bankingSettings.bankName || bankingSettings.iban) && (
        <div style={{ 
          marginTop: '2rem', 
          paddingTop: '1rem', 
          borderTop: '1px solid #e5e7eb',
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
        }}>
          <div
            style={{
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#6b7280',
              marginBottom: '0.5rem',
            }}
          >
            Payment Details
          </div>
          <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>
            {bankingSettings.bankName && <div><span style={{ color: '#6b7280' }}>Bank:</span> {bankingSettings.bankName}</div>}
            {bankingSettings.accountName && <div><span style={{ color: '#6b7280' }}>Account Name:</span> {bankingSettings.accountName}</div>}
            {bankingSettings.iban && <div><span style={{ color: '#6b7280' }}>IBAN:</span> {bankingSettings.iban}</div>}
            {bankingSettings.swiftCode && <div><span style={{ color: '#6b7280' }}>SWIFT/BIC:</span> {bankingSettings.swiftCode}</div>}
            {bankingSettings.accountNumber && <div><span style={{ color: '#6b7280' }}>Account Number:</span> {bankingSettings.accountNumber}</div>}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        position: 'absolute', 
        bottom: 'var(--invoice-margin-bottom)', 
        left: 'var(--invoice-margin-left)', 
        right: 'var(--invoice-margin-right)', 
        borderTop: '1px solid #e5e7eb', 
        paddingTop: '0.75rem',
        fontSize: '10px',
        color: '#9ca3af',
        textAlign: 'center',
      }}>
        Statement generated on {format(new Date(), 'dd MMMM yyyy')} • {companySettings?.name || 'Your Company'}
      </div>
    </div>
  );
};

// Legacy interface for backward compatibility with StatementModal
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
    city?: string;
    country?: string;
    vat_number?: string;
    logo?: string;
  };
  options: {
    dateFrom: Date;
    dateTo: Date;
    statementType: 'outstanding' | 'activity';
    includeCreditNotes: boolean;
    includeVatBreakdown: boolean;
  };
  generatedAt: Date;
}

// Helper function to convert legacy data to new format
export function convertLegacyStatementData(data: LegacyStatementData): {
  customer: StatementCustomer;
  companySettings: CompanySettings;
  statementLines: StatementLine[];
  dateRange: DateRange;
  openingBalance: number;
  closingBalance: number;
  statementType: 'outstanding' | 'activity';
} {
  const { customer, company, invoices, creditNotes, payments, options } = data;

  // Build statement lines from transactions
  const lines: StatementLine[] = [];

  // Add invoices (debits)
  invoices.forEach((inv) => {
    lines.push({
      id: inv.id,
      date: inv.invoice_date,
      description: `Invoice ${inv.invoice_number}`,
      type: 'invoice',
      reference: inv.invoice_number,
      debit: inv.total_amount,
      credit: 0,
    });
  });

  // Add credit notes (credits)
  if (options.includeCreditNotes) {
    creditNotes.forEach((cn) => {
      const totalAmount = cn.amount + cn.amount * cn.vat_rate;
      lines.push({
        id: cn.id,
        date: cn.credit_note_date,
        description: `Credit Note ${cn.credit_note_number}`,
        type: 'credit_note',
        reference: cn.credit_note_number,
        debit: 0,
        credit: totalAmount,
      });
    });
  }

  // Add payments (credits)
  payments.forEach((pmt) => {
    lines.push({
      id: pmt.id,
      date: pmt.payment_date,
      description: `Payment${pmt.method ? ` (${pmt.method})` : ''}`,
      type: 'payment',
      reference: '',
      debit: 0,
      credit: pmt.amount,
    });
  });

  // Sort by date
  lines.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate balances
  const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0);
  const closingBalance = totalDebits - totalCredits;

  return {
    customer,
    companySettings: {
      name: company.name,
      email: company.email,
      phone: company.phone,
      address: company.address,
      city: company.city,
      country: company.country,
      taxId: company.vat_number,
      logo: company.logo,
    },
    statementLines: lines,
    dateRange: {
      from: options.dateFrom,
      to: options.dateTo,
    },
    openingBalance: 0, // Could be calculated from historical data if needed
    closingBalance,
    statementType: options.statementType,
  };
}

// Re-export types for backward compatibility
export type { LegacyStatementData as StatementData };
export type StatementInvoice = LegacyStatementData['invoices'][0];
export type StatementCreditNote = LegacyStatementData['creditNotes'][0];
export type StatementPayment = LegacyStatementData['payments'][0];
