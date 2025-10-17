import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invoiceService } from "@/services/invoiceService";
import { formatNumber } from "@/lib/utils";

interface CreateCreditNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  originalAmount: number;
  vatRate: number;
  onSuccess?: () => void;
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

export function CreateCreditNoteDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  originalAmount,
  vatRate,
  onSuccess,
}: CreateCreditNoteDialogProps) {
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const netAmount = parseFloat(amount) || 0;
  const vatAmount = netAmount * vatRate;
  const totalAmount = netAmount + vatAmount;

  const isValid = 
    netAmount > 0 && 
    netAmount <= originalAmount && 
    reason !== "" && 
    description.trim() !== "";

  const handleSubmit = async () => {
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create a single credit note item with the full amount
      const items = [
        {
          description: description,
          quantity: 1,
          unit_price: netAmount,
          vat_rate: vatRate,
          unit: "credit",
        },
      ];

      const result = await invoiceService.createCreditNote(
        invoiceId,
        netAmount,
        `${CREDIT_NOTE_REASONS.find((r) => r.value === reason)?.label || reason}: ${description}`,
        items
      );

      if (result.success) {
        // Reset form
        setAmount("");
        setReason("");
        setDescription("");
        onOpenChange(false);
        
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error: any) {
      toast({
        title: "Error Creating Credit Note",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only valid decimal numbers
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-background border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Create Credit Note
          </DialogTitle>
          <DialogDescription>
            Create a credit note for invoice {invoiceNumber} (Malta VAT Compliant)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Malta VAT Compliance Alert */}
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-300">
              Malta VAT Compliance
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
              Credit notes are used to correct issued invoices per Malta VAT regulations. 
              This action will be logged in the audit trail and cannot be undone.
            </AlertDescription>
          </Alert>

          {/* Original Invoice Amount */}
          <div className="bg-muted p-3 rounded-md">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Original Invoice Amount:</span>
              <span className="font-semibold">€{formatNumber(originalAmount, 2)}</span>
            </div>
          </div>

          {/* Credit Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium">
              Credit Amount (Net) <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                €
              </span>
              <Input
                id="amount"
                type="text"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                className="pl-7"
                disabled={isSubmitting}
              />
            </div>
            {netAmount > originalAmount && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Credit amount cannot exceed original invoice amount
              </p>
            )}
          </div>

          {/* VAT Calculation Display */}
          {netAmount > 0 && (
            <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Amount:</span>
                <span>€{formatNumber(netAmount, 2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  VAT ({formatNumber(vatRate * 100, 0)}%):
                </span>
                <span>€{formatNumber(vatAmount, 2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                <span>Total Credit:</span>
                <span>€{formatNumber(totalAmount, 2)}</span>
              </div>
            </div>
          )}

          {/* Reason Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium">
              Reason for Credit Note <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason} disabled={isSubmitting}>
              <SelectTrigger id="reason" className="bg-background">
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
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Detailed Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Provide a detailed explanation for this credit note (required for audit trail)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] resize-none"
              disabled={isSubmitting}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/500 characters
            </p>
          </div>

          {/* Validation Warning */}
          {!isValid && (amount !== "" || reason !== "" || description !== "") && (
            <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-400 text-sm">
                Please ensure all required fields are filled correctly before submitting.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? "Creating..." : "Create Credit Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
