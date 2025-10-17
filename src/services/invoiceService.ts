import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Invoice service for Malta VAT compliance - handles invoice immutability
export const invoiceService = {
  /**
   * Issue an invoice - marks it as immutable per Malta VAT regulations
   * Once issued, the invoice cannot be edited, only corrected via credit notes
   */
  async issueInvoice(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get invoice details first
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*, customers(name, email)')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;
      if (!invoice) throw new Error('Invoice not found');

      // Check if already issued
      if ((invoice as any).is_issued) {
        toast({
          title: "Already Issued",
          description: "This invoice has already been issued.",
          variant: "destructive",
        });
        return { success: false, error: 'Invoice already issued' };
      }

      // Generate hash for integrity
      const invoiceHash = await this.generateInvoiceHash(invoiceId);

      // Update invoice to issued status
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          is_issued: true,
          issued_at: new Date().toISOString(),
          invoice_hash: invoiceHash,
          status: 'sent'
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // Log the action for audit trail (Malta VAT compliance)
      const { error: auditError } = await supabase
        .from('invoice_audit_log' as any)
        .insert({
          invoice_id: invoiceId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'issued',
          new_data: {
            invoice_number: invoice.invoice_number,
            amount: invoice.amount,
            issued_at: new Date().toISOString(),
            hash: invoiceHash
          }
        });

      if (auditError) {
        console.error('Audit log error:', auditError);
        // Don't fail the operation if audit logging fails
      }

      toast({
        title: "Invoice Issued",
        description: `Invoice ${invoice.invoice_number} is now immutable and compliant with Malta VAT regulations.`,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error issuing invoice:', error);
      toast({
        title: "Error Issuing Invoice",
        description: error.message || "Failed to issue invoice",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if invoice can be edited
   * Returns false if invoice is issued (Malta VAT compliance)
   */
  async canEditInvoice(invoiceId: string): Promise<{ canEdit: boolean; reason?: string }> {
    try {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (error) throw error;
      if (!invoice) throw new Error('Invoice not found');

      const invoiceData = invoice as any;
      if (invoiceData.is_issued) {
        return {
          canEdit: false,
          reason: `Invoice ${invoiceData.invoice_number} was issued on ${new Date(invoiceData.issued_at).toLocaleDateString()} and cannot be edited. Create a credit note to make corrections.`
        };
      }

      return { canEdit: true };
    } catch (error: any) {
      console.error('Error checking invoice edit status:', error);
      return { canEdit: false, reason: error.message };
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
    }>
  ): Promise<{ success: boolean; creditNoteId?: string; error?: string }> {
    try {
      // Verify original invoice exists and is issued
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, customers(id, name)')
        .eq('id', originalInvoiceId)
        .single();

      if (invoiceError) throw invoiceError;
      if (!invoice) throw new Error('Original invoice not found');

      const invoiceData = invoice as any;
      if (!invoiceData.is_issued) {
        throw new Error('Can only create credit notes for issued invoices. Edit the draft invoice directly instead.');
      }

      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error('User not authenticated');

      // Generate credit note number - use simple counter for now
      const { data: existingNotes } = await supabase
        .from('credit_notes' as any)
        .select('credit_note_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      const year = new Date().getFullYear();
      const lastNumber = existingNotes && existingNotes.length > 0 
        ? parseInt((existingNotes as any)[0].credit_note_number.split('-').pop() || '0')
        : 0;
      const creditNoteNumber = `CN-${year}-${String(lastNumber + 1).padStart(4, '0')}`;

      // Create credit note
      const { data: creditNote, error: creditNoteError } = await supabase
        .from('credit_notes' as any)
        .insert({
          credit_note_number: creditNoteNumber,
          original_invoice_id: originalInvoiceId,
          user_id: userId,
          customer_id: invoice.customer_id,
          amount: amount,
          vat_rate: invoice.vat_rate,
          reason: reason,
          status: 'issued',
          credit_note_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (creditNoteError) throw creditNoteError;

      const creditNoteData = creditNote as any;

      // Create credit note items
      const creditNoteItems = items.map(item => ({
        credit_note_id: creditNoteData.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate,
        unit: item.unit || 'unit'
      }));

      const { error: itemsError } = await supabase
        .from('credit_note_items' as any)
        .insert(creditNoteItems);

      if (itemsError) throw itemsError;

      // Log audit trail
      const { error: auditError } = await supabase
        .from('invoice_audit_log' as any)
        .insert({
          invoice_id: originalInvoiceId,
          user_id: userId,
          action: 'credit_note_created',
          new_data: {
            credit_note_id: creditNoteData.id,
            credit_note_number: creditNoteData.credit_note_number,
            amount: amount,
            reason: reason
          }
        });

      if (auditError) {
        console.error('Audit log error:', auditError);
      }

      toast({
        title: "Credit Note Created",
        description: `Credit note ${creditNoteData.credit_note_number} created for invoice ${invoice.invoice_number}`,
      });

      return { success: true, creditNoteId: creditNoteData.id };
    } catch (error: any) {
      console.error('Error creating credit note:', error);
      toast({
        title: "Error Creating Credit Note",
        description: error.message || "Failed to create credit note",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    }
  },

  /**
   * Get complete audit trail for an invoice (Malta VAT compliance requirement)
   */
  async getInvoiceAuditTrail(invoiceId: string): Promise<{
    success: boolean;
    auditTrail?: Array<any>;
    error?: string;
  }> {
    try {
      const { data: auditTrail, error } = await supabase
        .from('invoice_audit_log' as any)
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return { success: true, auditTrail: auditTrail || [] };
    } catch (error: any) {
      console.error('Error fetching audit trail:', error);
      toast({
        title: "Error Loading Audit Trail",
        description: error.message || "Failed to load audit trail",
        variant: "destructive",
      });
      return { success: false, error: error.message };
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
        .from('invoices')
        .select('*, invoice_items(*)')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;
      if (!invoice) throw new Error('Invoice not found');

      // Create hash input from critical fields
      const hashInput = JSON.stringify({
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        customer_id: invoice.customer_id,
        amount: invoice.amount,
        vat_rate: invoice.vat_rate,
        total_amount: invoice.total_amount,
        items: invoice.invoice_items.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate
        })),
        timestamp: new Date().toISOString()
      });

      // Generate SHA-256 hash
      const encoder = new TextEncoder();
      const data = encoder.encode(hashInput);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      return hashHex;
    } catch (error: any) {
      console.error('Error generating invoice hash:', error);
      throw new Error(`Failed to generate invoice hash: ${error.message}`);
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
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (error) throw error;
      const invoiceData = invoice as any;
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
        calculatedHash
      };
    } catch (error: any) {
      console.error('Error verifying invoice integrity:', error);
      return { isValid: false };
    }
  }
};
