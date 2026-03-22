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

      </CardContent>
    </Card>
  );
}
