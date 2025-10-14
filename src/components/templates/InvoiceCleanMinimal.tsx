import { formatDate, money, percent, mul } from '@/lib/invoiceUtils';
import { InvoiceTemplate } from '@/services/templateService';
import { Separator } from '@/components/ui/separator';

interface BankDetails {
  bank_name?: string;
  bank_account_name?: string;
  bank_iban?: string;
  bank_swift_code?: string;
}

interface InvoiceHTMLProps {
  invoiceData: {
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    customer_name: string;
    customer_email: string;
    customer_address?: string;
    customer_vat_number?: string;
    items: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      vat_rate: number;
    }>;
    subtotal: number;
    vat_amount: number;
    total_amount: number;
    discount_amount?: number;
  };
  template: InvoiceTemplate;
  bankDetails?: BankDetails;
  id?: string;
  variant?: 'default' | 'template';
}

export function InvoiceCleanMinimal({ 
  invoiceData, 
  template,
  bankDetails,
  id = "invoice-pdf-content", 
  variant = 'default' 
}: InvoiceHTMLProps) {
  const getAbsoluteLogoUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `https://cmysusctooyobrlnwtgt.supabase.co/storage/v1/object/public/logos/${url}`;
  };

  const containerClass = variant === 'template' 
    ? 'w-[21cm] h-[29.7cm] p-[1.5cm] bg-white' 
    : 'w-full bg-white';

  return (
    <div 
      id={id}
      className={containerClass}
      style={{
        fontFamily: template.font_family,
        fontSize: template.font_size,
        color: '#111827',
      }}
    >
      {/* Header Section */}
      <div className="flex justify-between items-start mb-16">
        {/* Logo removed - now managed in company_settings */}
        
        {/* Invoice Title and Meta */}
        <div className="text-right">
          <h1 className="text-4xl font-light tracking-wider mb-6" style={{ color: template.primary_color }}>
            INVOICE
          </h1>
          <div className="space-y-1 text-sm text-gray-600">
            <div><span className="font-medium">Invoice #:</span> {invoiceData.invoice_number}</div>
            <div><span className="font-medium">Date:</span> {formatDate(invoiceData.invoice_date)}</div>
            <div><span className="font-medium">Due:</span> {formatDate(invoiceData.due_date)}</div>
          </div>
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Customer Info */}
      <div className="mb-12">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Bill To</div>
        <div className="text-base font-medium">{invoiceData.customer_name}</div>
        {invoiceData.customer_email && (
          <div className="text-sm text-gray-600">{invoiceData.customer_email}</div>
        )}
        {invoiceData.customer_address && (
          <div className="text-sm text-gray-600 whitespace-pre-line">{invoiceData.customer_address}</div>
        )}
        {invoiceData.customer_vat_number && (
          <div className="text-sm text-gray-600"><span className="font-medium">VAT:</span> {invoiceData.customer_vat_number}</div>
        )}
      </div>

      {/* Items Table */}
      <div className="mb-12">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="text-right py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Qty</th>
              <th className="text-right py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Unit Price</th>
              <th className="text-right py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-20">VAT</th>
              <th className="text-right py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoiceData.items.map((item, index) => {
              const lineTotal = mul(item.quantity, item.unit_price) * (1 + Number(item.vat_rate));
              return (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-4 text-gray-800">{item.description}</td>
                  <td className="py-4 text-right text-gray-600">{item.quantity}</td>
                  <td className="py-4 text-right text-gray-600">{money(item.unit_price)}</td>
                  <td className="py-4 text-right text-gray-600">{percent(item.vat_rate)}</td>
                  <td className="py-4 text-right font-medium">{money(lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Section: Bank Details and Totals */}
      <div className="flex justify-between items-start mt-16">
        {/* Bank Details */}
        {bankDetails && (bankDetails.bank_name || bankDetails.bank_iban) && (
          <div className="w-1/2">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Bank Details</div>
            <div className="space-y-1 text-sm text-gray-700">
              {bankDetails.bank_name && (
                <div><span className="text-gray-500">Bank:</span> {bankDetails.bank_name}</div>
              )}
              {bankDetails.bank_account_name && (
                <div><span className="text-gray-500">Account:</span> {bankDetails.bank_account_name}</div>
              )}
              {bankDetails.bank_iban && (
                <div><span className="text-gray-500">IBAN:</span> {bankDetails.bank_iban}</div>
              )}
              {bankDetails.bank_swift_code && (
                <div><span className="text-gray-500">SWIFT:</span> {bankDetails.bank_swift_code}</div>
              )}
            </div>
          </div>
        )}

        {/* Totals */}
        <div className="w-64">
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal:</span>
              <span>{money(invoiceData.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>VAT:</span>
              <span>{money(invoiceData.vat_amount)}</span>
            </div>
            {invoiceData.discount_amount && invoiceData.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Discount:</span>
                <span>-{money(invoiceData.discount_amount)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex justify-between text-lg font-semibold" style={{ color: template.primary_color }}>
              <span>Total:</span>
              <span>{money(invoiceData.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-200">
        <p className="text-sm text-gray-500 text-center">
          Thank you for your business
        </p>
      </div>
    </div>
  );
}
