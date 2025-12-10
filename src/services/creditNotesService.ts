// src/services/creditNotesService.ts
import { supabase } from "@/integrations/supabase/client";

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

/**
 * Generate the next credit note number for a specific user by looking at
 * existing credit_notes rows for that user that ALREADY have a number.
 *
 * Pattern used:  CN-000001, CN-000002, ...
 */
const generateNextCreditNoteNumber = async (userId: string): Promise<string> => {
  const { data, error } = await supabase
    .from("credit_notes")
    .select("credit_note_number")
    .eq("user_id", userId)
    // IMPORTANT: ignore rows where credit_note_number is NULL
    .not("credit_note_number", "is", null)
    // because we zero-pad, lexical order works to get the “largest” number
    .order("credit_note_number", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[creditNotesService] Error reading last credit note number:", error);
  }

  let next = 1;

  if (data && data.length > 0 && data[0].credit_note_number) {
    const last = data[0].credit_note_number as string;
    // extract the trailing digits, e.g. "CN-000012" -> "000012"
    const match = last.match(/(\d+)$/);
    if (match) {
      const current = parseInt(match[1], 10);
      if (!isNaN(current)) {
        next = current + 1;
      }
    }
  }

  const padded = String(next).padStart(6, "0");
  return `CN-${padded}`;
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

    // 3) Generate a UNIQUE credit note number per user
    const creditNoteNumber = await generateNextCreditNoteNumber(userId);
    console.log("[creditNotesService] Generated credit note number:", creditNoteNumber);

    // 4) Insert credit note header (includes user_id for RLS)
    const { data: headerData, error: headerError } = await supabase
      .from("credit_notes")
      .insert({
        credit_note_number: creditNoteNumber,
        original_invoice_id: typedInvoice.id,
        user_id: userId, // <- important for RLS
        customer_id: typedInvoice.customer_id,
        amount: netAmount,
        vat_rate: vatRate,
        reason: `Full credit for invoice ${typedInvoice.invoice_number}`,
        status: "issued",
      })
      .select("id")
      .maybeSingle();

    if (headerError || !headerData?.id) {
      console.error("[creditNotesService] Error inserting credit note header:", headerError);
      // If the unique constraint somehow still fires, surface a friendly message
      const msg = (headerError as any)?.message || "Failed to create credit note header.";
      if (msg.includes("unique_credit_note_number_per_user") || msg.includes("duplicate key value")) {
        throw new Error("A credit note with this number already exists for this user. Please try again.");
      }
      throw new Error(msg);
    }

    const creditNoteId = headerData.id;

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
      throw new Error("Failed to create credit note items (row-level security may be blocking this).");
    }

    return {
      success: true,
      creditNoteId,
    };
  },
};
