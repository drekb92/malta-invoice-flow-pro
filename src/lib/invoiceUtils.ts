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

export function sumNet(items: Array<{ quantity: number; unit_price: number }>): number {
  return (items || []).reduce((s, i) => s + mul(i.quantity, i.unit_price), 0);
}

export function sumVAT(items: Array<{ quantity: number; unit_price: number; vat_rate: number }>): number {
  return (items || []).reduce((s, i) => s + mul(i.quantity, i.unit_price) * Number(i.vat_rate || 0), 0);
}

export function total(items: Array<{ quantity: number; unit_price: number; vat_rate: number }>): number { 
  return sumNet(items) + sumVAT(items); 
}

// Label: "VAT (18%)" if single rate else "VAT"
export function vatLabel(items: Array<{ vat_rate: number }>): string {
  const rates = Array.from(new Set((items || []).map(i => String(Number(i.vat_rate || 0)))));
  return rates.length === 1 ? `VAT (${percent(Number(rates[0]))})` : 'VAT';
}
