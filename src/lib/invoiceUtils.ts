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
  const normalized = normRate(rate);
  return `${Math.round(normalized * 100)}%`; 
}

// Math helpers
export function mul(a: number | string, b: number | string): number { 
  return Number(a || 0) * Number(b || 0); 
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Normalize VAT rate to decimal format (0.18, not 18)
 * Safely handles both 0.18 and 18 inputs
 */
export function normRate(rate: number | string): number {
  const r = Number(rate) || 0;
  return r > 1 ? r / 100 : r;
}

// Label: "VAT (18%)" if single rate else "VAT"
export function vatLabel(items: Array<{ vat_rate: number }>): string {
  const rates = Array.from(new Set((items || []).map(i => String(normRate(i.vat_rate)))));
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
  taxable: number;       // subtotal - discountAmount (exact to cents)
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
  return round2(Math.min(discountAmount, subtotal));
}

/**
 * Calculate all invoice totals with discount applied BEFORE VAT
 * 
 * Order: Subtotal → Discount → Taxable → VAT → Total
 * 
 * For mixed VAT rates, discount is allocated proportionally across line items
 * with rounding correction applied to the largest bucket to ensure exact cents.
 */
export function calculateInvoiceTotals(
  items: InvoiceLineItem[],
  discount: DiscountInput = { type: 'none', value: 0 }
): InvoiceTotals {
  // Step 1: Calculate subtotal and group by VAT rate (normalized)
  const perRate = new Map<number, number>();
  let subtotal = 0;
  
  (items || []).forEach((item) => {
    const lineNet = mul(item.quantity || 0, item.unit_price || 0);
    subtotal += lineNet;
    const rate = normRate(item.vat_rate);
    perRate.set(rate, (perRate.get(rate) || 0) + lineNet);
  });
  
  subtotal = round2(subtotal);
  
  // Step 2: Calculate discount amount
  const discountAmount = calculateDiscountAmount(subtotal, discount);
  
  // Step 3: Allocate discount proportionally across VAT rates with rounding correction
  const rateEntries = Array.from(perRate.entries());
  
  // Calculate unrounded shares and round each
  const rateDiscounts: { rate: number; rateNet: number; rateDiscount: number }[] = [];
  let sumRoundedDiscounts = 0;
  
  rateEntries.forEach(([rate, rateNet]) => {
    const share = subtotal > 0 ? (rateNet / subtotal) : 0;
    const rateDiscount = round2(discountAmount * share);
    sumRoundedDiscounts += rateDiscount;
    rateDiscounts.push({ rate, rateNet, rateDiscount });
  });
  
  // Apply rounding correction to largest bucket (or first if tie)
  const roundingDiff = round2(discountAmount - sumRoundedDiscounts);
  if (roundingDiff !== 0 && rateDiscounts.length > 0) {
    // Find the largest rateNet bucket
    let largestIdx = 0;
    let largestNet = rateDiscounts[0].rateNet;
    for (let i = 1; i < rateDiscounts.length; i++) {
      if (rateDiscounts[i].rateNet > largestNet) {
        largestNet = rateDiscounts[i].rateNet;
        largestIdx = i;
      }
    }
    rateDiscounts[largestIdx].rateDiscount = round2(rateDiscounts[largestIdx].rateDiscount + roundingDiff);
  }
  
  // Step 4: Calculate taxable and VAT per rate
  let vatAmount = 0;
  
  rateDiscounts.forEach(({ rate, rateNet, rateDiscount }) => {
    const rateTaxable = round2(Math.max(rateNet - rateDiscount, 0));
    // VAT for this rate (on taxable amount, after discount)
    vatAmount += round2(rateTaxable * rate);
  });
  
  vatAmount = round2(vatAmount);
  
  // Step 5: Taxable = subtotal - discountAmount (exact to cents)
  const taxable = round2(subtotal - discountAmount);
  
  // Step 6: Calculate total
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
 * @deprecated Use calculateInvoiceTotals instead for invoices with discounts.
 * This function ignores discounts and should only be used for simple net calculations.
 */
export function sumNet(items: Array<{ quantity: number; unit_price: number }>): number {
  return round2((items || []).reduce((s, i) => s + mul(i.quantity, i.unit_price), 0));
}

/**
 * @deprecated WARNING: Does not account for discounts! Use calculateInvoiceTotals instead.
 * This calculates VAT on full line amounts without any discount deduction.
 */
export function sumVAT_NoDiscount(items: Array<{ quantity: number; unit_price: number; vat_rate: number }>): number {
  return round2((items || []).reduce((s, i) => s + mul(i.quantity, i.unit_price) * normRate(i.vat_rate), 0));
}

/**
 * @deprecated WARNING: Does not account for discounts! Use calculateInvoiceTotals instead.
 * This calculates total on full line amounts without any discount deduction.
 */
export function total_NoDiscount(items: Array<{ quantity: number; unit_price: number; vat_rate: number }>): number { 
  return round2(sumNet(items) + sumVAT_NoDiscount(items)); 
}

// Legacy aliases for backwards compatibility (deprecated)
/** @deprecated Use sumVAT_NoDiscount or calculateInvoiceTotals */
export const sumVAT = sumVAT_NoDiscount;
/** @deprecated Use total_NoDiscount or calculateInvoiceTotals */
export const total = total_NoDiscount;
