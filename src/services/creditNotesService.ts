import { supabase } from "@/integrations/supabase/client";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit?: string;
}

interface InvoiceWithRelations {
  id: string;
  invoice_number: string;
  customer_id: string;
  user_id: string;
  amount: number;       // net
  vat_rate: number;
  invoice_date: string;
  due_date: string | null;
  discount_value?: number;
  discount_type?: string;
  discount_reason?: string;
  customers?: {
    name: string;
    email?: string;
    address?: string;
    vat_number?: string;
  };
  invoice_items: InvoiceItem[];
}

export const getInvoiceWithItems = async (
  invoiceId: string
): Promise<InvoiceWithRelations> => {
  const { data, error } = await (supabase as any)
    .from("invoices")
    .select(
      `
      *,
      customers (
        name,
        email,
        address,
        vat_number
      ),
      invoice_items (
        id,
        description,
        quantity,
        unit,
        unit_price,
        vat_rate
      )
    `
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "Invoice not found");
  }

  // Ensure invoice_items array exists
  if (!data.invoice_items) {
    data.invoice_items = [];
  }

  return data as InvoiceWithRelations;
};

export const createCreditNoteFromInvoice = async ({
  invoiceId,
  reason,
  date,
}: {
  invoiceId: string;
  reason?: string;
  date?: string;
}) => {
  const invoice = await getInvoiceWithItems(invoiceId);

  const netAmount = Number(invoice.amount || 0);
  const vatRate = Number(invoice.vat_rate ?? 0.18);
  const creditReason =
    reason || `Credit note for invoice ${invoice.invoice_number}`;

  // 1) Create header in credit_notes
  const { data: insertedCN, error: headerError } = await supabase
    .from("credit_notes")
    .insert({
      credit_note_number: `CN-${invoice.invoice_number}`, // simple pattern for now
      original_invoice_id: invoice.id,
      user_id: invoice.user_id,
      customer_id: invoice.customer_id,
      amount: netAmount, // NET
      vat_rate: vatRate,
      reason: creditReason,
      credit_note_date: date || new Date().toISOString().slice(0, 10),
      status: "issued",
    })
    .select()
    .single();

  if (headerError || !insertedCN) {
    throw new Error(headerError?.message || "Failed to create credit note");
  }

  // 2) Clone invoice_items into credit_note_items
  if ((invoice.invoice_items || []).length > 0) {
    const { error: itemsError } = await supabase
      .from("credit_note_items")
      .insert(
        invoice.invoice_items.map((item) => ({
          credit_note_id: insertedCN.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate ?? vatRate,
          unit: item.unit || "unit",
        }))
      );

    if (itemsError) {
      throw new Error(itemsError.message);
    }
  }

  return insertedCN;
};
