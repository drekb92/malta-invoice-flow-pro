import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePendingRecurringDrafts } from "@/hooks/useRecurringInvoices";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annual",
};

interface RecurringDraftsPendingWidgetProps {
  userId: string;
}

export function RecurringDraftsPendingWidget({ userId }: RecurringDraftsPendingWidgetProps) {
  const navigate = useNavigate();
  const { data: drafts, isLoading } = usePendingRecurringDrafts(userId);

  if (isLoading || !drafts || drafts.length === 0) return null;

  return (
    <Card className="shadow-sm border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-900 dark:text-amber-100">
              {drafts.length === 1
                ? "1 recurring invoice ready to review"
                : `${drafts.length} recurring invoices ready to review`}
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-700 dark:text-amber-300 hover:text-amber-900"
            onClick={() => navigate("/invoices?status=recurringDraft")}
          >
            View all
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-3 space-y-2">
        {drafts.slice(0, 3).map((draft) => {
          const frequency = (draft.recurring_invoice as any)?.frequency;
          return (
            <div
              key={draft.id}
              className="flex items-center justify-between rounded-md bg-background border border-border px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {draft.customers?.name ?? "Unknown client"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {draft.invoice_date
                      ? format(new Date(draft.invoice_date), "dd MMM yyyy")
                      : "—"}
                    {frequency && (
                      <>
                        {" · "}
                        <Badge variant="secondary" className="text-xs py-0 px-1.5 h-4">
                          {frequencyLabels[frequency] ?? frequency}
                        </Badge>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-sm font-semibold">
                  {formatCurrency(draft.total_amount ?? 0)}
                </span>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => navigate(`/invoices/edit/${draft.id}`)}
                >
                  Review &amp; Issue
                </Button>
              </div>
            </div>
          );
        })}
        {drafts.length > 3 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            +{drafts.length - 3} more — <button
              type="button"
              className="underline"
              onClick={() => navigate("/invoices?status=recurringDraft")}
            >
              view all
            </button>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
