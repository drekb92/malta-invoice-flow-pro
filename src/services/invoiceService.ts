import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type {
  InvoiceWithCompliance,
  InvoiceItem,
  CreditNote,
  CreditNoteInsert,
  CreditNoteItemInsert,
  InvoiceAuditLog,
} from "@/types/invoice-compliance";
import { isSupabaseError } from "@/types/invoice-compliance";

// Invoice service for Malta VAT compliance - handles invoice immutability
export const invoiceService = {
  /**
   * Issue an invoice - marks it as immutable per Malta VAT regulations
   * Once issued, the invoice cannot be edited, only corrected via credit notes
   */
  async issueInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 1) Load the invoice
      const { data: invoice, error: fetchError } = await supabase
        .from("invoices")
        .select("*, customers(name, email)")
        .eq("id", invoiceId)
        .single();

      if (fetchError) throw fetchError;
      if (!invoice) throw new Error("Invoice not found");

      const invoiceData = invoice as InvoiceWithCompliance;

      // 2) If already issued, show a neutral info message (NOT a red error)
      if (invoiceData.is_issued) {
        toast({
          title: "Invoice already issued",
          description: "This invoice has already been issued and is immutable. To correct it, create a credit note.",
        });
        return { success: false, error: "Invoice already issued" };
      }

      // 3) Get current user for RPC + audit log
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const userId = authData?.user?.id;
      if (!userId) {
        throw new Error("User not authenticated");
      }

      // 4) Determine the invoice number
      let finalInvoiceNumber = invoiceData.invoice_number as string | null;

      // If invoice has no number yet (typical for drafts issued from Invoice Details),
      // generate the next number via the same RPC used in NewInvoice.tsx
      if (!finalInvoiceNumber) {
        const { data: nextNumber, error: numberError } = await supabase.rpc("next_invoice_number", {
          p_business_id: userId,
          p_prefix: "INV-",
        });

        if (numberError) throw numberError;
        if (!nextNumber) {
          throw new Error("Failed to generate invoice number");
        }

        finalInvoiceNumber = nextNumber as string;
      }

      // 5) Generate hash for integrity
      const invoiceHash = await this.generateInvoiceHash(invoiceId);

      // 6) Update invoice to issued status, including the final invoice number
      const { error: updateError } = await supabase
        .from("invoices")
        .update({
          is_issued: true,
          issued_at: new Date().toISOString(),
          invoice_hash: invoiceHash,
          status: "sent",
          invoice_number: finalInvoiceNumber,
        })
        .eq("id", invoiceId);

      if (updateError) throw updateError;

      // 7) Log the action for audit trail (Malta VAT compliance)
      const { error: auditError } = await supabase.from("invoice_audit_log").insert({
        invoice_id: invoiceId,
        user_id: userId,
        action: "issued",
        new_data: {
          invoice_number: finalInvoiceNumber,
          amount: invoiceData.amount,
          total_amount: invoiceData.total_amount,
          customer_id: invoiceData.customer_id,
          issued_at: new Date().toISOString(),
        },
      });

      if (auditError) {
        console.error("Audit log error:", auditError);
        // Do not fail the operation if audit logging fails
      }

      // 8) Success toast with the actual number
      toast({
        title: "Invoice Issued",
        description: `Invoice ${finalInvoiceNumber} is now immutable and compliant with Malta VAT regulations.`,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = isSupabaseError(error) ? error.message : "Failed to issue invoice";
      console.error("Error issuing invoice:", error);
      toast({
        title: "Error Issuing Invoice",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Check if invoice can be edited
   * Returns false if invoice is issued (Malta VAT compliance)
   */
  async canEditInvoice(invoiceId: string): Promise<{ canEdit: boolean; reason?: string }> {
    try {
      const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();

      if (error) throw error;
      if (!invoice) throw new Error("Invoice not found");

      const invoiceData = invoice as InvoiceWithCompliance;
      // Only draft invoices can be edited - check status instead of is_issued
      if (invoiceData.status !== 'draft') {
        return {
          canEdit: false,
          reason: `Invoice ${invoiceData.invoice_number || 'Draft'} has been issued and cannot be edited. To make corrections, please create a credit note.`,
        };
      }

      return { canEdit: true };
    } catch (error) {
      const errorMessage = isSupabaseError(error) ? error.message : "Failed to check invoice status";
      console.error("Error checking invoice edit status:", error);
      return { canEdit: false, reason: errorMessage };
    }
  },

  /**
   * Create a credit note for correcting an issued invoice (Malta VAT compliance)
   */
  async createCreditNote(
    originalInvoiceId: string,
    amount: number,
    reason: string,
    items: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      vat_rate: number;
      unit?: string;
    }>,
  ): Promise<{ success: boolean; creditNoteId?: string; error?: string }> {
    try {
      // Verify original invoice exists and is issued
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*, customers(id, name)")
        .eq("id", originalInvoiceId)
        .single();

      if (invoiceError) throw invoiceError;
      if (!invoice) throw new Error("Original invoice not found");

      const invoiceData = invoice as InvoiceWithCompliance;
      if (!invoiceData.is_issued) {
        throw new Error("Can only create credit notes for issued invoices. Edit the draft invoice directly instead.");
      }

      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error("User not authenticated");

      // Generate credit note number - use simple counter for now
      const { data: existingNotes } = await (supabase as any)
        .from("credit_notes")
        .select("credit_note_number")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      const year = new Date().getFullYear();
      const lastNumber =
        existingNotes && existingNotes.length > 0
          ? parseInt((existingNotes as CreditNote[])[0].credit_note_number.split("-").pop() || "0")
          : 0;
      const creditNoteNumber = `CN-${year}-${String(lastNumber + 1).padStart(4, "0")}`;

      // Create credit note
      const newCreditNote: CreditNoteInsert = {
        credit_note_number: creditNoteNumber,
        invoice_id: originalInvoiceId,
        user_id: userId,
        customer_id: invoiceData.customer_id,
        amount: amount,
        vat_rate: invoiceData.vat_rate,
        reason: reason,
        status: "issued",
        type: "invoice_adjustment",
        credit_note_date: new Date().toISOString().split("T")[0],
      };

      const { data: creditNote, error: creditNoteError } = await (supabase as any)
        .from("credit_notes")
        .insert(newCreditNote)
        .select()
        .single();

      if (creditNoteError) throw creditNoteError;
      if (!creditNote) throw new Error("Failed to create credit note");

      const creditNoteData = creditNote as CreditNote;

      // Create credit note items
      const creditNoteItems: CreditNoteItemInsert[] = items.map((item) => ({
        credit_note_id: creditNoteData.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate,
        unit: item.unit || "unit",
      }));

      const { error: itemsError } = await (supabase as any).from("credit_note_items").insert(creditNoteItems);

      if (itemsError) throw itemsError;

      // Log audit trail
      const { error: auditError } = await (supabase as any).from("invoice_audit_log").insert({
        invoice_id: originalInvoiceId,
        user_id: userId,
        action: "credit_note_created",
        new_data: {
          credit_note_id: creditNoteData.id,
          credit_note_number: creditNoteData.credit_note_number,
          amount: amount,
          reason: reason,
        },
      });

      if (auditError) {
        console.error("Audit log error:", auditError);
      }

      toast({
        title: "Credit Note Created",
        description: `Credit note ${creditNoteData.credit_note_number} created for invoice ${invoiceData.invoice_number}`,
      });

      return { success: true, creditNoteId: creditNoteData.id };
    } catch (error) {
      const errorMessage = isSupabaseError(error) ? error.message : "Failed to create credit note";
      console.error("Error creating credit note:", error);
      toast({
        title: "Error Creating Credit Note",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Get complete audit trail for an invoice (Malta VAT compliance requirement)
   */
  async getInvoiceAuditTrail(invoiceId: string): Promise<{
    success: boolean;
    auditTrail?: InvoiceAuditLog[];
    error?: string;
  }> {
    try {
      const { data: auditTrail, error } = await (supabase as any)
        .from("invoice_audit_log")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("timestamp", { ascending: false });

      if (error) throw error;

      return { success: true, auditTrail: (auditTrail || []) as InvoiceAuditLog[] };
    } catch (error) {
      const errorMessage = isSupabaseError(error) ? error.message : "Failed to load audit trail";
      console.error("Error fetching audit trail:", error);
      toast({
        title: "Error Loading Audit Trail",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Generate integrity hash for invoice (Malta VAT compliance)
   * Creates a hash of critical invoice data to detect tampering
   */
  async generateInvoiceHash(invoiceId: string): Promise<string> {
    try {
      // Fetch invoice and all items
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("id", invoiceId)
        .single();

      if (invoiceError) throw invoiceError;
      if (!invoice) throw new Error("Invoice not found");

      const invoiceData = invoice as InvoiceWithCompliance;

      // Create hash input from critical fields
      const hashInput = JSON.stringify({
        invoice_number: invoiceData.invoice_number,
        invoice_date: invoiceData.invoice_date,
        customer_id: invoiceData.customer_id,
        amount: invoiceData.amount,
        vat_rate: invoiceData.vat_rate,
        total_amount: invoiceData.total_amount,
        items: (invoiceData.invoice_items || []).map((item: InvoiceItem) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
        })),
        timestamp: new Date().toISOString(),
      });

      // Generate SHA-256 hash
      const encoder = new TextEncoder();
      const data = encoder.encode(hashInput);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      return hashHex;
    } catch (error) {
      const errorMessage = isSupabaseError(error) ? error.message : "Unknown error";
      console.error("Error generating invoice hash:", error);
      throw new Error(`Failed to generate invoice hash: ${errorMessage}`);
    }
  },

  /**
   * Verify invoice integrity using stored hash
   */
  async verifyInvoiceIntegrity(invoiceId: string): Promise<{
    isValid: boolean;
    storedHash?: string;
    calculatedHash?: string;
  }> {
    try {
      const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();

      if (error) throw error;
      const invoiceData = invoice as InvoiceWithCompliance;
      if (!invoiceData?.invoice_hash) {
        return { isValid: false };
      }

      const calculatedHash = await this.generateInvoiceHash(invoiceId);
      const isValid = calculatedHash === invoiceData.invoice_hash;

      if (!isValid) {
        console.warn(`Invoice ${invoiceId} integrity check failed`);
        toast({
          title: "Integrity Warning",
          description: "Invoice data may have been modified after issuance",
          variant: "destructive",
        });
      }

      return {
        isValid,
        storedHash: invoiceData.invoice_hash,
        calculatedHash,
      };
    } catch (error) {
      console.error("Error verifying invoice integrity:", error);
      return { isValid: false };
    }
  },
};
