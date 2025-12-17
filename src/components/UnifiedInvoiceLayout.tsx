import { formatDate, money, percent, mul } from '@/lib/invoiceUtils';
import { PDF_PRINT_STYLES } from '@/lib/pdfPrintStyles';

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
  headerLayout?: 'default' | 'centered' | 'split';
  tableStyle?: 'default' | 'striped' | 'bordered' | 'minimal';
  totalsStyle?: 'default' | 'boxed' | 'highlighted';
  bankingVisibility?: boolean;
  bankingStyle?: 'default' | 'boxed' | 'minimal';
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

export type DocumentType = 'INVOICE' | 'CREDIT NOTE' | 'QUOTATION';

export interface UnifiedInvoiceLayoutProps {
  invoiceData: InvoiceData;
  companySettings?: CompanySettings;
  bankingSettings?: BankingSettings;
  templateSettings?: TemplateSettings;
  variant?: 'preview' | 'pdf' | 'print';
  id?: string;
  debug?: boolean; // Add debug mode to show data source
  templateId?: string; // Template ID for debugging
  documentType?: DocumentType; // Document type for dynamic title/labels
}

export const UnifiedInvoiceLayout = ({
  invoiceData,
  companySettings,
  bankingSettings,
  templateSettings,
  variant = 'preview',
  id = 'unified-invoice',
  debug = false,
  templateId,
  documentType = 'INVOICE',
}: UnifiedInvoiceLayoutProps) => {
  // Document type labels
  const getDocumentTitle = () => documentType;
  const getNumberLabel = () => {
    switch (documentType) {
      case 'CREDIT NOTE': return 'Credit Note #:';
      case 'QUOTATION': return 'Quotation #:';
      default: return 'Invoice #:';
    }
  };
  // Default template settings
  const primaryColor = templateSettings?.primaryColor || '#26A65B';
  const accentColor = templateSettings?.accentColor || '#1F2D3D';
  const fontFamily = templateSettings?.fontFamily || 'Inter';
  const fontSize = templateSettings?.fontSize || '14px';
  const layout = templateSettings?.layout || 'default';
  const companyPosition = templateSettings?.companyPosition || 'left';
  const bankingPosition = templateSettings?.bankingPosition || 'after-totals';
  const bankingVisibility = templateSettings?.bankingVisibility !== false;
  const bankingStyle = templateSettings?.bankingStyle || 'default';
  const tableStyle = templateSettings?.tableStyle || 'default';
  const totalsStyle = templateSettings?.totalsStyle || 'default';
  
  // Margins for PDF variant
  const marginTop = templateSettings?.marginTop || 20;
  const marginRight = templateSettings?.marginRight || 20;
  const marginBottom = templateSettings?.marginBottom || 20;
  const marginLeft = templateSettings?.marginLeft || 20;

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

  // Validation helpers for debug mode
  const validateCompanySettings = () => {
    if (!companySettings) return { valid: false, missing: ['All company settings'] };
    const missing: string[] = [];
    if (!companySettings.name) missing.push('name');
    if (!companySettings.email) missing.push('email');
    if (!companySettings.address) missing.push('address');
    if (!companySettings.logo) missing.push('logo');
    return { valid: missing.length === 0, missing };
  };

  const validateBankingSettings = () => {
    if (!bankingSettings) return { valid: false, missing: ['All banking settings'] };
    const missing: string[] = [];
    if (!bankingSettings.bankName) missing.push('bankName');
    if (!bankingSettings.accountName) missing.push('accountName');
    if (!bankingSettings.iban && !bankingSettings.accountNumber) missing.push('iban/accountNumber');
    return { valid: missing.length === 0, missing };
  };

  const validateInvoiceData = () => {
    const missing: string[] = [];
    if (!invoiceData.invoiceNumber) missing.push('invoiceNumber');
    if (!invoiceData.customer?.name) missing.push('customer.name');
    if (!invoiceData.items || invoiceData.items.length === 0) missing.push('items');
    return { valid: missing.length === 0, missing };
  };

  // Debug panel component
  const renderDebugPanel = () => {
    if (!debug) return null;

    const companyValidation = validateCompanySettings();
    const bankingValidation = validateBankingSettings();
    const invoiceValidation = validateInvoiceData();

    return (
      <div style={{
        position: variant === 'pdf' ? 'relative' : 'absolute',
        top: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        border: '2px solid #f59e0b',
        borderRadius: '4px',
        padding: '12px 16px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 1000,
        marginBottom: variant === 'pdf' ? '1rem' : '0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#92400e' }}>
          🔍 DEBUG MODE - Invoice Template Rendering
        </div>
        
        {/* Template Info */}
        <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #fbbf24' }}>
          <strong style={{ color: '#92400e' }}>Template:</strong>
          <div style={{ marginLeft: '8px', color: '#78350f' }}>
            {templateId ? `ID: ${templateId}` : 'ID: Not provided'}
          </div>
          <div style={{ marginLeft: '8px', color: '#78350f' }}>
            Layout: <strong>{layout}</strong> | Variant: <strong>{variant}</strong>
          </div>
        </div>

        {/* Design Settings */}
        <div style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #fbbf24' }}>
          <strong style={{ color: '#92400e' }}>Design Settings:</strong>
          <div style={{ marginLeft: '8px', color: '#78350f' }}>
            Colors: <span style={{ background: primaryColor, padding: '2px 6px', borderRadius: '3px', color: 'white' }}>{primaryColor}</span>
            {' / '}
            <span style={{ background: accentColor, padding: '2px 6px', borderRadius: '3px', color: 'white' }}>{accentColor}</span>
          </div>
          <div style={{ marginLeft: '8px', color: '#78350f' }}>
            Font: <strong>{fontFamily}</strong> ({fontSize}) | Table: {tableStyle} | Totals: {totalsStyle}
          </div>
          <div style={{ marginLeft: '8px', color: '#78350f' }}>
            Margins: {marginTop}mm / {marginRight}mm / {marginBottom}mm / {marginLeft}mm
          </div>
          <div style={{ marginLeft: '8px', color: '#78350f' }}>
            Company Position: {companyPosition} | Banking: {bankingPosition} ({bankingVisibility ? 'visible' : 'hidden'})
          </div>
        </div>

        {/* Data Validation */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {/* Company Settings */}
          <div style={{ 
            padding: '6px', 
            background: companyValidation.valid ? '#d1fae5' : '#fee2e2',
            borderRadius: '4px',
            border: `1px solid ${companyValidation.valid ? '#10b981' : '#ef4444'}`
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: companyValidation.valid ? '#065f46' : '#991b1b' }}>
              {companyValidation.valid ? '✓' : '⚠'} Company
            </div>
            {companyValidation.valid ? (
              <div style={{ color: '#065f46' }}>
                {companySettings?.name || 'N/A'}
              </div>
            ) : (
              <div style={{ color: '#991b1b', fontSize: '10px' }}>
                Missing: {companyValidation.missing.join(', ')}
              </div>
            )}
          </div>

          {/* Banking Settings */}
          <div style={{ 
            padding: '6px', 
            background: bankingValidation.valid ? '#d1fae5' : '#fee2e2',
            borderRadius: '4px',
            border: `1px solid ${bankingValidation.valid ? '#10b981' : '#ef4444'}`
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: bankingValidation.valid ? '#065f46' : '#991b1b' }}>
              {bankingValidation.valid ? '✓' : '⚠'} Banking
            </div>
            {bankingValidation.valid ? (
              <div style={{ color: '#065f46' }}>
                {bankingSettings?.bankName || 'N/A'}
              </div>
            ) : (
              <div style={{ color: '#991b1b', fontSize: '10px' }}>
                Missing: {bankingValidation.missing.join(', ')}
              </div>
            )}
          </div>

          {/* Invoice Data */}
          <div style={{ 
            padding: '6px', 
            background: invoiceValidation.valid ? '#d1fae5' : '#fee2e2',
            borderRadius: '4px',
            border: `1px solid ${invoiceValidation.valid ? '#10b981' : '#ef4444'}`
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: invoiceValidation.valid ? '#065f46' : '#991b1b' }}>
              {invoiceValidation.valid ? '✓' : '⚠'} Invoice
            </div>
            {invoiceValidation.valid ? (
              <div style={{ color: '#065f46' }}>
                {invoiceData.invoiceNumber}
              </div>
            ) : (
              <div style={{ color: '#991b1b', fontSize: '10px' }}>
                Missing: {invoiceValidation.missing.join(', ')}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '8px', fontSize: '10px', color: '#92400e', fontStyle: 'italic' }}>
          This debug panel helps validate that preview and PDF use identical data sources.
        </div>
      </div>
    );
  };

  // CSS variables for consistent styling
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

  // Clean minimal layout
  if (layout === 'cleanMinimal') {
    return (
      <div
        id={id}
        className={containerClassName}
        style={containerStyle}
      >
        {/* PDF Print Styles */}
        {variant === 'pdf' && <style dangerouslySetInnerHTML={{ __html: PDF_PRINT_STYLES }} />}

        {/* Enhanced Debug Panel */}
        {renderDebugPanel()}

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

          {/* Document Title and Meta */}
          <div className="text-right">
            <h1
              className="text-4xl font-light tracking-wider mb-6"
              style={{ color: primaryColor }}
            >
              {getDocumentTitle()}
            </h1>
            <div className="space-y-1 text-sm" style={{ color: '#6b7280' }}>
              <div>
                <span className="font-medium">{getNumberLabel()}</span> {invoiceData.invoiceNumber}
              </div>
              <div>
                <span className="font-medium">Date:</span> {formatDate(invoiceData.invoiceDate)}
              </div>
              <div>
                <span className="font-medium">{documentType === 'QUOTATION' ? 'Valid Until:' : 'Due:'}</span> {formatDate(invoiceData.dueDate)}
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
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '46%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
            </colgroup>
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
                    whiteSpace: 'nowrap',
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
                    whiteSpace: 'nowrap',
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
                    whiteSpace: 'nowrap',
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
                    whiteSpace: 'nowrap',
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
                  <tr key={index} style={{ 
                    borderBottom: '1px solid #f3f4f6',
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                  }}>
                    <td style={{ 
                      padding: '16px 0', 
                      color: '#111827',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                    }}>
                      {item.description}
                    </td>
                    <td style={{ 
                      padding: '16px 0', 
                      textAlign: 'right', 
                      color: '#6b7280',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.quantity} {item.unit || ''}
                    </td>
                    <td style={{ 
                      padding: '16px 0', 
                      textAlign: 'right', 
                      color: '#6b7280',
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {money(item.unit_price)}
                    </td>
                    <td style={{ 
                      padding: '16px 0', 
                      textAlign: 'right', 
                      color: '#6b7280',
                      whiteSpace: 'nowrap',
                    }}>
                      {percent(item.vat_rate)}
                    </td>
                    <td
                      style={{
                        padding: '16px 0',
                        textAlign: 'right',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
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

        {/* Bottom Section: Bank Details and Totals - Keep together */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            marginTop: '4rem',
            breakInside: 'avoid',
            pageBreakInside: 'avoid',
          }}
        >
          {/* Bank Details */}
          {bankingVisibility && bankingSettings && (bankingSettings.bankName || bankingSettings.iban) && (
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
                <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
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
                  <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>—{money(invoiceData.discount.amount)}</span>
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
                <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(invoiceData.totals.vatTotal)}</span>
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
                <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(invoiceData.totals.grandTotal)}</span>
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
      {/* PDF Print Styles */}
      {variant === 'pdf' && <style dangerouslySetInnerHTML={{ __html: PDF_PRINT_STYLES }} />}

      {/* Enhanced Debug Panel */}
      {renderDebugPanel()}

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
        {/* Left side: Company Logo + Company Info (if position is 'left') */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Company Logo"
                crossOrigin="anonymous"
                style={{
                  maxHeight: '64px',
                  width: 'auto',
                  objectFit: 'contain',
                  marginBottom: companyPosition === 'left' && companySettings ? '1rem' : '0',
                }}
              />
            )}
            {/* Company Info below logo on left side */}
            {companyPosition === 'left' && companySettings && (
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {companySettings.name && (
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    {companySettings.name}
                  </div>
                )}
                {companySettings.address && (
                  <div style={{ whiteSpace: 'pre-line', marginBottom: '4px' }}>
                    {companySettings.address}
                  </div>
                )}
                {companySettings.city && (
                  <div style={{ marginBottom: '4px' }}>
                    {companySettings.city}
                    {companySettings.state && `, ${companySettings.state}`}{' '}
                    {companySettings.zipCode}
                  </div>
                )}
                {companySettings.phone && (
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Tel:</strong> {companySettings.phone}
                  </div>
                )}
                {companySettings.email && (
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Email:</strong> {companySettings.email}
                  </div>
                )}
                {companySettings.taxId && (
                  <div>
                    <strong>VAT:</strong> {companySettings.taxId}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Right side: Document Details + Company Info (if position is 'right' or 'top-right') */}
        <div style={{ textAlign: 'right' }}>
          {/* Document Meta Information */}
          <div style={{ marginBottom: '1rem' }}>
            <h1
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                marginBottom: '0.5rem',
                color: primaryColor,
              }}
            >
              {getDocumentTitle()}
            </h1>
            <div style={{ fontSize: '13px', color: '#374151' }}>
              <div style={{ marginBottom: '4px' }}>
                <strong>{getNumberLabel()}</strong> {invoiceData.invoiceNumber}
              </div>
              <div style={{ marginBottom: '4px' }}>
                <strong>Date:</strong> {formatDate(invoiceData.invoiceDate)}
              </div>
              <div>
                <strong>{documentType === 'QUOTATION' ? 'Valid Until:' : 'Due Date:'}</strong> {formatDate(invoiceData.dueDate)}
              </div>
            </div>
          </div>
          
          {/* Company Details - Below invoice meta with border separator */}
          {companySettings && (companyPosition === 'right' || companyPosition === 'top-right') && (
            <div
              style={{
                fontSize: '12px',
                paddingTop: '1rem',
                borderTop: '1px solid #e5e7eb',
              }}
            >
              {companySettings.name && (
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  {companySettings.name}
                </div>
              )}
              {companySettings.address && (
                <div style={{ whiteSpace: 'pre-line', marginBottom: '4px', color: '#6b7280' }}>
                  {companySettings.address}
                </div>
              )}
              {companySettings.city && (
                <div style={{ marginBottom: '4px', color: '#6b7280' }}>
                  {companySettings.city}
                  {companySettings.state && `, ${companySettings.state}`}{' '}
                  {companySettings.zipCode}
                </div>
              )}
              {companySettings.phone && (
                <div style={{ marginBottom: '4px', color: '#6b7280' }}>
                  <strong>Tel:</strong> {companySettings.phone}
                </div>
              )}
              {companySettings.email && (
                <div style={{ marginBottom: '4px', color: '#6b7280' }}>
                  <strong>Email:</strong> {companySettings.email}
                </div>
              )}
              {companySettings.taxId && (
                <div style={{ color: '#6b7280' }}>
                  <strong>VAT:</strong> {companySettings.taxId}
                </div>
              )}
            </div>
          )}
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
            tableLayout: 'fixed', // Fixed table layout for consistent columns
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
            <tr style={{ 
              backgroundColor: tableStyle === 'minimal' ? 'transparent' : primaryColor,
              borderBottom: tableStyle === 'minimal' ? `2px solid ${primaryColor}` : 'none',
            }}>
              <th
                style={{
                  color: tableStyle === 'minimal' ? accentColor : '#fff',
                  padding: '12pt 10pt',
                  textAlign: 'left',
                  fontWeight: 600,
                  border: tableStyle === 'bordered' ? '1px solid #e5e7eb' : tableStyle === 'minimal' ? 'none' : '1px solid #e5e7eb',
                }}
              >
                Description
              </th>
              <th
                style={{
                  color: tableStyle === 'minimal' ? accentColor : '#fff',
                  padding: '12pt 10pt',
                  textAlign: 'right',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: tableStyle === 'bordered' ? '1px solid #e5e7eb' : tableStyle === 'minimal' ? 'none' : '1px solid #e5e7eb',
                }}
              >
                Qty
              </th>
              <th
                style={{
                  color: tableStyle === 'minimal' ? accentColor : '#fff',
                  padding: '12pt 10pt',
                  textAlign: 'right',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: tableStyle === 'bordered' ? '1px solid #e5e7eb' : tableStyle === 'minimal' ? 'none' : '1px solid #e5e7eb',
                }}
              >
                Unit Price
              </th>
              <th
                style={{
                  color: tableStyle === 'minimal' ? accentColor : '#fff',
                  padding: '12pt 10pt',
                  textAlign: 'right',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: tableStyle === 'bordered' ? '1px solid #e5e7eb' : tableStyle === 'minimal' ? 'none' : '1px solid #e5e7eb',
                }}
              >
                VAT %
              </th>
              <th
                style={{
                  color: tableStyle === 'minimal' ? accentColor : '#fff',
                  padding: '12pt 10pt',
                  textAlign: 'right',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  border: tableStyle === 'bordered' ? '1px solid #e5e7eb' : tableStyle === 'minimal' ? 'none' : '1px solid #e5e7eb',
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
                  backgroundColor: tableStyle === 'striped' && index % 2 === 0 ? '#f9fafb' : 'white',
                  breakInside: 'avoid',
                  pageBreakInside: 'avoid',
                }}
              >
                <td style={{ 
                  padding: '12px 16px', 
                  border: tableStyle === 'bordered' ? '1px solid #e5e7eb' : tableStyle === 'minimal' ? 'none' : '1px solid #e5e7eb',
                  borderBottom: tableStyle === 'minimal' ? '1px solid #e5e7eb' : undefined,
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}>
                  {item.description}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    border: tableStyle === 'bordered' ? '1px solid #e5e7eb' : tableStyle === 'minimal' ? 'none' : '1px solid #e5e7eb',
                    borderBottom: tableStyle === 'minimal' ? '1px solid #e5e7eb' : undefined,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.quantity} {item.unit || ''}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    border: tableStyle === 'bordered' ? '1px solid #e5e7eb' : tableStyle === 'minimal' ? 'none' : '1px solid #e5e7eb',
                    borderBottom: tableStyle === 'minimal' ? '1px solid #e5e7eb' : undefined,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {money(item.unit_price)}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    border: tableStyle === 'bordered' ? '1px solid #e5e7eb' : tableStyle === 'minimal' ? 'none' : '1px solid #e5e7eb',
                    borderBottom: tableStyle === 'minimal' ? '1px solid #e5e7eb' : undefined,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {percent(item.vat_rate)}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    border: tableStyle === 'bordered' ? '1px solid #e5e7eb' : tableStyle === 'minimal' ? 'none' : '1px solid #e5e7eb',
                    borderBottom: tableStyle === 'minimal' ? '1px solid #e5e7eb' : undefined,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}
                >
                  {money(mul(item.quantity, item.unit_price))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals and Banking - Keep together */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        marginBottom: '2rem',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
      }}>
        <div 
          style={{ 
            width: '300px',
            padding: totalsStyle === 'boxed' ? '1rem' : '0',
            backgroundColor: totalsStyle === 'boxed' ? '#f9fafb' : 'transparent',
            border: totalsStyle === 'boxed' ? '1px solid #e5e7eb' : 'none',
            borderRadius: totalsStyle === 'boxed' ? '8px' : '0',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px 0',
            }}
          >
            <span>Subtotal:</span>
            <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
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
              <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>—{money(invoiceData.discount.amount)}</span>
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
            <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(invoiceData.totals.vatTotal)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              fontWeight: 'bold',
              fontSize: '18px',
              borderTop: `2px solid ${primaryColor}`,
              color: totalsStyle === 'highlighted' ? primaryColor : '#374151',
              backgroundColor: totalsStyle === 'highlighted' ? `${primaryColor}10` : 'transparent',
              marginTop: totalsStyle === 'highlighted' ? '0.5rem' : '0',
              paddingLeft: totalsStyle === 'highlighted' ? '1rem' : '0',
              paddingRight: totalsStyle === 'highlighted' ? '1rem' : '0',
              borderRadius: totalsStyle === 'highlighted' ? '4px' : '0',
            }}
          >
            <span>Total:</span>
            <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(invoiceData.totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Banking Details - Bottom Section (after totals) */}
      {bankingVisibility && bankingSettings && bankingPosition === 'after-totals' && (
        <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              marginBottom: '0.75rem',
              color: accentColor,
            }}
          >
            Banking Details
          </h3>
          <div
            style={{
              border: bankingStyle === 'boxed' ? '1px solid #e5e7eb' : 'none',
              borderRadius: bankingStyle === 'boxed' ? '8px' : '0',
              padding: bankingStyle === 'boxed' ? '1rem' : '0',
              backgroundColor: bankingStyle === 'boxed' ? '#f9fafb' : 'transparent',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: variant === 'pdf' ? '1fr 1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
                fontSize: bankingStyle === 'minimal' ? '12px' : '13px',
              }}
            >
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
        </div>
      )}

      {/* Banking at Bottom - Fixed position (PDF variant) */}
      {bankingVisibility && bankingSettings && bankingPosition === 'bottom' && variant === 'pdf' && (
        <div
          style={{
            position: 'absolute',
            bottom: '50pt',
            left: '1.5cm',
            right: '1.5cm',
            padding: bankingStyle === 'boxed' ? '1rem' : '0.5rem',
            backgroundColor: bankingStyle === 'boxed' ? '#f9fafb' : 'transparent',
            borderRadius: bankingStyle === 'boxed' ? '8px' : '0',
            border: bankingStyle === 'boxed' ? '1px solid #e5e7eb' : 'none',
            fontSize: '10pt',
          }}
        >
          <h3
            style={{
              fontSize: bankingStyle === 'minimal' ? '10pt' : '11pt',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: accentColor,
            }}
          >
            Banking Details
          </h3>
          <div style={{ fontSize: '9pt', color: '#374151', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
      {bankingVisibility && bankingSettings && bankingPosition === 'bottom' && variant !== 'pdf' && (
        <div style={{ marginTop: '4rem' }}>
          <h3
            style={{
              fontSize: bankingStyle === 'minimal' ? '13px' : '15px',
              fontWeight: 600,
              marginBottom: '0.75rem',
              color: accentColor,
            }}
          >
            Banking Details
          </h3>
          <div
            style={{
              border: bankingStyle === 'boxed' ? '1px solid #e5e7eb' : 'none',
              borderRadius: bankingStyle === 'boxed' ? '8px' : '0',
              padding: bankingStyle === 'boxed' ? '1rem' : '0',
              backgroundColor: bankingStyle === 'boxed' ? '#f9fafb' : 'transparent',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
                fontSize: bankingStyle === 'minimal' ? '12px' : '13px',
              }}
            >
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
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: '2rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          fontSize: '10px',
          color: '#6b7280',
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
        }}
      >
        <p style={{ margin: 0 }}>Thank you for your business!</p>
        <p style={{ margin: '4px 0 0 0', fontSize: '9px', color: '#9ca3af' }}>
          Payment due within 30 days. All amounts in EUR.
        </p>
      </div>
    </div>
  );
};
