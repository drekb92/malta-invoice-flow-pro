import { useMemo } from 'react';

/* ===================== TYPES ===================== */

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit?: string;
}

export interface InvoiceTotals {
  netTotal: number;
  vatTotal: number;
  grandTotal: number;
}

export interface InvoiceDiscount {
  type: 'amount' | 'percent';
  value: number;
  amount: number;
}

export interface VatGroup {
  rate: number;
  displayRate: string;
  netAmount: number;
  vatAmount: number;
}

export interface VatSummary {
  groups: VatGroup[];
  totalNet: number;
  totalVat: number;
}

export interface InvoicePreviewData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customer: {
    name: string;
    email?: string;
    address?: string;
    address_line1?: string;
    address_line2?: string;
    locality?: string;
    post_code?: string;
    vat_number?: string;
  };
  items: InvoiceItem[];
  totals: InvoiceTotals;
  discount?: InvoiceDiscount;
}

/* ===================== SAMPLE DATA ===================== */

export const SAMPLE_INVOICE_DATA: InvoicePreviewData = {
  invoiceNumber: "INV-2024-001",
  invoiceDate: "2024-01-15",
  dueDate: "2024-02-14",
  customer: {
    name: "Sample Customer Ltd.",
    email: "billing@samplecustomer.com",
    address_line1: "456 Customer Avenue",
    address_line2: "Suite 100",
    locality: "Sliema",
    post_code: "SLM 1234",
    vat_number: "MT98765432",
  },
  items: [
    { 
      description: "Professional Consulting Services", 
      quantity: 10, 
      unit_price: 75, 
      vat_rate: 0.18, 
      unit: "hours" 
    },
    { 
      description: "Website Development & Maintenance", 
      quantity: 1, 
      unit_price: 1500, 
      vat_rate: 0.18, 
      unit: "project" 
    },
    { 
      description: "Annual Software License", 
      quantity: 2, 
      unit_price: 250, 
      vat_rate: 0.18, 
      unit: "license" 
    },
  ],
  totals: {
    netTotal: 2750.0,
    vatTotal: 495.0,
    grandTotal: 3245.0,
  },
};

/* ===================== CALCULATION UTILITIES ===================== */

/**
 * Calculate line item total (quantity × unit price)
 */
export const calculateLineTotal = (quantity: number, unitPrice: number): number => {
  return Number(quantity || 0) * Number(unitPrice || 0);
};

/**
 * Calculate VAT amount for a line item
 */
export const calculateLineVat = (
  quantity: number, 
  unitPrice: number, 
  vatRate: number,
  discountRatio: number = 0
): number => {
  const netAmount = calculateLineTotal(quantity, unitPrice);
  const discountedNet = netAmount * (1 - discountRatio);
  // Normalize VAT rate (handle both 0.18 and 18 formats)
  const normalizedRate = vatRate > 1 ? vatRate / 100 : vatRate;
  return discountedNet * normalizedRate;
};

/**
 * Group items by VAT rate and calculate totals for VAT summary
 */
export const calculateVatSummary = (
  items: InvoiceItem[],
  discount?: InvoiceDiscount,
  totals?: InvoiceTotals
): VatSummary => {
  // Calculate total net before discount for ratio calculation
  const grossTotal = items.reduce(
    (sum, item) => sum + calculateLineTotal(item.quantity, item.unit_price),
    0
  );
  
  // Calculate discount ratio
  const discountRatio = discount?.amount && grossTotal > 0
    ? discount.amount / grossTotal
    : 0;

  // Group items by VAT rate
  const vatGroups = items.reduce((acc, item) => {
    const rate = Number(item.vat_rate) || 0;
    const netAmount = calculateLineTotal(item.quantity, item.unit_price);
    
    if (!acc[rate]) {
      acc[rate] = { netAmount: 0, vatAmount: 0 };
    }
    
    acc[rate].netAmount += netAmount;
    acc[rate].vatAmount += calculateLineVat(
      item.quantity, 
      item.unit_price, 
      rate, 
      discountRatio
    );
    
    return acc;
  }, {} as Record<number, { netAmount: number; vatAmount: number }>);

  // Sort rates and build result
  const sortedRates = Object.keys(vatGroups)
    .map(Number)
    .sort((a, b) => a - b);

  const groups: VatGroup[] = sortedRates.map((rate) => {
    const displayRate = rate > 1 ? rate : rate * 100;
    return {
      rate,
      displayRate: `${displayRate}%`,
      netAmount: vatGroups[rate].netAmount,
      vatAmount: vatGroups[rate].vatAmount,
    };
  });

  const totalNet = groups.reduce((sum, g) => sum + g.netAmount, 0);
  const totalVat = groups.reduce((sum, g) => sum + g.vatAmount, 0);

  return { groups, totalNet, totalVat };
};

/**
 * Calculate invoice totals from items
 */
export const calculateInvoiceTotals = (
  items: InvoiceItem[],
  discount?: InvoiceDiscount
): InvoiceTotals => {
  const grossTotal = items.reduce(
    (sum, item) => sum + calculateLineTotal(item.quantity, item.unit_price),
    0
  );

  const discountAmount = discount?.amount || 0;
  const netTotal = grossTotal - discountAmount;

  const vatSummary = calculateVatSummary(items, discount);
  const vatTotal = vatSummary.totalVat;

  return {
    netTotal,
    vatTotal,
    grandTotal: netTotal + vatTotal,
  };
};

/* ===================== FORMATTING UTILITIES ===================== */

/**
 * Format currency value (EUR)
 */
export const formatMoney = (val: number): string => {
  return `€${Number(val || 0).toLocaleString("en-US", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

/**
 * Format percentage
 */
export const formatPercent = (val: number): string => {
  const displayVal = val > 1 ? val : val * 100;
  return `${Number(displayVal || 0)}%`;
};

/**
 * Format date to locale string
 */
export const formatDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB");
};

/* ===================== HOOK ===================== */

interface UseInvoicePreviewOptions {
  invoiceData?: InvoicePreviewData;
  useSampleData?: boolean;
}

interface UseInvoicePreviewReturn {
  data: InvoicePreviewData;
  vatSummary: VatSummary;
  formattedTotals: {
    netTotal: string;
    vatTotal: string;
    grandTotal: string;
    discountAmount?: string;
  };
  isUsingDefaults: boolean;
}

/**
 * Hook for managing invoice preview data and calculations
 * Provides memoized calculations for VAT summary and totals
 */
export const useInvoicePreview = (
  options: UseInvoicePreviewOptions = {}
): UseInvoicePreviewReturn => {
  const { invoiceData, useSampleData = false } = options;

  // Use sample data if requested or no data provided
  const data = useMemo(() => {
    if (useSampleData || !invoiceData) {
      return SAMPLE_INVOICE_DATA;
    }
    return invoiceData;
  }, [invoiceData, useSampleData]);

  // Calculate VAT summary
  const vatSummary = useMemo(() => {
    return calculateVatSummary(data.items, data.discount, data.totals);
  }, [data.items, data.discount, data.totals]);

  // Format totals
  const formattedTotals = useMemo(() => {
    return {
      netTotal: formatMoney(data.totals.netTotal),
      vatTotal: formatMoney(data.totals.vatTotal),
      grandTotal: formatMoney(data.totals.grandTotal),
      discountAmount: data.discount?.amount 
        ? formatMoney(data.discount.amount) 
        : undefined,
    };
  }, [data.totals, data.discount]);

  return {
    data,
    vatSummary,
    formattedTotals,
    isUsingDefaults: useSampleData || !invoiceData,
  };
};

export default useInvoicePreview;
