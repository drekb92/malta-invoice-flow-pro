export interface DocumentItem {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit: string;
}

export function validateDocumentItems(items: DocumentItem[]): string | null {
  if (!items.length) {
    return "Please add at least one line item";
  }

  const invalid = items.some(
    (item) =>
      !item.description ||
      item.quantity <= 0 ||
      item.unit_price < 0
  );

  if (invalid) {
    return "Please fill in all item details";
  }

  return null;
}

export interface QuotationTotals {
  net: number;
  vat: number;
  total: number;
}

export function calculateQuotationTotals(items: DocumentItem[]): QuotationTotals {
  const net = items.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
    0
  );

  const vat = items.reduce(
    (sum, item) =>
      sum + (item.quantity || 0) * (item.unit_price || 0) * (item.vat_rate || 0),
    0
  );

  const total = net + vat;

  const round2 = (n: number) =>
    Math.round((n + Number.EPSILON) * 100) / 100;

  return {
    net: round2(net),
    vat: round2(vat),
    total: round2(total),
  };
}
