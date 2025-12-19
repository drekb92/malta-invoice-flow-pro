import { InvoiceTemplate } from "@/services/templateService";
import { formatDate, money, percent, mul } from "@/lib/invoiceUtils";
import { InvoiceCleanMinimal } from "@/components/templates/InvoiceCleanMinimal";


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

export const InvoiceHTML = ({ invoiceData, template, bankDetails, id = "invoice-pdf-content", variant = 'default', layout = 'default', debug = false }: InvoiceHTMLProps) => {
  if (debug) {
    console.log('[InvoiceHTML] Rendering with:', {
      template: { id: template.id, name: template.name },
      layout,
      variant,
      invoiceNumber: invoiceData.invoiceNumber,
      customer: invoiceData.customer.name,
      bankDetails: bankDetails ? 'provided' : 'none',
    });
  }
  
  // If clean minimal layout is selected, render that component instead
  if (layout === 'cleanMinimal') {
    return (
      <InvoiceCleanMinimal 
        invoiceData={{
          invoice_number: invoiceData.invoiceNumber,
          invoice_date: invoiceData.invoiceDate,
          due_date: invoiceData.dueDate,
          customer_name: invoiceData.customer.name,
          customer_email: invoiceData.customer.email,
          customer_address: invoiceData.customer.address,
          customer_vat_number: invoiceData.customer.vat_number,
          items: invoiceData.items,
          subtotal: invoiceData.totals.netTotal,
          vat_amount: invoiceData.totals.vatTotal,
          total_amount: invoiceData.totals.grandTotal,
          discount_amount: invoiceData.discount?.amount,
        }}
        template={template}
        bankDetails={bankDetails}
        id={id}
        variant={variant}
      />
    );
  }

  const fontSizeValue = parseInt(template.font_size);
  
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
            <div><strong>Invoice #:</strong> {invoiceData.invoiceNumber}</div>
            <div><strong>Date:</strong> {formatDate(invoiceData.invoiceDate)}</div>
            <div><strong>Due Date:</strong> {formatDate(invoiceData.dueDate)}</div>
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
          <div className="font-medium">{invoiceData.customer.name}</div>
          {invoiceData.customer.email && <div>{invoiceData.customer.email}</div>}
          {invoiceData.customer.address && (
            <div className="whitespace-pre-line">{invoiceData.customer.address}</div>
          )}
          {invoiceData.customer.vat_number && (
            <div><strong>VAT Number:</strong> {invoiceData.customer.vat_number}</div>
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
            {invoiceData.items.map((item, index) => (
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

      {/* Totals - Discount applied BEFORE VAT */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-2">
          <div className="flex justify-between py-1">
            <span>Subtotal:</span>
            <span>{money(invoiceData.totals.netTotal + (invoiceData.discount?.amount || 0))}</span>
          </div>
          {invoiceData.discount && invoiceData.discount.amount > 0 && (
            <>
              <div className="flex justify-between py-1">
                <span>Discount{invoiceData.discount.type === 'percent' ? ` (${percent(invoiceData.discount.value / 100)})` : ''}:</span>
                <span>−{money(invoiceData.discount.amount)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Taxable Amount:</span>
                <span>{money(invoiceData.totals.netTotal)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between py-1">
            <span>VAT Total:</span>
            <span>{money(invoiceData.totals.vatTotal)}</span>
          </div>
          <div 
            className="flex justify-between py-2 font-bold text-lg border-t-2"
            style={{ 
              borderColor: template.primary_color,
              color: template.primary_color 
            }}
          >
            <span>Total:</span>
            <span>{money(invoiceData.totals.grandTotal)}</span>
          </div>
        </div>
      </div>

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