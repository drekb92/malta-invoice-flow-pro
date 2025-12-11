import { format } from "date-fns";
import { X, FileText, CheckCircle, Clock, CreditCard, AlertCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  is_issued: boolean;
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
  if (!invoice) return null;

  const statusBadge = getStatusBadge(invoice.status);
  const StatusIcon = statusBadge.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[400px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-lg font-semibold">
                Invoice {invoice.invoice_number}
              </SheetTitle>
              <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
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

        <div className="px-6 py-4 space-y-6">
          {/* Invoice Amount Summary */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Settlement Summary
            </h3>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Invoice Total</span>
                <span className="font-semibold">{formatCurrency(invoice.total_amount)}</span>
              </div>
              
              {/* Placeholder for payments and credits - will be populated with real data */}
              <Separator className="my-2" />
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Balance Due</span>
                <span className="text-lg font-bold text-destructive">
                  {formatCurrency(invoice.total_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Invoice Details
            </h3>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Issue Date</span>
                <span>{format(new Date(invoice.invoice_date), "dd MMMM yyyy")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Date</span>
                <span>{format(new Date(invoice.due_date), "dd MMMM yyyy")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge className={`${statusBadge.className} text-xs`}>
                  {statusBadge.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
