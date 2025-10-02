import { InvoiceTemplate } from "@/services/templateService";
import { formatDate, money, percent, mul } from "@/lib/invoiceUtils";


interface InvoiceHTMLProps {
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
  id?: string;
  variant?: 'default' | 'template';
}

export const InvoiceHTML = ({ invoiceData, template, id = "invoice-pdf-content", variant = 'default' }: InvoiceHTMLProps) => {
  const fontSizeValue = parseInt(template.font_size);
  
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
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center">
          {template.logo_url && (
            <img 
              src={template.logo_url} 
              alt="Company Logo" 
              style={{
                marginLeft: `${template.logo_x_offset}px`,
                marginTop: `${template.logo_y_offset}px`,
                maxHeight: '2cm',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
          )}
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
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ backgroundColor: `var(--th-bg, ${template.primary_color})` }}>
              <th style={{ color: 'var(--th-text, #ffffff)' }} className="px-4 py-3 text-left border">Description</th>
              <th style={{ color: 'var(--th-text, #ffffff)' }} className="px-4 py-3 text-center border w-20">Qty</th>
              <th style={{ color: 'var(--th-text, #ffffff)' }} className="px-4 py-3 text-right border w-24">Price</th>
              <th style={{ color: 'var(--th-text, #ffffff)' }} className="px-4 py-3 text-center border w-20">VAT %</th>
              <th style={{ color: 'var(--th-text, #ffffff)' }} className="px-4 py-3 text-right border w-24">Total</th>
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

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-2">
          <div className="flex justify-between py-1">
            <span>Subtotal:</span>
            <span>{money(invoiceData.totals.netTotal + (invoiceData.discount?.amount || 0))}</span>
          </div>
          {invoiceData.discount && invoiceData.discount.amount > 0 && (
            <div className="flex justify-between py-1">
              <span>Discount{invoiceData.discount.type === 'percent' ? ` (${percent(invoiceData.discount.value / 100)})` : ''}:</span>
              <span>—{money(invoiceData.discount.amount)}</span>
            </div>
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

      {/* Footer */}
      <div className="text-center text-sm text-gray-600 mt-12 pt-8 border-t">
        <p>Thank you for your business!</p>
        <p>Payment terms apply as agreed.</p>
      </div>
    </div>
  );
};