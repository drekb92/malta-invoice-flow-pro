import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, ArrowRight, Bell } from "lucide-react";

interface OverdueInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string;
  total_amount: number;
  balance_due: number;
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

export function ReceivablesAgingCard({ overdueInvoices, formatCurrency }: ReceivablesAgingCardProps) {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const agingBuckets = useMemo<AgingBucket[]>(() => {
    const buckets: AgingBucket[] = [
      { label: "1–30 days", range: "1-30", min: 1, max: 30, count: 0, amount: 0 },
      { label: "31–60 days", range: "31-60", min: 31, max: 60, count: 0, amount: 0 },
      { label: "61–90 days", range: "61-90", min: 61, max: 90, count: 0, amount: 0 },
      { label: "90+ days", range: "90+", min: 91, max: Infinity, count: 0, amount: 0 },
    ];

    overdueInvoices.forEach((invoice) => {
      const bucket = buckets.find((b) => invoice.days_overdue >= b.min && invoice.days_overdue <= b.max);
      if (bucket) {
        bucket.count += 1;
        bucket.amount += invoice.total_amount;
      }
    });

    return buckets;
  }, [overdueInvoices]);

  // Only show buckets that have invoices — hide empty ones entirely
  const activeBuckets = agingBuckets.filter((b) => b.count > 0);

  const topOverdueInvoices = useMemo(
    () => [...overdueInvoices].sort((a, b) => b.days_overdue - a.days_overdue).slice(0, 10),
    [overdueInvoices],
  );

  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);

  const getPercentOfOutstanding = (amount: number) =>
    totalOverdue > 0 ? Math.round((amount / totalOverdue) * 100) : 0;

  // Colour per bucket index (0=amber → 3=red)
  const bucketStyles = [
    "bg-amber-50 border-amber-100 text-amber-900 hover:bg-amber-100/70",
    "bg-orange-50 border-orange-100 text-orange-900 hover:bg-orange-100/70",
    "bg-rose-50 border-rose-100 text-rose-900 hover:bg-rose-100/70",
    "bg-red-50 border-red-100 text-red-900 hover:bg-red-100/70",
  ];

  // Map active bucket back to its original index for colour consistency
  const originalIndex = (bucket: AgingBucket) => agingBuckets.findIndex((b) => b.range === bucket.range);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Receivables Aging
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground h-6 px-2"
            onClick={() => navigate("/invoices?status=overdue")}
          >
            View all
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {overdueInvoices.length > 0 ? (
          <>
            {/* Active aging buckets only — empty ones are hidden */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeBuckets.map((bucket) => {
                const idx = originalIndex(bucket);
                const pct = getPercentOfOutstanding(bucket.amount);
                return (
                  <button
                    key={bucket.range}
                    onClick={() => navigate(`/invoices?status=overdue&aging=${bucket.range}`)}
                    className={`flex flex-col items-start px-3 py-2.5 rounded-md border transition-colors cursor-pointer ${bucketStyles[idx]}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-medium opacity-70">{bucket.label}</span>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(bucket.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between w-full mt-0.5">
                      <span className="text-[10px] opacity-60">
                        {bucket.count} invoice{bucket.count !== 1 ? "s" : ""}
                      </span>
                      <span className="text-[10px] opacity-60 tabular-nums">{pct}% of outstanding</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Send reminders CTA */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-sm font-medium border-dashed hover:border-solid hover:bg-muted/50"
                >
                  <Bell className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Send reminders to {overdueInvoices.length} overdue invoice
                  {overdueInvoices.length !== 1 ? "s" : ""}
                  <ArrowRight className="h-3.5 w-3.5 ml-auto" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-amber-500" />
                    Overdue Follow-up
                  </SheetTitle>
                  <SheetDescription>Top 10 overdue invoices sorted by longest outstanding</SheetDescription>
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
                              <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                              <span className="font-semibold truncate">{invoice.invoice_number}</span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1 truncate">
                              {invoice.customer_name || "Unknown Customer"}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold tabular-nums">{formatCurrency(invoice.total_amount)}</div>
                            <Badge variant="outline" className="text-xs mt-1 border-rose-200 text-rose-700 bg-rose-50">
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
                    View all overdue invoices
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="text-3xl mb-2">🎉</div>
            <p className="text-sm font-medium text-foreground">No overdue invoices</p>
            <p className="text-xs text-muted-foreground mt-1">All payments received on time</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
