import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, ArrowRight, AlertTriangle } from "lucide-react";

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  total_amount: number;
  due_date: string;
  days_overdue: number;
  last_sent_at?: string | null;
  last_sent_channel?: string | null;
  last_reminded_at?: string | null;
}

interface AgingBucket {
  label: string;
  range: string;
  min: number;
  max: number;
  count: number;
  amount: number;
}

interface ReceivablesAgingCardProps {
  overdueInvoices: OverdueInvoice[];
  formatCurrency: (amount: number) => string;
}

export function ReceivablesAgingCard({
  overdueInvoices,
  formatCurrency,
}: ReceivablesAgingCardProps) {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Calculate aging buckets
  const agingBuckets = useMemo<AgingBucket[]>(() => {
    const buckets: AgingBucket[] = [
      { label: "1-30 days", range: "1-30", min: 1, max: 30, count: 0, amount: 0 },
      { label: "31-60 days", range: "31-60", min: 31, max: 60, count: 0, amount: 0 },
      { label: "61-90 days", range: "61-90", min: 61, max: 90, count: 0, amount: 0 },
      { label: "90+ days", range: "90+", min: 91, max: Infinity, count: 0, amount: 0 },
    ];

    overdueInvoices.forEach((invoice) => {
      const bucket = buckets.find(
        (b) => invoice.days_overdue >= b.min && invoice.days_overdue <= b.max
      );
      if (bucket) {
        bucket.count += 1;
        bucket.amount += invoice.total_amount;
      }
    });

    return buckets;
  }, [overdueInvoices]);

  // Top 10 overdue invoices sorted by days overdue descending
  const topOverdueInvoices = useMemo(() => {
    return [...overdueInvoices]
      .sort((a, b) => b.days_overdue - a.days_overdue)
      .slice(0, 10);
  }, [overdueInvoices]);

  const totalOverdue = overdueInvoices.reduce(
    (sum, inv) => sum + inv.total_amount,
    0
  );

  const handleBucketClick = (bucket: AgingBucket) => {
    navigate(`/invoices?status=overdue&aging=${bucket.range}`);
  };

  const getBucketColor = (index: number) => {
    const colors = [
      "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200",
      "bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200",
      "bg-red-100 text-red-800 hover:bg-red-200 border-red-200",
      "bg-red-200 text-red-900 hover:bg-red-300 border-red-300",
    ];
    return colors[index] || colors[0];
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Receivables Aging
          </CardTitle>
          {overdueInvoices.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {formatCurrency(totalOverdue)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {overdueInvoices.length > 0 ? (
          <>
            {/* Aging Buckets Grid */}
            <div className="grid grid-cols-2 gap-2">
              {agingBuckets.map((bucket, index) => (
                <button
                  key={bucket.range}
                  onClick={() => bucket.count > 0 && handleBucketClick(bucket)}
                  disabled={bucket.count === 0}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    bucket.count > 0
                      ? `${getBucketColor(index)} cursor-pointer`
                      : "bg-muted/50 text-muted-foreground border-muted cursor-not-allowed opacity-60"
                  }`}
                >
                  <div className="text-xs font-medium opacity-80">
                    {bucket.label}
                  </div>
                  <div className="text-sm font-bold mt-1">
                    {bucket.count > 0 ? formatCurrency(bucket.amount) : "—"}
                  </div>
                  <div className="text-xs opacity-70">
                    {bucket.count} invoice{bucket.count !== 1 ? "s" : ""}
                  </div>
                </button>
              ))}
            </div>

            {/* Start Follow-up Button */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-2" />
                  Start follow-up
                  <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    Follow-up Required
                  </SheetTitle>
                  <SheetDescription>
                    Top 10 overdue invoices sorted by days overdue
                  </SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-180px)] mt-6">
                  <div className="space-y-3 pr-4">
                    {topOverdueInvoices.map((invoice, index) => (
                      <button
                        key={invoice.id}
                        onClick={() => {
                          setDrawerOpen(false);
                          navigate(`/invoices/${invoice.id}`);
                        }}
                        className="w-full p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                #{index + 1}
                              </span>
                              <span className="font-semibold truncate">
                                {invoice.invoice_number}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1 truncate">
                              {invoice.customer_name || "Unknown Customer"}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-destructive">
                              {formatCurrency(invoice.total_amount)}
                            </div>
                            <Badge
                              variant="destructive"
                              className="text-xs mt-1"
                            >
                              {invoice.days_overdue}d overdue
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t">
                  <Button
                    className="w-full"
                    onClick={() => {
                      setDrawerOpen(false);
                      navigate("/invoices?status=overdue");
                    }}
                  >
                    View All Overdue Invoices
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-2xl mb-2">🎉</div>
            <p className="text-sm text-muted-foreground">
              No overdue invoices!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              All payments received on time
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
