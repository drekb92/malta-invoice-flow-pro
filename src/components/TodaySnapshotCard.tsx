import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TodaySnapshotCardProps {
  invoicesCreatedToday: number;
  paymentsReceivedToday: number;
  amountCollectedToday: number;
  formatCurrency: (amount: number) => string;
}

export function TodaySnapshotCard({
  invoicesCreatedToday,
  paymentsReceivedToday,
  amountCollectedToday,
  formatCurrency,
}: TodaySnapshotCardProps) {
  const hasActivity = invoicesCreatedToday > 0 || paymentsReceivedToday > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold tabular-nums">
              {invoicesCreatedToday}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Invoices created
            </p>
          </div>
          <div className="text-center border-x border-border">
            <p className="text-2xl font-semibold tabular-nums">
              {paymentsReceivedToday}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Payments received
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold tabular-nums text-emerald-600">
              {formatCurrency(amountCollectedToday)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Collected
            </p>
          </div>
        </div>
        {!hasActivity && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              No activity yet today
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
