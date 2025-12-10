// src/services/creditNotesService.ts
import { supabase } from "@/integrations/supabase/client";

// We’ll use the same RPC that your dialog uses
type RpcFunction = "next_credit_note_number";

const callRpc = async (
  functionName: RpcFunction,
  params: { p_business_id: string; p_prefix?: string },
): Promise<{ data: string | null; error: any }> => {
  return (await supabase.rpc(functionName, params)) as any;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  customer_id: string;
  amount: number | null;
  vat_amount: number | null;
  total_amount: number | null;
  vat_rate: number | null;
};

type InvoiceItemRow = {
  id: string;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  vat_rate: number | null;
};

export const creditNotesService = {
  /**
   * Creates a FULL credit note for a given invoice.
   * Used by the "Issue Credit Note" action on the invoice list.
   */
  async createCreditNoteFromInvoice(invoiceId: string, userId: string) {
    // 1) Fetch invoice + items, scoped to the current user
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        customer_id,
        amount,
        vat_amount,
        total_amount,
        vat_rate,
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
      .eq("user_id", userId)
      .maybeSingle();

    if (invoiceError) {
      console.error("[creditNotesService] Error loading invoice:", invoiceError);
      throw new Error("Failed to load invoice for credit note.");
    }
    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    const typedInvoice = invoice as InvoiceRow & {
      invoice_items: InvoiceItemRow[];
    };

    const items = typedInvoice.invoice_items || [];

    if (items.length === 0) {
      throw new Error("Invoice has no line items to credit.");
    }

    // 2) Calculate net amount from items (safer than trusting header)
    const netAmount = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);

    const vatRate = typedInvoice.vat_rate ?? items[0]?.vat_rate ?? 0.18; // fallback to first item / 18%

    // 3) Generate a **unique** credit note number via RPC
    const { data: creditNoteNumber, error: rpcError } = await callRpc("next_credit_note_number", {
      p_business_id: userId,
      p_prefix: "CN-",
    });

    if (rpcError) {
      console.error("[creditNotesService] RPC error:", rpcError);
      throw new Error("Failed to generate credit note number.");
    }
    if (!creditNoteNumber) {
      throw new Error("Could not generate credit note number.");
    }

    // 4) Insert credit note header (IMPORTANT: includes user_id)
    //    Wrap in a small retry loop in case of unique-constraint races.
    let creditNoteId: string | null = null;
    let lastHeaderError: any = null;

    for (let attempt = 0; attempt < 2 && !creditNoteId; attempt++) {
      const numberToUse = attempt === 0 ? creditNoteNumber : `${creditNoteNumber}-R${attempt}`;

      const { data: headerData, error: headerError } = await supabase
        .from("credit_notes")
        .insert({
          credit_note_number: numberToUse,
          original_invoice_id: typedInvoice.id,
          user_id: userId, // <- fixes RLS for items
          customer_id: typedInvoice.customer_id,
          amount: netAmount,
          vat_rate: vatRate,
          reason: `Full credit for invoice ${typedInvoice.invoice_number}`,
          status: "issued",
        })
        .select("id")
        .maybeSingle();

      if (!headerError && headerData?.id) {
        creditNoteId = headerData.id;
        break;
      }

      lastHeaderError = headerError;

      // If it’s not a unique-constraint error, break immediately
      if (!(headerError as any)?.code || (headerError as any).code !== "23505") {
        break;
      }
    }

    if (!creditNoteId) {
      console.error("[creditNotesService] Error inserting credit note header:", lastHeaderError);
      throw new Error("Failed to create credit note (number already used). Please try again.");
    }

    // 5) Insert credit note items – RLS relies on the parent credit_note.user_id
    const itemsPayload = items.map((i) => ({
      credit_note_id: creditNoteId,
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      vat_rate: i.vat_rate ?? vatRate,
      unit: i.unit || "unit",
    }));

    const { error: itemsError } = await supabase.from("credit_note_items").insert(itemsPayload);

    if (itemsError) {
      console.error("[creditNotesService] Error inserting credit note items:", itemsError);
      throw new Error("Failed to create credit note items (check row-level security).");
    }

    return {
      success: true,
      creditNoteId,
    };
  },
};
