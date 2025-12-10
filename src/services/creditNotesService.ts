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
  amount: number | null; // net
  vat_rate: number | null;
  vat_amount: number | null;
  total_amount: number | null;
  invoice_date: string;
  due_date: string | null;
  status: string;
  is_issued?: boolean;
  invoice_items: InvoiceItem[];
}

export const getInvoiceWithItems = async (invoiceId: string): Promise<InvoiceWithRelations> => {
  const { data, error } = await (supabase as any)
    .from("invoices")
    .select(
      `
      *,
      invoice_items (
        id,
        description,
        quantity,
        unit,
        unit_price,
        vat_rate
      )
    `,
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "Invoice not found");
  }

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

  // Only allow credit notes for issued invoices (optional safety)
  if (!(invoice as any).is_issued) {
    throw new Error("Invoice must be issued before creating a credit note.");
  }

  // Decide NET amount:
  // - Prefer invoices.amount (your net field)
  // - Otherwise derive from total_amount - vat_amount
  const totalAmount = Number(invoice.total_amount ?? 0);
  const vatAmount = Number(invoice.vat_amount ?? 0);
  const netFromTotals = totalAmount > 0 && vatAmount >= 0 ? totalAmount - vatAmount : 0;

  const netAmount = invoice.amount !== null && invoice.amount !== undefined ? Number(invoice.amount) : netFromTotals;

  const vatRate = Number(invoice.vat_rate ?? 0.18);
  const creditReason = reason || `Credit note for invoice ${invoice.invoice_number}`;

  // 1) Insert header into credit_notes (your schema)
  const { data: insertedCN, error: headerError } = await supabase
    .from("credit_notes")
    .insert({
      credit_note_number: `CN-${invoice.invoice_number}`, // simple pattern for now
      original_invoice_id: invoice.id,
      user_id: invoice.user_id,
      customer_id: invoice.customer_id,
      amount: netAmount,
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

  // 2) Clone items into credit_note_items (your schema)
  if ((invoice.invoice_items || []).length > 0) {
    const { error: itemsError } = await supabase.from("credit_note_items").insert(
      invoice.invoice_items.map((item) => ({
        credit_note_id: insertedCN.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate ?? vatRate,
        unit: item.unit || "unit",
      })),
    );

    if (itemsError) {
      throw new Error(itemsError.message);
    }
  }

  // 3) Mark invoice as credited
  const { error: updateError } = await supabase.from("invoices").update({ status: "credited" }).eq("id", invoice.id);

  if (updateError) {
    // Not critical for creating the CN, but good to log
    console.error("Failed to update invoice status to credited:", updateError);
  }

  return insertedCN;
};
