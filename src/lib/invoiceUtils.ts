// Dates: always dd/mm/yyyy
export function formatDate(iso: string | Date): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  } catch { 
    return String(iso); 
  }
}

// Currency (EUR) – deterministic
const nf = new Intl.NumberFormat('mt-MT', { 
  style: 'currency', 
  currency: 'EUR', 
  minimumFractionDigits: 2 
});

export function money(n: number | string): string { 
  return nf.format(Number(n || 0)); 
}

// Percent like 18%
export function percent(rate: number): string { 
  return `${Math.round(Number(rate || 0) * 100)}%`; 
}

// Math helpers
export function mul(a: number | string, b: number | string): number { 
  return Number(a || 0) * Number(b || 0); 
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Label: "VAT (18%)" if single rate else "VAT"
export function vatLabel(items: Array<{ vat_rate: number }>): string {
  const rates = Array.from(new Set((items || []).map(i => String(Number(i.vat_rate || 0)))));
  return rates.length === 1 ? `VAT (${percent(Number(rates[0]))})` : 'VAT';
}

// === Invoice Item Type ===
export interface InvoiceLineItem {
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

// === Discount Calculation ===
export type DiscountType = 'none' | 'amount' | 'percent';

export interface DiscountInput {
  type: DiscountType;
  value: number;
}

export interface InvoiceTotals {
  subtotal: number;      // Sum of qty * unit_price (Net Amount)
  discountAmount: number; // Calculated discount (clamped to subtotal)
  taxable: number;       // subtotal - discountAmount
  vatAmount: number;     // VAT on taxable (after discount)
  total: number;         // taxable + vatAmount
}

/**
 * Calculate discount amount based on type and value
 * Discount is applied BEFORE VAT (pre-VAT discount)
 */
export function calculateDiscountAmount(
  subtotal: number,
  discount: DiscountInput
): number {
  if (discount.type === 'none' || !discount.value) {
    return 0;
  }
  
  let discountAmount = 0;
  
  if (discount.type === 'percent') {
    // Clamp percentage between 0-100
    const pct = Math.min(Math.max(Number(discount.value) || 0, 0), 100);
    discountAmount = round2(subtotal * (pct / 100));
  } else if (discount.type === 'amount') {
    // Clamp amount between 0 and subtotal
    discountAmount = round2(Math.min(Math.max(Number(discount.value) || 0, 0), subtotal));
  }
  
  // Final clamp: cannot exceed subtotal
  return Math.min(discountAmount, subtotal);
}

/**
 * Calculate all invoice totals with discount applied BEFORE VAT
 * 
 * Order: Subtotal → Discount → Taxable → VAT → Total
 * 
 * For mixed VAT rates, discount is allocated proportionally across line items
 */
export function calculateInvoiceTotals(
  items: InvoiceLineItem[],
  discount: DiscountInput = { type: 'none', value: 0 }
): InvoiceTotals {
  // Step 1: Calculate subtotal and group by VAT rate
  const perRate = new Map<number, number>();
  let subtotal = 0;
  
  (items || []).forEach((item) => {
    const lineNet = mul(item.quantity || 0, item.unit_price || 0);
    subtotal += lineNet;
    const rate = Number(item.vat_rate) || 0;
    perRate.set(rate, (perRate.get(rate) || 0) + lineNet);
  });
  
  subtotal = round2(subtotal);
  
  // Step 2: Calculate discount amount
  const discountAmount = calculateDiscountAmount(subtotal, discount);
  
  // Step 3: Calculate taxable amount and VAT
  // Allocate discount proportionally across VAT rates
  let taxable = 0;
  let vatAmount = 0;
  
  perRate.forEach((rateNet, rate) => {
    // Calculate this rate's share of the discount
    const share = subtotal > 0 ? (rateNet / subtotal) : 0;
    const rateDiscount = round2(discountAmount * share);
    
    // Taxable for this rate
    const rateTaxable = Math.max(rateNet - rateDiscount, 0);
    taxable += rateTaxable;
    
    // VAT for this rate (on taxable amount, after discount)
    vatAmount += round2(rateTaxable * rate);
  });
  
  taxable = round2(taxable);
  vatAmount = round2(vatAmount);
  
  // Step 4: Calculate total
  const total = round2(taxable + vatAmount);
  
  return {
    subtotal,
    discountAmount,
    taxable,
    vatAmount,
    total
  };
}

/**
 * Legacy functions for backwards compatibility
 */
export function sumNet(items: Array<{ quantity: number; unit_price: number }>): number {
  return (items || []).reduce((s, i) => s + mul(i.quantity, i.unit_price), 0);
}

export function sumVAT(items: Array<{ quantity: number; unit_price: number; vat_rate: number }>): number {
  return (items || []).reduce((s, i) => s + mul(i.quantity, i.unit_price) * Number(i.vat_rate || 0), 0);
}

export function total(items: Array<{ quantity: number; unit_price: number; vat_rate: number }>): number { 
  return sumNet(items) + sumVAT(items); 
}
