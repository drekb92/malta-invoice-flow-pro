import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

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

  // Formatted time for "last updated" stamp
  const lastUpdated = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Today
          </CardTitle>
          <span className="text-[10px] text-muted-foreground/60 tabular-nums">Updated {lastUpdated}</span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Invoices created */}
          <div className="text-center">
            <p
              className={`text-2xl font-semibold tabular-nums ${
                invoicesCreatedToday > 0 ? "text-blue-600" : "text-muted-foreground/50"
              }`}
            >
              {invoicesCreatedToday}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-tight">Invoices created</p>
          </div>

          {/* Payments received */}
          <div className="text-center border-x border-border">
            <p
              className={`text-2xl font-semibold tabular-nums ${
                paymentsReceivedToday > 0 ? "text-blue-600" : "text-muted-foreground/50"
              }`}
            >
              {paymentsReceivedToday}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-tight">Payments received</p>
          </div>

          {/* Amount collected */}
          <div className="text-center">
            <p
              className={`text-2xl font-semibold tabular-nums ${
                amountCollectedToday > 0 ? "text-emerald-600" : "text-muted-foreground/50"
              }`}
            >
              {formatCurrency(amountCollectedToday)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-tight">Collected</p>
          </div>
        </div>

        {/* Activity status */}
        <div className="mt-4 pt-3 border-t border-border">
          {hasActivity ? (
            <p className="text-xs text-emerald-600 text-center font-medium">Activity recorded today</p>
          ) : (
            <p className="text-xs text-muted-foreground text-center">No activity yet today — check back later</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
