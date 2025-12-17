import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Shield, Loader2, Trash2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/utils";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit: string | null;
}

interface CreateCreditNoteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  onSuccess?: () => void;
}

interface ValidationErrors {
  reason?: string;
  total?: string;
  exceedsRemaining?: string;
}

const CREDIT_NOTE_REASONS = [
  { value: "pricing_error", label: "Pricing Error" },
  { value: "quantity_adjustment", label: "Quantity Adjustment" },
  { value: "damaged_goods", label: "Damaged Goods" },
  { value: "incorrect_specification", label: "Incorrect Specification" },
  { value: "customer_return", label: "Customer Return" },
  { value: "service_not_rendered", label: "Service Not Rendered" },
  { value: "overpayment_correction", label: "Overpayment Correction" },
  { value: "discount_applied", label: "Discount Applied" },
  { value: "other", label: "Other" },
];

export function CreateCreditNoteDrawer({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  customerId,
  onSuccess,
}: CreateCreditNoteDrawerProps) {
  const { toast } = useToast();
  
  // Form state
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [originalItems, setOriginalItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Invoice data for validation
  const [invoiceTotal, setInvoiceTotal] = useState<number>(0);
  const [existingCredits, setExistingCredits] = useState<number>(0);
  const [existingPayments, setExistingPayments] = useState<number>(0);
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [showValidation, setShowValidation] = useState(false);

  // Load invoice data when drawer opens
  useEffect(() => {
    if (open && invoiceId) {
      loadInvoiceData();
      // Reset validation when drawer opens
      setValidationErrors({});
      setShowValidation(false);
    }
  }, [open, invoiceId]);

  const loadInvoiceData = async () => {
    setLoading(true);
    try {
      // Fetch invoice items, invoice totals, existing credits, and payments in parallel
      const [itemsResult, invoiceResult, creditsResult, paymentsResult] = await Promise.all([
        supabase
          .from("invoice_items")
          .select("id, description, quantity, unit_price, vat_rate, unit")
          .eq("invoice_id", invoiceId)
          .order("created_at", { ascending: true }),
        supabase
          .from("invoices")
          .select("total_amount")
          .eq("id", invoiceId)
          .single(),
        supabase
          .from("credit_notes")
          .select("amount, vat_rate")
          .eq("invoice_id", invoiceId),
        supabase
          .from("payments")
          .select("amount")
          .eq("invoice_id", invoiceId),
      ]);

      if (itemsResult.error) throw itemsResult.error;

      const items = (itemsResult.data || []).map(item => ({
        ...item,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        vat_rate: Number(item.vat_rate),
      }));

      setOriginalItems(items);
      setLineItems(items);
      
      // Set invoice total
      if (invoiceResult.data) {
        setInvoiceTotal(Number(invoiceResult.data.total_amount) || 0);
      }
      
      // Calculate existing credits (gross amount)
      const totalCredits = (creditsResult.data || []).reduce((sum, cn) => {
        const gross = Number(cn.amount) * (1 + Number(cn.vat_rate || 0));
        return sum + gross;
      }, 0);
      setExistingCredits(totalCredits);
      
      // Calculate existing payments
      const totalPayments = (paymentsResult.data || []).reduce((sum, p) => sum + Number(p.amount), 0);
      setExistingPayments(totalPayments);
      
    } catch (error) {
      console.error("Error loading invoice data:", error);
      toast({
        title: "Error",
        description: "Failed to load invoice data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totals = useMemo(() => {
    const netTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const vatTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price * item.vat_rate, 0);
    const grandTotal = netTotal + vatTotal;
    return { netTotal, vatTotal, grandTotal };
  }, [lineItems]);

  // Calculate remaining invoice amount
  const remainingAmount = useMemo(() => {
    return Math.max(0, invoiceTotal - existingCredits - existingPayments);
  }, [invoiceTotal, existingCredits, existingPayments]);

  // Validate form
  const validateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {};
    
    // Reason validation
    if (!reason) {
      errors.reason = "Please select a reason for this credit note";
    }
    
    // Total validation
    if (totals.grandTotal <= 0) {
      errors.total = "Credit note total must be greater than zero";
    }
    
    // Check if exceeds remaining amount (only for invoice adjustments)
    if (invoiceId && totals.grandTotal > remainingAmount && remainingAmount > 0) {
      errors.exceedsRemaining = `Credit amount (€${formatNumber(totals.grandTotal, 2)}) exceeds the remaining invoice balance of €${formatNumber(remainingAmount, 2)}`;
    } else if (invoiceId && totals.grandTotal > invoiceTotal && remainingAmount === 0) {
      errors.exceedsRemaining = `Credit amount (€${formatNumber(totals.grandTotal, 2)}) exceeds the invoice total of €${formatNumber(invoiceTotal, 2)}`;
    }
    
    return errors;
  };

  const isValid = useMemo(() => {
    const errors = validateForm();
    return Object.keys(errors).length === 0;
  }, [reason, totals.grandTotal, remainingAmount, invoiceTotal, invoiceId]);

  // Update line item
  const updateLineItem = (index: number, field: keyof LineItem, value: number | string) => {
    setLineItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
    // Clear total error when items change
    if (showValidation && validationErrors.total) {
      setValidationErrors(prev => ({ ...prev, total: undefined, exceedsRemaining: undefined }));
    }
  };

  // Remove line item
  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  // Reset to original items
  const resetItems = () => {
    setLineItems(originalItems);
    setValidationErrors(prev => ({ ...prev, total: undefined, exceedsRemaining: undefined }));
  };

  // Handle reason change
  const handleReasonChange = (value: string) => {
    setReason(value);
    if (showValidation && validationErrors.reason) {
      setValidationErrors(prev => ({ ...prev, reason: undefined }));
    }
  };

  // Generate credit note number
  const generateCreditNoteNumber = async (userId: string): Promise<string> => {
    const { data } = await supabase
      .from("credit_notes")
      .select("credit_note_number, created_at")
      .eq("user_id", userId)
      .not("credit_note_number", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    let next = 1;
    if (data && data.length > 0 && data[0].credit_note_number) {
      const match = data[0].credit_note_number.match(/(\d+)$/);
      if (match) {
        const current = parseInt(match[1], 10);
        if (!isNaN(current)) next = current + 1;
      }
    }
    return `CN-${String(next).padStart(6, "0")}`;
  };

  // Submit handler
  const handleSubmit = async (action: "draft" | "issue") => {
    // For issue, perform validation
    if (action === "issue") {
      const errors = validateForm();
      setValidationErrors(errors);
      setShowValidation(true);
      
      if (Object.keys(errors).length > 0) {
        return;
      }
    } else {
      // For draft, only require basic validation
      if (totals.grandTotal <= 0 || lineItems.length === 0) {
        toast({
          title: "Cannot save draft",
          description: "Please add at least one line item with a value.",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("User not authenticated");

      const creditNoteNumber = await generateCreditNoteNumber(userId);
      const reasonText = reason 
        ? `${CREDIT_NOTE_REASONS.find(r => r.value === reason)?.label || reason}${description ? `: ${description}` : ""}`
        : description || "Credit note";

      // Create credit note with new schema fields
      const creditNoteData = {
        credit_note_number: creditNoteNumber,
        invoice_id: invoiceId,
        customer_id: customerId,
        user_id: userId,
        amount: totals.netTotal,
        vat_rate: lineItems[0]?.vat_rate || 0.18,
        reason: reasonText,
        type: "invoice_adjustment" as const,
        status: action === "draft" ? "draft" : "issued",
        issued_at: action === "issue" ? new Date().toISOString() : null,
        credit_note_date: new Date().toISOString().split("T")[0],
      };

      const { data: creditNote, error: creditNoteError } = await supabase
        .from("credit_notes")
        .insert(creditNoteData)
        .select("id")
        .single();

      if (creditNoteError) throw creditNoteError;

      // Create credit note items
      const itemsPayload = lineItems
        .filter(item => item.quantity > 0 && item.unit_price > 0)
        .map(item => ({
          credit_note_id: creditNote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
          unit: item.unit || "unit",
        }));

      const { error: itemsError } = await supabase
        .from("credit_note_items")
        .insert(itemsPayload);

      if (itemsError) throw itemsError;

      // Log audit trail if issued
      if (action === "issue") {
        await supabase.from("invoice_audit_log").insert({
          invoice_id: invoiceId,
          user_id: userId,
          action: "credit_note_created",
          new_data: {
            credit_note_id: creditNote.id,
            credit_note_number: creditNoteNumber,
            amount: totals.netTotal,
            reason: reasonText,
          },
        });
      }

      toast({
        title: action === "draft" ? "Draft Saved" : "Credit Note Issued",
        description: `Credit Note ${creditNoteNumber} has been ${action === "draft" ? "saved as draft" : "issued"}.`,
      });

      // Reset form and close
      setReason("");
      setDescription("");
      setLineItems([]);
      setValidationErrors({});
      setShowValidation(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating credit note:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create credit note",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Inline validation message component
  const ValidationMessage = ({ message }: { message?: string }) => {
    if (!message) return null;
    return (
      <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mt-1.5">
        <Info className="h-3.5 w-3.5 shrink-0" />
        {message}
      </p>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b border-border/60">
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Create Credit Note
          </SheetTitle>
          <SheetDescription>
            For invoice {invoiceNumber} (Malta VAT Compliant)
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading invoice items…</span>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Malta VAT Compliance Alert */}
              <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-300">Malta VAT Compliance</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
                  Credit notes correct issued invoices per Malta VAT regulations. This action will be logged in the audit trail.
                </AlertDescription>
              </Alert>

              {/* Remaining Balance Info */}
              {remainingAmount > 0 && (
                <div className="bg-muted/50 p-3 rounded-md text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice Total:</span>
                    <span>€{formatNumber(invoiceTotal, 2)}</span>
                  </div>
                  {existingCredits > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Existing Credits:</span>
                      <span className="text-amber-600">-€{formatNumber(existingCredits, 2)}</span>
                    </div>
                  )}
                  {existingPayments > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payments Received:</span>
                      <span className="text-green-600">-€{formatNumber(existingPayments, 2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium border-t pt-1 mt-1">
                    <span>Remaining Balance:</span>
                    <span>€{formatNumber(remainingAmount, 2)}</span>
                  </div>
                </div>
              )}

              {/* Reason Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Select value={reason} onValueChange={handleReasonChange} disabled={submitting}>
                  <SelectTrigger className={`bg-background ${showValidation && validationErrors.reason ? 'border-amber-500' : ''}`}>
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {CREDIT_NOTE_REASONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showValidation && <ValidationMessage message={validationErrors.reason} />}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Additional Details</Label>
                <Textarea
                  placeholder="Optional details for the credit note..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[80px] resize-none"
                  disabled={submitting}
                  maxLength={500}
                />
              </div>

              <Separator />

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Line Items</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetItems}
                    disabled={submitting}
                    className="text-xs h-7"
                  >
                    Reset to Original
                  </Button>
                </div>

                {lineItems.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center border rounded-md border-dashed">
                    No items to credit
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium flex-1 line-clamp-2">{item.description}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeLineItem(index)}
                            disabled={submitting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Qty</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm"
                              disabled={submitting}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Unit Price</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm"
                              disabled={submitting}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Line Total</Label>
                            <div className="h-8 flex items-center text-sm font-medium">
                              €{formatNumber(item.quantity * item.unit_price, 2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Totals */}
              <div className={`bg-muted p-4 rounded-lg space-y-2 ${showValidation && (validationErrors.total || validationErrors.exceedsRemaining) ? 'ring-1 ring-amber-500' : ''}`}>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Net Total:</span>
                  <span>€{formatNumber(totals.netTotal, 2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT:</span>
                  <span>€{formatNumber(totals.vatTotal, 2)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Total Credit:</span>
                  <span className="text-primary">€{formatNumber(totals.grandTotal, 2)}</span>
                </div>
                {showValidation && <ValidationMessage message={validationErrors.total || validationErrors.exceedsRemaining} />}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="shrink-0 px-5 py-4 border-t border-border/60 bg-background">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleSubmit("draft")}
                    disabled={submitting || lineItems.length === 0}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                    Save Draft
                  </Button>
                  <Button
                    onClick={() => handleSubmit("issue")}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                    Issue Credit Note
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
