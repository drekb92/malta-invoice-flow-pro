import { format } from 'date-fns';

// Format currency with thousands separators: €X,XXX.XX
const formatCurrency = (amount: number): string => {
  return `€${amount.toLocaleString('en-IE', { 
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

export interface StatementCompanySettings {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  vat_number?: string;
  logo?: string;
}

export interface StatementCustomer {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  vat_number: string | null;
}

export interface StatementInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  amount: number;
  vat_amount: number;
  paid_amount?: number;
}

export interface StatementCreditNote {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  amount: number;
  vat_rate: number;
  reason: string;
  invoice_id?: string | null;
}

export interface StatementPayment {
  id: string;
  payment_date: string;
  amount: number;
  method: string | null;
  invoice_id: string;
}

export interface StatementOptions {
  dateFrom: Date;
  dateTo: Date;
  statementType: "outstanding" | "activity";
  includeCreditNotes: boolean;
  includeVatBreakdown: boolean;
}

export interface StatementTemplateSettings {
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

export interface StatementData {
  customer: StatementCustomer;
  invoices: StatementInvoice[];
  creditNotes: StatementCreditNote[];
  payments: StatementPayment[];
  company: StatementCompanySettings;
  options: StatementOptions;
  generatedAt: Date;
}

export interface UnifiedStatementLayoutProps {
  statementData: StatementData;
  templateSettings?: StatementTemplateSettings;
  id?: string;
}

export const UnifiedStatementLayout = ({
  statementData,
  templateSettings,
  id = 'statement-preview-root',
}: UnifiedStatementLayoutProps) => {
  const primaryColor = templateSettings?.primaryColor || '#1a365d';
  const accentColor = templateSettings?.accentColor || '#2563eb';
  const fontFamily = templateSettings?.fontFamily || 'Inter';

  const { customer, invoices, creditNotes, payments, company, options, generatedAt } = statementData;
  const isOutstanding = options.statementType === 'outstanding';

  // Get absolute logo URL
  const getAbsoluteLogoUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) {
      return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos${url}`;
    }
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${url}`;
  };

  const logoUrl = getAbsoluteLogoUrl(company.logo);

  // Calculate payments and credits per invoice
  const paymentsByInvoice = new Map<string, number>();
  payments.forEach((pmt) => {
    const current = paymentsByInvoice.get(pmt.invoice_id) || 0;
    paymentsByInvoice.set(pmt.invoice_id, current + pmt.amount);
  });

  const creditsByInvoice = new Map<string, number>();
  creditNotes.forEach((cn) => {
    if (cn.invoice_id) {
      const totalAmount = cn.amount + cn.amount * cn.vat_rate;
      const current = creditsByInvoice.get(cn.invoice_id) || 0;
      creditsByInvoice.set(cn.invoice_id, current + totalAmount);
    }
  });

  // Filter invoices for outstanding view
  const displayInvoices = isOutstanding
    ? invoices.filter((inv) => {
        const paid = paymentsByInvoice.get(inv.id) || 0;
        const credits = creditsByInvoice.get(inv.id) || 0;
        return inv.total_amount - paid - credits > 0.01;
      })
    : invoices;

  // Build activity transactions
  interface Transaction {
    date: Date;
    description: string;
    type: string;
    debit: number;
    credit: number;
  }

  const transactions: Transaction[] = [];
  if (!isOutstanding) {
    invoices.forEach((inv) => {
      transactions.push({
        date: new Date(inv.invoice_date),
        description: `Invoice ${inv.invoice_number}`,
        type: "INV",
        debit: inv.total_amount,
        credit: 0,
      });
    });

    if (options.includeCreditNotes) {
      creditNotes.forEach((cn) => {
        const totalAmount = cn.amount + cn.amount * cn.vat_rate;
        transactions.push({
          date: new Date(cn.credit_note_date),
          description: `Credit Note ${cn.credit_note_number}`,
          type: "CN",
          debit: 0,
          credit: totalAmount,
        });
      });
    }

    payments.forEach((pmt) => {
      transactions.push({
        date: new Date(pmt.payment_date),
        description: `Payment${pmt.method ? ` (${pmt.method})` : ""}`,
        type: "PMT",
        debit: 0,
        credit: pmt.amount,
      });
    });

    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // Calculate totals
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
  const totalCredits = creditNotes.reduce((sum, cn) => sum + cn.amount + cn.amount * cn.vat_rate, 0);
  const totalPayments = payments.reduce((sum, pmt) => sum + pmt.amount, 0);
  const finalBalance = totalInvoiced - totalCredits - totalPayments;

  // Outstanding totals
  const totalOutstanding = displayInvoices.reduce((sum, inv) => {
    const paid = paymentsByInvoice.get(inv.id) || 0;
    const credits = creditsByInvoice.get(inv.id) || 0;
    return sum + (inv.total_amount - paid - credits);
  }, 0);

  const containerStyle: React.CSSProperties = {
    width: '21cm',
    minHeight: '29.7cm',
    backgroundColor: 'white',
    padding: '20mm',
    boxSizing: 'border-box',
    fontFamily: `'${fontFamily}', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
    fontSize: '14px',
    color: '#111827',
    position: 'relative',
  };

  return (
    <div id={id} style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        {/* Left: Company Info */}
        <div>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Company Logo"
              crossOrigin="anonymous"
              style={{ maxHeight: '50px', width: 'auto', objectFit: 'contain', marginBottom: '0.75rem' }}
            />
          )}
          <div style={{ color: primaryColor, fontSize: '18px', fontWeight: 700, marginBottom: '0.25rem' }}>
            {company.name || 'Your Company'}
          </div>
          <div style={{ fontSize: '9px', color: '#6b7280', lineHeight: 1.5 }}>
            {company.address && <div>{company.address}</div>}
            {(company.city || company.country) && (
              <div>{[company.city, company.country].filter(Boolean).join(', ')}</div>
            )}
            {company.phone && <div>Tel: {company.phone}</div>}
            {company.email && <div>{company.email}</div>}
            {company.vat_number && <div>VAT: {company.vat_number}</div>}
          </div>
        </div>

        {/* Right: Statement Title */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: primaryColor, fontSize: '20px', fontWeight: 700, marginBottom: '0.5rem' }}>
            {isOutstanding ? 'OUTSTANDING STATEMENT' : 'ACTIVITY STATEMENT'}
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>
            <div>Statement Date: {format(generatedAt, 'dd/MM/yyyy')}</div>
            <div>Period: {format(options.dateFrom, 'dd/MM/yyyy')} → {format(options.dateTo, 'dd/MM/yyyy')}</div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #e5e7eb', marginBottom: '1.5rem' }} />

      {/* Customer Info */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ color: accentColor, fontSize: '11px', fontWeight: 700, marginBottom: '0.25rem' }}>
          Statement For:
        </div>
        <div style={{ fontSize: '11px', fontWeight: 500 }}>{customer.name}</div>
        {customer.address && (
          <div style={{ fontSize: '9px', color: '#6b7280', whiteSpace: 'pre-line' }}>{customer.address}</div>
        )}
        {customer.vat_number && (
          <div style={{ fontSize: '9px', color: '#6b7280' }}>VAT Number: {customer.vat_number}</div>
        )}
      </div>

      {/* Outstanding Table */}
      {isOutstanding && (
        <div style={{ marginBottom: '1.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <thead>
              <tr style={{ backgroundColor: primaryColor }}>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'left', fontWeight: 600 }}>Invoice #</th>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'left', fontWeight: 600 }}>Due Date</th>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>Amount</th>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>Paid</th>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>Remaining</th>
              </tr>
            </thead>
            <tbody>
              {displayInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>
                    No outstanding invoices for this period.
                  </td>
                </tr>
              ) : (
                displayInvoices.map((inv, index) => {
                  const paidAmount = (paymentsByInvoice.get(inv.id) || 0) + (creditsByInvoice.get(inv.id) || 0);
                  const remaining = inv.total_amount - paidAmount;
                  return (
                    <tr key={inv.id} style={{ backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white' }}>
                      <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{inv.invoice_number}</td>
                      <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{format(new Date(inv.invoice_date), 'dd/MM/yyyy')}</td>
                      <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{format(new Date(inv.due_date), 'dd/MM/yyyy')}</td>
                      <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{formatCurrency(inv.total_amount)}</td>
                      <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{formatCurrency(paidAmount)}</td>
                      <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>{formatCurrency(remaining)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Activity Table */}
      {!isOutstanding && (
        <div style={{ marginBottom: '1.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <thead>
              <tr style={{ backgroundColor: primaryColor }}>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'left', fontWeight: 600 }}>Date</th>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'left', fontWeight: 600 }}>Description</th>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'center', fontWeight: 600 }}>Type</th>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>Debit</th>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>Credit</th>
                <th style={{ color: 'white', padding: '8px 6px', textAlign: 'right', fontWeight: 600 }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '12px', textAlign: 'center', color: '#6b7280' }}>
                    No transactions for this period.
                  </td>
                </tr>
              ) : (
                (() => {
                  let runningBalance = 0;
                  return transactions.map((txn, index) => {
                    runningBalance += txn.debit - txn.credit;
                    const balanceColor = runningBalance > 0 ? '#dc2626' : runningBalance < 0 ? '#16a34a' : '#6b7280';
                    return (
                      <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#f8fafc' : 'white' }}>
                        <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{format(txn.date, 'dd/MM/yyyy')}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb' }}>{txn.description}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>{txn.type}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{formatDebit(txn.debit)}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{formatCredit(txn.credit)}</td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: balanceColor, fontWeight: 600 }}>{formatBalance(runningBalance)}</td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Section - avoid page break */}
      <div style={{ pageBreakInside: 'avoid' }}>
        <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem' }}>
          {isOutstanding ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '200px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '10px' }}>
                  <span>Open Invoices:</span>
                  <span>{displayInvoices.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, color: '#dc2626', borderTop: '2px solid #dc2626', paddingTop: '0.5rem' }}>
                  <span>Total Due:</span>
                  <span>{formatCurrency(totalOutstanding)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '220px', fontSize: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Total Invoiced:</span>
                  <span>{formatCurrency(totalInvoiced)}</span>
                </div>
                {options.includeCreditNotes && totalCredits > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>Total Credits:</span>
                    <span>{formatCredit(totalCredits)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Total Payments:</span>
                  <span>{formatCredit(totalPayments)}</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: '14px', 
                  fontWeight: 700, 
                  color: finalBalance > 0 ? '#dc2626' : finalBalance < 0 ? '#16a34a' : '#6b7280',
                  borderTop: `2px solid ${finalBalance > 0 ? '#dc2626' : finalBalance < 0 ? '#16a34a' : '#6b7280'}`,
                  paddingTop: '0.5rem'
                }}>
                  <span>{finalBalance > 0 ? 'Balance Due:' : finalBalance < 0 ? 'Credit Balance:' : 'Balance:'}</span>
                  <span>{formatBalance(finalBalance)}</span>
                </div>
                {finalBalance < 0 && (
                  <div style={{ fontSize: '8px', color: '#16a34a', marginTop: '0.25rem', textAlign: 'right' }}>
                    This is a credit balance in your favour.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        position: 'absolute', 
        bottom: '20mm', 
        left: '20mm', 
        right: '20mm', 
        borderTop: '1px solid #e5e7eb', 
        paddingTop: '0.75rem',
        fontSize: '8px',
        color: '#9ca3af',
        textAlign: 'center'
      }}>
        Statement generated on {format(generatedAt, 'dd MMMM yyyy')} • {company.name}
      </div>
    </div>
  );
};
