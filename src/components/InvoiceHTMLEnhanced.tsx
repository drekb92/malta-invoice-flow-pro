import { InvoiceTemplate } from "@/services/templateService";
import { formatDate, money, percent, mul } from "@/lib/invoiceUtils";
import { InvoiceCleanMinimal } from "@/components/templates/InvoiceCleanMinimal";
import { normalizeInvoiceData, validateTemplateInvoiceData } from "@/hooks/useInvoiceTemplate";

export interface BankDetails {
  bank_name?: string;
  bank_account_name?: string;
  bank_iban?: string;
  bank_swift_code?: string;
}

export interface InvoiceHTMLProps {
  invoiceData: {
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    customer: {
      name: string;
      email?: string;
      address?: string;
      vat_number?: string;
    };
    items: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      vat_rate: number;
      unit?: string;
    }>;
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
  };
  template: InvoiceTemplate;
  bankDetails?: BankDetails;
  id?: string;
  variant?: 'default' | 'template';
  layout?: 'default' | 'cleanMinimal';
  debug?: boolean;
}

/**
 * Enhanced InvoiceHTML component with consistent template application
 * Replaces the original InvoiceHTML component to fix template-invoice mismatches
 */
export const InvoiceHTMLEnhanced = ({ 
  invoiceData, 
  template,
  bankDetails,
  id = "invoice-pdf-content", 
  variant = 'default',
  layout = 'default',
  debug = false
}: InvoiceHTMLProps) => {
  // Normalize and validate data
  const normalizedData = normalizeInvoiceData(invoiceData);
  const validation = validateTemplateInvoiceData(template, normalizedData);
  
  if (debug) {
    console.log('InvoiceHTML Debug:', {
      template,
      normalizedData,
      validation,
      layout,
      variant
    });
  }
  
  if (!validation.isValid) {
    console.error('Invoice template validation failed:', validation.errors);
    return (
      <div id={id} className="p-8 bg-red-50 border border-red-200 rounded">
        <h2 className="text-red-800 font-bold mb-4">Template Validation Error</h2>
        <ul className="text-red-700 text-sm">
          {validation.errors.map((error, index) => (
            <li key={index}>• {error}</li>
          ))}
        </ul>
      </div>
    );
  }

  // If clean minimal layout is selected, render that component instead
  if (layout === 'cleanMinimal') {
    return (
      <InvoiceCleanMinimal 
        invoiceData={{
          invoice_number: normalizedData.invoiceNumber,
          invoice_date: normalizedData.invoiceDate,
          due_date: normalizedData.dueDate,
          customer_name: normalizedData.customer.name,
          customer_email: normalizedData.customer.email || '',
          customer_address: normalizedData.customer.address,
          customer_vat_number: normalizedData.customer.vat_number,
          items: normalizedData.items,
          subtotal: normalizedData.totals.netTotal,
          vat_amount: normalizedData.totals.vatTotal,
          total_amount: normalizedData.totals.grandTotal,
          discount_amount: normalizedData.discount?.amount,
        }}
        template={template}
        bankDetails={bankDetails}
        id={id}
        variant={variant}
      />
    );
  }

  // Calculate subtotal before discount for proper display
  const originalSubtotal = normalizedData.totals.netTotal + (normalizedData.discount?.amount || 0);
  const fontSizeValue = parseInt(template.font_size.replace('px', ''));
  
  // Logo is now managed via company_settings, not template
  
  // A4 canvas styling for template variant with inner padding
  const containerStyle = variant === 'template'
    ? {
        width: '21cm',
        minHeight: '29.7cm',
        backgroundColor: 'white',
        padding: '1.5cm',
        boxSizing: 'border-box' as const,
        fontFamily: template.font_family,
        fontSize: `${fontSizeValue}px`,
        color: template.accent_color,
        position: 'relative' as const,
      }
    : {
        fontFamily: template.font_family,
        fontSize: `${fontSizeValue}px`,
        color: template.accent_color,
      };
  
  const containerClassName = variant === 'template' 
    ? "bg-white"
    : "bg-white p-8 max-w-4xl mx-auto print:p-0 print:shadow-none shadow-lg";
  
  return (
    <div 
      id={id}
      className={containerClassName}
      style={containerStyle}
    >
      {debug && (
        <div className="bg-yellow-50 border border-yellow-200 p-2 mb-4 text-xs">
          <strong>Debug Info:</strong> Template: {template.name} | Layout: {layout} | Variant: {variant}
        </div>
      )}
      
      {/* Top spacer for breathing room */}
      <div style={{ height: '4mm' }}></div>

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center">
          {/* Logo display removed - now managed in company_settings */}
        </div>
        <div className="text-right">
          <h1 
            className="text-3xl font-bold mb-2"
            style={{ color: template.primary_color }}
          >
            INVOICE
          </h1>
          <div className="space-y-1 text-sm">
            <div><strong>Invoice #:</strong> {normalizedData.invoiceNumber}</div>
            <div><strong>Date:</strong> {formatDate(normalizedData.invoiceDate)}</div>
            <div><strong>Due Date:</strong> {formatDate(normalizedData.dueDate)}</div>
          </div>
        </div>
      </div>

      {/* Billing Information */}
      <div className="mb-8">
        <h2 
          className="text-lg font-semibold mb-3"
          style={{ color: template.accent_color }}
        >
          Bill To:
        </h2>
        <div className="space-y-1">
          <div className="font-medium">{normalizedData.customer.name}</div>
          {normalizedData.customer.email && <div>{normalizedData.customer.email}</div>}
          {normalizedData.customer.address && (
            <div className="whitespace-pre-line">{normalizedData.customer.address}</div>
          )}
          {normalizedData.customer.vat_number && (
            <div><strong>VAT Number:</strong> {normalizedData.customer.vat_number}</div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          tableLayout: 'fixed',
          marginTop: '1cm',
          fontSize: '10pt'
        }}>
          <colgroup>
            <col style={{ width: '46%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: template.primary_color }}>
              <th style={{ color: '#fff', padding: '12pt 10pt', textAlign: 'left', fontWeight: 600, border: '1px solid #e5e7eb' }}>Description</th>
              <th style={{ color: '#fff', padding: '12pt 10pt', textAlign: 'right', fontWeight: 600, border: '1px solid #e5e7eb' }}>Qty</th>
              <th style={{ color: '#fff', padding: '12pt 10pt', textAlign: 'right', fontWeight: 600, border: '1px solid #e5e7eb' }}>Unit Price</th>
              <th style={{ color: '#fff', padding: '12pt 10pt', textAlign: 'right', fontWeight: 600, border: '1px solid #e5e7eb' }}>VAT %</th>
              <th style={{ color: '#fff', padding: '12pt 10pt', textAlign: 'right', fontWeight: 600, border: '1px solid #e5e7eb' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {normalizedData.items.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                <td className="px-4 py-3 border">{item.description}</td>
                <td className="px-4 py-3 border text-center">{item.quantity} {item.unit || ''}</td>
                <td className="px-4 py-3 border text-right">{money(item.unit_price)}</td>
                <td className="px-4 py-3 border text-center">{percent(item.vat_rate)}</td>
                <td className="px-4 py-3 border text-right">
                  {money(mul(item.quantity, item.unit_price))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-2">
          <div className="flex justify-between py-1">
            <span>Subtotal:</span>
            <span>{money(originalSubtotal)}</span>
          </div>
          {normalizedData.discount && normalizedData.discount.amount > 0 && (
            <div className="flex justify-between py-1">
              <span>Discount{normalizedData.discount.type === 'percent' ? ` (${percent(normalizedData.discount.value / 100)})` : ''}:</span>
              <span>—{money(normalizedData.discount.amount)}</span>
            </div>
          )}
          <div className="flex justify-between py-1">
            <span>Taxable Amount:</span>
            <span>{money(normalizedData.totals.netTotal)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span>VAT Total:</span>
            <span>{money(normalizedData.totals.vatTotal)}</span>
          </div>
          <div 
            className="flex justify-between py-2 font-bold text-lg border-t-2"
            style={{ 
              borderColor: template.primary_color,
              color: template.primary_color 
            }}
          >
            <span>Total:</span>
            <span>{money(normalizedData.totals.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Bank Details (if available) */}
      {bankDetails && (bankDetails.bank_name || bankDetails.bank_iban) && (
        <div className="mb-8">
          <h3 
            className="text-md font-semibold mb-3"
            style={{ color: template.accent_color }}
          >
            Banking Details:
          </h3>
          <div className="space-y-1 text-sm">
            {bankDetails.bank_name && (
              <div><strong>Bank:</strong> {bankDetails.bank_name}</div>
            )}
            {bankDetails.bank_account_name && (
              <div><strong>Account Name:</strong> {bankDetails.bank_account_name}</div>
            )}
            {bankDetails.bank_iban && (
              <div><strong>IBAN:</strong> {bankDetails.bank_iban}</div>
            )}
            {bankDetails.bank_swift_code && (
              <div><strong>SWIFT/BIC:</strong> {bankDetails.bank_swift_code}</div>
            )}
          </div>
        </div>
      )}

      {/* Spacer before footer */}
      <div style={{ height: '20mm' }}></div>

      {/* Footer */}
      <div style={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0,
        textAlign: 'center',
        fontSize: '9pt',
        color: '#6b7280',
        borderTop: '1px solid #e5e7eb',
        paddingTop: '10pt',
        paddingBottom: '10pt'
      }}>
        <p style={{ margin: 0 }}>Thank you for your business!</p>
        <p style={{ margin: '4pt 0 0 0', fontSize: '8pt' }}>Payment due within 30 days. All amounts in EUR.</p>
      </div>
    </div>
  );
};