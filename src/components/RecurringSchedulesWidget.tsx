import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { useActiveRecurringSchedules, type RecurringInvoice } from "@/hooks/useRecurringInvoices";
import { useNavigate } from "react-router-dom";

interface RecurringSchedulesWidgetProps {
  userId: string | undefined;
}

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

export function RecurringSchedulesWidget({ userId }: RecurringSchedulesWidgetProps) {
  const { data: schedules, isLoading } = useActiveRecurringSchedules(userId);
  const navigate = useNavigate();

  if (isLoading || !schedules || schedules.length === 0) return null;

  const nextUpcoming = schedules[0]; // Already sorted by next_run_date asc

  return (
    <Card className="shadow-sm">
      <CardHeader className="py-2.5 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            Recurring Schedules
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {schedules.length} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-4 pb-3">
        <div className="space-y-2">
          {schedules.slice(0, 3).map((schedule) => (
            <button
              key={schedule.id}
              onClick={() => navigate(`/invoices/${schedule.source_invoice_id}`)}
              className="w-full flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-medium truncate">
                  {frequencyLabels[schedule.frequency]}
                </span>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                Next: {format(new Date(schedule.next_run_date), "dd MMM")}
              </span>
            </button>
          ))}
        </div>
        {schedules.length > 3 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            +{schedules.length - 3} more
          </p>
        )}
      </CardContent>
    </Card>
  );
}
