import { format } from "date-fns";
import { useEffect, useState } from "react";
import { FileText, CheckCircle, Clock, CreditCard, AlertCircle, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  is_issued: boolean;
}

interface CreditNote {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  amount: number;
  reason: string;
}

interface Payment {
  id: string;
  payment_date: string;
  amount: number;
  method: string | null;
}

interface InvoiceSettlementSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, { className: string; icon: React.ElementType; label: string }> = {
    paid: {
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      icon: CheckCircle,
      label: "Paid",
    },
    pending: {
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      icon: Clock,
      label: "Pending",
    },
    partially_paid: {
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      icon: CreditCard,
      label: "Partially Paid",
    },
    issued: {
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      icon: FileText,
      label: "Issued",
    },
    overdue: {
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      icon: AlertCircle,
      label: "Overdue",
    },
    draft: {
      className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      icon: FileText,
      label: "Draft",
    },
  };
  return variants[status] || variants.draft;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export const InvoiceSettlementSheet = ({
  open,
  onOpenChange,
  invoice,
}: InvoiceSettlementSheetProps) => {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      loadSettlementData();
    }
  }, [open, invoice?.id]);

  const loadSettlementData = async () => {
    if (!invoice) return;
    
    setLoading(true);
    try {
      const [creditNotesResult, paymentsResult] = await Promise.all([
        supabase
          .from("credit_notes")
          .select("id, credit_note_number, credit_note_date, amount, reason")
          .eq("original_invoice_id", invoice.id)
          .order("credit_note_date", { ascending: false }),
        supabase
          .from("payments")
          .select("id, payment_date, amount, method")
          .eq("invoice_id", invoice.id)
          .order("payment_date", { ascending: false }),
      ]);

      if (creditNotesResult.data) {
        setCreditNotes(creditNotesResult.data);
      }
      if (paymentsResult.data) {
        setPayments(paymentsResult.data);
      }
    } catch (error) {
      console.error("Error loading settlement data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  const statusBadge = getStatusBadge(invoice.status);
  const StatusIcon = statusBadge.icon;

  const totalCredits = creditNotes.reduce((sum, cn) => sum + Number(cn.amount), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const adjustedTotal = invoice.total_amount - totalCredits;
  const remainingBalance = adjustedTotal - totalPayments;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[400px] p-0 overflow-y-auto">
        <SheetHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-lg font-semibold">
                Invoice {invoice.invoice_number}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground flex-wrap">
                <Badge className={`${statusBadge.className} text-xs`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusBadge.label}
                </Badge>
                <span>·</span>
                <span>{format(new Date(invoice.invoice_date), "dd MMM yyyy")}</span>
                <span>·</span>
                <span>Due {format(new Date(invoice.due_date), "dd MMM yyyy")}</span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <Separator />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="px-6 py-4 space-y-6">
            {/* Settlement Summary */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Settlement Summary
              </h3>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Invoice Total</span>
                  <span className="font-semibold">{formatCurrency(invoice.total_amount)}</span>
                </div>
                
                {totalCredits > 0 && (
                  <div className="flex justify-between items-center text-amber-600">
                    <span className="text-sm">Credit Notes Applied</span>
                    <span className="font-medium">−{formatCurrency(totalCredits)}</span>
                  </div>
                )}

                {totalCredits > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Adjusted Total</span>
                      <span className="font-semibold">{formatCurrency(adjustedTotal)}</span>
                    </div>
                  </>
                )}

                {totalPayments > 0 && (
                  <div className="flex justify-between items-center text-green-600">
                    <span className="text-sm">Payments Received</span>
                    <span className="font-medium">−{formatCurrency(totalPayments)}</span>
                  </div>
                )}
                
                <Separator className="my-2" />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Balance Due</span>
                  {remainingBalance <= 0 ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Settled
                    </Badge>
                  ) : (
                    <span className="text-lg font-bold text-destructive">
                      {formatCurrency(remainingBalance)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Credit Notes List */}
            {creditNotes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Credit Notes ({creditNotes.length})
                </h3>
                <div className="space-y-2">
                  {creditNotes.map((cn) => (
                    <div
                      key={cn.id}
                      className="flex justify-between items-start p-3 bg-muted/30 rounded-lg"
                    >
                      <div>
                        <div className="text-sm font-medium">{cn.credit_note_number}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(cn.credit_note_date), "dd MMM yyyy")} · {cn.reason}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-amber-600">
                        −{formatCurrency(Number(cn.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payments List */}
            {payments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Payments ({payments.length})
                </h3>
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-start p-3 bg-muted/30 rounded-lg"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {format(new Date(p.payment_date!), "dd MMM yyyy")}
                        </div>
                        {p.method && (
                          <div className="text-xs text-muted-foreground capitalize">
                            {p.method}
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-medium text-green-600">
                        −{formatCurrency(Number(p.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {creditNotes.length === 0 && payments.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No payments or credit notes recorded yet.
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
