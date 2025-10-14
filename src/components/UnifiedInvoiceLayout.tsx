import { formatDate, money, percent, mul } from '@/lib/invoiceUtils';

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
  layout?: 'default' | 'cleanMinimal' | 'compact';
  headerLayout?: string;
  tableStyle?: string;
  totalsStyle?: string;
  bankingVisibility?: boolean;
  bankingStyle?: string;
  companyPosition?: 'left' | 'right' | 'top-right'; // Company details position
  bankingPosition?: 'after-totals' | 'bottom' | 'footer'; // Banking details position
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
    type: 'amount' | 'percent';
    value: number;
    amount: number;
  };
}

export interface UnifiedInvoiceLayoutProps {
  invoiceData: InvoiceData;
  companySettings?: CompanySettings;
  bankingSettings?: BankingSettings;
  templateSettings?: TemplateSettings;
  variant?: 'preview' | 'pdf' | 'print';
  id?: string;
  debug?: boolean; // Add debug mode to show data source
}

export const UnifiedInvoiceLayout = ({
  invoiceData,
  companySettings,
  bankingSettings,
  templateSettings,
  variant = 'preview',
  id = 'unified-invoice',
  debug = false,
}: UnifiedInvoiceLayoutProps) => {
  // Default template settings
  const primaryColor = templateSettings?.primaryColor || '#26A65B';
  const accentColor = templateSettings?.accentColor || '#1F2D3D';
  const fontFamily = templateSettings?.fontFamily || 'Inter';
  const fontSize = templateSettings?.fontSize || '14px';
  const layout = templateSettings?.layout || 'default';
  const companyPosition = templateSettings?.companyPosition || 'left';
  const bankingPosition = templateSettings?.bankingPosition || 'after-totals';

  // Get absolute logo URL
  const getAbsoluteLogoUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) {
      return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos${url}`;
    }
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${url}`;
  };

  const logoUrl = getAbsoluteLogoUrl(companySettings?.logo);

  // Container styling based on variant
  const containerStyle: React.CSSProperties = variant === 'pdf'
    ? {
        width: '21cm',
        minHeight: '29.7cm',
        backgroundColor: 'white',
        padding: '1.5cm',
        boxSizing: 'border-box',
        fontFamily,
        fontSize,
        color: accentColor,
        position: 'relative',
      }
    : {
        fontFamily,
        fontSize,
        color: accentColor,
        backgroundColor: 'white',
        padding: variant === 'print' ? '1.5cm' : '2rem',
      };

  const containerClassName = variant === 'pdf'
    ? 'bg-white'
    : variant === 'print'
    ? 'bg-white print:shadow-none'
    : 'bg-white max-w-4xl mx-auto shadow-lg';

  // Clean minimal layout
  if (layout === 'cleanMinimal') {
    return (
      <div
        id={id}
        className={containerClassName}
        style={containerStyle}
      >
        {/* Debug Mode Banner */}
        {debug && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: '#fef3c7',
            border: '2px solid #f59e0b',
            padding: '8px 12px',
            fontSize: '11px',
            fontFamily: 'monospace',
            zIndex: 1000,
          }}>
            <strong>DEBUG MODE:</strong> Company: {companySettings?.name || 'Missing'} | 
            Banking: {bankingSettings?.bankName || 'Missing'} | 
            Layout: {layout} | 
            Variant: {variant}
          </div>
        )}

        {/* Header Section */}
        <div className="flex justify-between items-start mb-16">
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

          {/* Invoice Title and Meta */}
          <div className="text-right">
            <h1
              className="text-4xl font-light tracking-wider mb-6"
              style={{ color: primaryColor }}
            >
              INVOICE
            </h1>
            <div className="space-y-1 text-sm" style={{ color: '#6b7280' }}>
              <div>
                <span className="font-medium">Invoice #:</span> {invoiceData.invoiceNumber}
              </div>
              <div>
                <span className="font-medium">Date:</span> {formatDate(invoiceData.invoiceDate)}
              </div>
              <div>
                <span className="font-medium">Due:</span> {formatDate(invoiceData.dueDate)}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #e5e7eb', marginBottom: '2rem' }} />

        {/* Customer Info */}
        <div className="mb-12">
          <div
            className="text-xs uppercase tracking-wider mb-2"
            style={{ color: '#6b7280' }}
          >
            Bill To
          </div>
          <div className="text-base font-medium">{invoiceData.customer.name}</div>
          {invoiceData.customer.email && (
            <div className="text-sm" style={{ color: '#6b7280' }}>
              {invoiceData.customer.email}
            </div>
          )}
          {invoiceData.customer.address && (
            <div className="text-sm whitespace-pre-line" style={{ color: '#6b7280' }}>
              {invoiceData.customer.address}
            </div>
          )}
          {invoiceData.customer.vat_number && (
            <div className="text-sm" style={{ color: '#6b7280' }}>
              <span className="font-medium">VAT:</span> {invoiceData.customer.vat_number}
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="mb-12">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '12px 0',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '12px 0',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    width: '80px',
                  }}
                >
                  Qty
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '12px 0',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    width: '120px',
                  }}
                >
                  Unit Price
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '12px 0',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    width: '80px',
                  }}
                >
                  VAT
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '12px 0',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    width: '120px',
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {invoiceData.items.map((item, index) => {
                const lineTotal = mul(item.quantity, item.unit_price);
                return (
                  <tr key={index} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '16px 0', color: '#111827' }}>
                      {item.description}
                    </td>
                    <td style={{ padding: '16px 0', textAlign: 'right', color: '#6b7280' }}>
                      {item.quantity} {item.unit || ''}
                    </td>
                    <td style={{ padding: '16px 0', textAlign: 'right', color: '#6b7280' }}>
                      {money(item.unit_price)}
                    </td>
                    <td style={{ padding: '16px 0', textAlign: 'right', color: '#6b7280' }}>
                      {percent(item.vat_rate)}
                    </td>
                    <td
                      style={{
                        padding: '16px 0',
                        textAlign: 'right',
                        fontWeight: 500,
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

        {/* Bottom Section: Bank Details and Totals */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            marginTop: '4rem',
          }}
        >
          {/* Bank Details */}
          {bankingSettings && (bankingSettings.bankName || bankingSettings.iban) && (
            <div style={{ width: '50%' }}>
              <div
                className="text-xs uppercase tracking-wider mb-3"
                style={{ color: '#6b7280' }}
              >
                Bank Details
              </div>
              <div className="space-y-1 text-sm" style={{ color: '#374151' }}>
                {bankingSettings.bankName && (
                  <div>
                    <span style={{ color: '#6b7280' }}>Bank:</span> {bankingSettings.bankName}
                  </div>
                )}
                {bankingSettings.accountName && (
                  <div>
                    <span style={{ color: '#6b7280' }}>Account:</span>{' '}
                    {bankingSettings.accountName}
                  </div>
                )}
                {bankingSettings.iban && (
                  <div>
                    <span style={{ color: '#6b7280' }}>IBAN:</span> {bankingSettings.iban}
                  </div>
                )}
                {bankingSettings.swiftCode && (
                  <div>
                    <span style={{ color: '#6b7280' }}>SWIFT:</span> {bankingSettings.swiftCode}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Totals */}
          <div style={{ width: '256px' }}>
            <div className="space-y-2">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  color: '#6b7280',
                }}
              >
                <span>Subtotal:</span>
                <span>
                  {money(
                    invoiceData.totals.netTotal + (invoiceData.discount?.amount || 0)
                  )}
                </span>
              </div>
              {invoiceData.discount && invoiceData.discount.amount > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    color: '#6b7280',
                  }}
                >
                  <span>
                    Discount
                    {invoiceData.discount.type === 'percent'
                      ? ` (${percent(invoiceData.discount.value / 100)})`
                      : ''}
                    :
                  </span>
                  <span>—{money(invoiceData.discount.amount)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  color: '#6b7280',
                }}
              >
                <span>VAT:</span>
                <span>{money(invoiceData.totals.vatTotal)}</span>
              </div>
              <div style={{ borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: primaryColor,
                }}
              >
                <span>Total:</span>
                <span>{money(invoiceData.totals.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: '4rem',
            paddingTop: '2rem',
            borderTop: '1px solid #e5e7eb',
            textAlign: 'center',
            fontSize: '14px',
            color: '#6b7280',
          }}
        >
          Thank you for your business
        </div>
      </div>
    );
  }

  // Default layout
  return (
    <div id={id} className={containerClassName} style={containerStyle}>
      {/* Debug Mode Banner */}
      {debug && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: '#fef3c7',
          border: '2px solid #f59e0b',
          padding: '8px 12px',
          fontSize: '11px',
          fontFamily: 'monospace',
          zIndex: 1000,
        }}>
          <strong>DEBUG MODE:</strong> Company: {companySettings?.name || 'Missing'} | 
          Banking: {bankingSettings?.bankName || 'Missing'} | 
          Layout: {layout} | 
          Variant: {variant}
        </div>
      )}

      {/* Top spacer */}
      {variant === 'pdf' && <div style={{ height: '4mm' }} />}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          marginBottom: '2rem',
        }}
      >
        {/* Left side: Logo and Company Info (if position is 'left') */}
        {companyPosition === 'left' && (
          <div>
            {logoUrl && (
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
            )}
            {companySettings && (
              <div style={{ marginTop: '1rem', fontSize: '12px', color: '#6b7280' }}>
                {companySettings.name && <div style={{ fontWeight: 600 }}>{companySettings.name}</div>}
                {companySettings.address && <div>{companySettings.address}</div>}
                {companySettings.city && (
                  <div>
                    {companySettings.city}
                    {companySettings.state && `, ${companySettings.state}`}{' '}
                    {companySettings.zipCode}
                  </div>
                )}
                {companySettings.email && <div>{companySettings.email}</div>}
                {companySettings.phone && <div>{companySettings.phone}</div>}
              </div>
            )}
          </div>
        )}
        
        {/* Right side: Company Info (if position is 'top-right') or Invoice meta */}
        <div style={{ textAlign: 'right', maxWidth: companyPosition === 'right' || companyPosition === 'top-right' ? '50%' : 'auto' }}>
          {(companyPosition === 'right' || companyPosition === 'top-right') && companySettings && (
            <div style={{ marginBottom: '1.5rem', fontSize: '12px', color: '#6b7280', textAlign: 'right' }}>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Company Logo"
                  crossOrigin="anonymous"
                  style={{
                    maxHeight: '60px',
                    width: 'auto',
                    objectFit: 'contain',
                    marginLeft: 'auto',
                    marginBottom: '0.75rem',
                  }}
                />
              )}
              {companySettings.name && <div style={{ fontWeight: 600 }}>{companySettings.name}</div>}
              {companySettings.address && <div>{companySettings.address}</div>}
              {companySettings.city && (
                <div>
                  {companySettings.city}
                  {companySettings.state && `, ${companySettings.state}`}{' '}
                  {companySettings.zipCode}
                </div>
              )}
              {companySettings.email && <div>{companySettings.email}</div>}
              {companySettings.phone && <div>{companySettings.phone}</div>}
            </div>
          )}
          
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 'bold',
              marginBottom: '0.5rem',
              color: primaryColor,
            }}
          >
            INVOICE
          </h1>
          <div style={{ fontSize: '14px', color: '#374151' }}>
            <div>
              <strong>Invoice #:</strong> {invoiceData.invoiceNumber}
            </div>
            <div>
              <strong>Date:</strong> {formatDate(invoiceData.invoiceDate)}
            </div>
            <div>
              <strong>Due Date:</strong> {formatDate(invoiceData.dueDate)}
            </div>
          </div>
        </div>
      </div>

      {/* Billing Information */}
      <div style={{ marginBottom: '2rem' }}>
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '0.75rem',
            color: accentColor,
          }}
        >
          Bill To:
        </h2>
        <div style={{ fontSize: '14px' }}>
          <div style={{ fontWeight: 500 }}>{invoiceData.customer.name}</div>
          {invoiceData.customer.email && <div>{invoiceData.customer.email}</div>}
          {invoiceData.customer.address && (
            <div style={{ whiteSpace: 'pre-line' }}>{invoiceData.customer.address}</div>
          )}
          {invoiceData.customer.vat_number && (
            <div>
              <strong>VAT Number:</strong> {invoiceData.customer.vat_number}
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div style={{ marginBottom: '2rem' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '1cm',
            fontSize: '10pt',
          }}
        >
          <colgroup>
            <col style={{ width: '46%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: primaryColor }}>
              <th
                style={{
                  color: '#fff',
                  padding: '12pt 10pt',
                  textAlign: 'left',
                  fontWeight: 600,
                  border: '1px solid #e5e7eb',
                }}
              >
                Description
              </th>
              <th
                style={{
                  color: '#fff',
                  padding: '12pt 10pt',
                  textAlign: 'right',
                  fontWeight: 600,
                  border: '1px solid #e5e7eb',
                }}
              >
                Qty
              </th>
              <th
                style={{
                  color: '#fff',
                  padding: '12pt 10pt',
                  textAlign: 'right',
                  fontWeight: 600,
                  border: '1px solid #e5e7eb',
                }}
              >
                Unit Price
              </th>
              <th
                style={{
                  color: '#fff',
                  padding: '12pt 10pt',
                  textAlign: 'right',
                  fontWeight: 600,
                  border: '1px solid #e5e7eb',
                }}
              >
                VAT %
              </th>
              <th
                style={{
                  color: '#fff',
                  padding: '12pt 10pt',
                  textAlign: 'right',
                  fontWeight: 600,
                  border: '1px solid #e5e7eb',
                }}
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {invoiceData.items.map((item, index) => (
              <tr
                key={index}
                style={{
                  backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                }}
              >
                <td style={{ padding: '12px 16px', border: '1px solid #e5e7eb' }}>
                  {item.description}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    border: '1px solid #e5e7eb',
                    textAlign: 'center',
                  }}
                >
                  {item.quantity} {item.unit || ''}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    border: '1px solid #e5e7eb',
                    textAlign: 'right',
                  }}
                >
                  {money(item.unit_price)}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    border: '1px solid #e5e7eb',
                    textAlign: 'center',
                  }}
                >
                  {percent(item.vat_rate)}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    border: '1px solid #e5e7eb',
                    textAlign: 'right',
                  }}
                >
                  {money(mul(item.quantity, item.unit_price))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
        <div style={{ width: '256px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0',
            }}
          >
            <span>Subtotal:</span>
            <span>
              {money(invoiceData.totals.netTotal + (invoiceData.discount?.amount || 0))}
            </span>
          </div>
          {invoiceData.discount && invoiceData.discount.amount > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 0',
              }}
            >
              <span>
                Discount
                {invoiceData.discount.type === 'percent'
                  ? ` (${percent(invoiceData.discount.value / 100)})`
                  : ''}
                :
              </span>
              <span>—{money(invoiceData.discount.amount)}</span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0',
            }}
          >
            <span>VAT Total:</span>
            <span>{money(invoiceData.totals.vatTotal)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              fontWeight: 'bold',
              fontSize: '18px',
              borderTop: `2px solid ${primaryColor}`,
              color: primaryColor,
            }}
          >
            <span>Total:</span>
            <span>{money(invoiceData.totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Banking Section - Position based on setting */}
      {bankingSettings && (bankingSettings.bankName || bankingSettings.iban) && bankingPosition === 'after-totals' && (
        <div
          style={{
            marginTop: '3rem',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '4px',
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: accentColor,
            }}
          >
            Bank Details
          </h3>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {bankingSettings.bankName && (
              <div>
                <strong>Bank:</strong> {bankingSettings.bankName}
              </div>
            )}
            {bankingSettings.accountName && (
              <div>
                <strong>Account Name:</strong> {bankingSettings.accountName}
              </div>
            )}
            {bankingSettings.iban && (
              <div>
                <strong>IBAN:</strong> {bankingSettings.iban}
              </div>
            )}
            {bankingSettings.swiftCode && (
              <div>
                <strong>SWIFT:</strong> {bankingSettings.swiftCode}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Banking at Bottom - Fixed position */}
      {bankingSettings && (bankingSettings.bankName || bankingSettings.iban) && bankingPosition === 'bottom' && variant === 'pdf' && (
        <div
          style={{
            position: 'absolute',
            bottom: '50pt',
            left: '1.5cm',
            right: '1.5cm',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '4px',
            fontSize: '10pt',
          }}
        >
          <h3
            style={{
              fontSize: '11pt',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: accentColor,
            }}
          >
            Bank Details
          </h3>
          <div style={{ fontSize: '9pt', color: '#6b7280', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            {bankingSettings.bankName && (
              <div>
                <strong>Bank:</strong> {bankingSettings.bankName}
              </div>
            )}
            {bankingSettings.accountName && (
              <div>
                <strong>Account:</strong> {bankingSettings.accountName}
              </div>
            )}
            {bankingSettings.iban && (
              <div>
                <strong>IBAN:</strong> {bankingSettings.iban}
              </div>
            )}
            {bankingSettings.swiftCode && (
              <div>
                <strong>SWIFT:</strong> {bankingSettings.swiftCode}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Banking at Bottom - Non-PDF variant */}
      {bankingSettings && (bankingSettings.bankName || bankingSettings.iban) && bankingPosition === 'bottom' && variant !== 'pdf' && (
        <div
          style={{
            marginTop: '4rem',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '4px',
          }}
        >
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: accentColor,
            }}
          >
            Bank Details
          </h3>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {bankingSettings.bankName && (
              <div>
                <strong>Bank:</strong> {bankingSettings.bankName}
              </div>
            )}
            {bankingSettings.accountName && (
              <div>
                <strong>Account Name:</strong> {bankingSettings.accountName}
              </div>
            )}
            {bankingSettings.iban && (
              <div>
                <strong>IBAN:</strong> {bankingSettings.iban}
              </div>
            )}
            {bankingSettings.swiftCode && (
              <div>
                <strong>SWIFT:</strong> {bankingSettings.swiftCode}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      {variant === 'pdf' ? (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: '9pt',
            color: '#6b7280',
            borderTop: '1px solid #e5e7eb',
            paddingTop: '10pt',
            paddingBottom: '10pt',
          }}
        >
          <p style={{ margin: 0 }}>Thank you for your business!</p>
          <p style={{ margin: '4pt 0 0 0', fontSize: '8pt' }}>
            Payment due within 30 days. All amounts in EUR.
          </p>
        </div>
      ) : (
        <div
          style={{
            marginTop: '3rem',
            paddingTop: '1rem',
            borderTop: '1px solid #e5e7eb',
            textAlign: 'center',
            fontSize: '12px',
            color: '#6b7280',
          }}
        >
          <p style={{ margin: 0 }}>Thank you for your business!</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px' }}>
            Payment due within 30 days. All amounts in EUR.
          </p>
        </div>
      )}
    </div>
  );
};
