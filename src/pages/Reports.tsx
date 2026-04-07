import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Euro, FileText, Users, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subMonths, startOfMonth, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_id: string;
  total_amount: number;
  status: string;
  invoice_date: string;
  due_date: string;
  customers?: { name: string } | null;
}

interface PaymentRow {
  id: string;
  amount: number;
  payment_date: string;
  invoice_id: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `€${Number(n || 0).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtK = (n: number) => {
  if (Math.abs(n) >= 1000) return `€${(n / 1000).toFixed(1)}k`;
  return `€${Math.round(n)}`;
};

function getAgingBucket(daysOverdue: number): "current" | "1-30" | "31-60" | "61-90" | "90+" {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {fmt(entry.value)}
        </p>
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [period, setPeriod] = useState("12");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: invData }, { data: pmtData }] = await Promise.all([
          supabase
            .from("invoices")
            .select("id, invoice_number, customer_id, total_amount, status, invoice_date, due_date, customers(name)")
            .eq("user_id", user.id)
            .neq("status", "draft")
            .order("invoice_date", { ascending: true }),
          supabase
            .from("payments")
            .select("id, amount, payment_date, invoice_id")
            .eq("user_id", user.id)
            .order("payment_date", { ascending: true }),
        ]);
        setInvoices((invData as InvoiceRow[]) || []);
        setPayments(pmtData || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  // ── Filter by selected period ────────────────────────────────────────────

  const periodMonths = Number(period);
  const cutoff = useMemo(() => subMonths(new Date(), periodMonths), [periodMonths]);

  const filteredInvoices = useMemo(
    () => invoices.filter((inv) => new Date(inv.invoice_date) >= cutoff),
    [invoices, cutoff],
  );

  const filteredPayments = useMemo(
    () => payments.filter((p) => new Date(p.payment_date) >= cutoff),
    [payments, cutoff],
  );

  // ── KPI metrics ──────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const totalInvoiced = filteredInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const totalCollected = filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const outstanding = filteredInvoices
      .filter((i) => i.status !== "paid")
      .reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;
    const overdueCount = filteredInvoices.filter((i) => {
      if (i.status === "paid") return false;
      return new Date(i.due_date) < new Date();
    }).length;

    return {
      totalInvoiced,
      totalCollected,
      outstanding,
      collectionRate,
      overdueCount,
      invoiceCount: filteredInvoices.length,
    };
  }, [filteredInvoices, filteredPayments]);

  // ── Monthly revenue chart data ───────────────────────────────────────────

  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; invoiced: number; collected: number }> = {};

    for (let i = periodMonths - 1; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, "MMM yy");
      months[key] = { month: key, invoiced: 0, collected: 0 };
    }

    filteredInvoices.forEach((inv) => {
      const key = format(new Date(inv.invoice_date), "MMM yy");
      if (months[key]) months[key].invoiced += Number(inv.total_amount || 0);
    });

    filteredPayments.forEach((p) => {
      const key = format(new Date(p.payment_date), "MMM yy");
      if (months[key]) months[key].collected += Number(p.amount || 0);
    });

    return Object.values(months);
  }, [filteredInvoices, filteredPayments, periodMonths]);

  // ── Aging report (uses ALL outstanding invoices, not period-filtered) ────

  const agingData = useMemo(() => {
    const today = new Date();
    const paidByInvoice = payments.reduce(
      (acc, p) => {
        acc[p.invoice_id] = (acc[p.invoice_id] || 0) + Number(p.amount || 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    const customerBuckets: Record<
      string,
      {
        name: string;
        current: number;
        "1-30": number;
        "31-60": number;
        "61-90": number;
        "90+": number;
        customerId: string;
      }
    > = {};

    invoices.forEach((inv) => {
      if (inv.status === "paid") return;
      const remaining = Number(inv.total_amount || 0) - (paidByInvoice[inv.id] || 0);
      if (remaining <= 0.01) return;

      const daysOverdue = differenceInDays(today, new Date(inv.due_date));
      const bucket = getAgingBucket(daysOverdue);
      const custName = (inv.customers as any)?.name || "Unknown";
      const custId = inv.customer_id;

      if (!customerBuckets[custId]) {
        customerBuckets[custId] = {
          name: custName,
          current: 0,
          "1-30": 0,
          "31-60": 0,
          "61-90": 0,
          "90+": 0,
          customerId: custId,
        };
      }
      customerBuckets[custId][bucket] += remaining;
    });

    return Object.values(customerBuckets)
      .map((c) => ({
        ...c,
        total: c.current + c["1-30"] + c["31-60"] + c["61-90"] + c["90+"],
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);
  }, [invoices, payments]);

  const agingTotals = useMemo(
    () =>
      agingData.reduce(
        (acc, row) => ({
          current: acc.current + row.current,
          "1-30": acc["1-30"] + row["1-30"],
          "31-60": acc["31-60"] + row["31-60"],
          "61-90": acc["61-90"] + row["61-90"],
          "90+": acc["90+"] + row["90+"],
          total: acc.total + row.total,
        }),
        { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0, total: 0 },
      ),
    [agingData],
  );

  // ── Aging chart data ─────────────────────────────────────────────────────

  const agingChartData = [
    { bucket: "Current", amount: agingTotals.current, fill: "#16a34a" },
    { bucket: "1–30d", amount: agingTotals["1-30"], fill: "#ca8a04" },
    { bucket: "31–60d", amount: agingTotals["31-60"], fill: "#ea580c" },
    { bucket: "61–90d", amount: agingTotals["61-90"], fill: "#dc2626" },
    { bucket: "90+d", amount: agingTotals["90+"], fill: "#7f1d1d" },
  ];

  // ── Top customers ────────────────────────────────────────────────────────

  const topCustomers = useMemo(() => {
    // Build a map of total paid per invoice across ALL time (not period-filtered)
    // so outstanding = invoice total - all payments ever made, not just this period.
    const paidByInvoice = payments.reduce(
      (acc, p) => {
        acc[p.invoice_id] = (acc[p.invoice_id] || 0) + Number(p.amount || 0);
        return acc;
      },
      {} as Record<string, number>,
    );

    const map: Record<string, { name: string; invoiced: number; outstanding: number; customerId: string }> = {};
    filteredInvoices.forEach((inv) => {
      const custId = inv.customer_id;
      const custName = (inv.customers as any)?.name || "Unknown";
      if (!map[custId]) map[custId] = { name: custName, invoiced: 0, outstanding: 0, customerId: custId };
      const invTotal = Number(inv.total_amount || 0);
      const paid = paidByInvoice[inv.id] || 0;
      map[custId].invoiced += invTotal;
      // Only count remaining balance as outstanding (respects all-time payments)
      map[custId].outstanding += Math.max(0, invTotal - paid);
    });

    return Object.values(map)
      .sort((a, b) => b.invoiced - a.invoiced)
      .slice(0, 8);
  }, [filteredInvoices, payments]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Reports</h1>
                <p className="text-muted-foreground">Financial analytics for your receivables</p>
              </div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Last 3 months</SelectItem>
                  <SelectItem value="6">Last 6 months</SelectItem>
                  <SelectItem value="12">Last 12 months</SelectItem>
                  <SelectItem value="24">Last 24 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <main className="p-6">
          {loading ? (
            <ReportsSkeleton />
          ) : (
            <div className="space-y-6">
              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Total Invoiced</p>
                        <p className="text-2xl font-bold tabular-nums">{fmt(metrics.totalInvoiced)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{metrics.invoiceCount} invoices</p>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Collected</p>
                        <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
                          {fmt(metrics.totalCollected)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {metrics.collectionRate.toFixed(0)}% collection rate
                        </p>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Outstanding</p>
                        <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                          {fmt(metrics.outstanding)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {metrics.overdueCount > 0 ? `${metrics.overdueCount} overdue` : "None overdue"}
                        </p>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
                        {metrics.overdueCount > 0 ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Collection Rate</p>
                        <p className="text-2xl font-bold tabular-nums">{metrics.collectionRate.toFixed(1)}%</p>
                        <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(metrics.collectionRate, 100)}%`,
                              background:
                                metrics.collectionRate >= 80
                                  ? "#16a34a"
                                  : metrics.collectionRate >= 50
                                    ? "#ca8a04"
                                    : "#dc2626",
                            }}
                          />
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
                        {metrics.collectionRate >= 80 ? (
                          <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ── Revenue Chart ── */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Revenue Overview</CardTitle>
                  <CardDescription>Invoiced vs collected per month</CardDescription>
                </CardHeader>
                <CardContent>
                  {monthlyData.every((d) => d.invoiced === 0 && d.collected === 0) ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                      No data for this period
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={monthlyData} barGap={2} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={fmtK}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          width={52}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                        <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)", paddingTop: 8 }} />
                        <Bar dataKey="invoiced" name="Invoiced" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="collected" name="Collected" fill="#16a34a" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* ── Aging + Top Customers ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Aging Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Aging Breakdown</CardTitle>
                    <CardDescription>All outstanding balances by age</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {agingTotals.total === 0 ? (
                      <div className="flex flex-col items-center justify-center h-40 gap-2">
                        <CheckCircle className="h-8 w-8 text-green-500" />
                        <p className="text-sm text-muted-foreground">No outstanding balances</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={agingChartData} layout="vertical" barCategoryGap="25%">
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis
                            type="number"
                            tickFormatter={fmtK}
                            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            dataKey="bucket"
                            type="category"
                            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                            axisLine={false}
                            tickLine={false}
                            width={42}
                          />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
                          <Bar dataKey="amount" name="Outstanding" radius={[0, 3, 3, 0]}>
                            {agingChartData.map((entry, index) => (
                              <rect key={index} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Top Customers */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Top Customers</CardTitle>
                    <CardDescription>By invoiced amount this period</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {topCustomers.length === 0 ? (
                      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                        No data for this period
                      </div>
                    ) : (
                      <div className="space-y-2.5 mt-1">
                        {topCustomers.map((c) => {
                          const outstanding = c.outstanding;
                          const collected = c.invoiced - outstanding;
                          const rate = c.invoiced > 0 ? (collected / c.invoiced) * 100 : 0;
                          return (
                            <button
                              key={c.customerId}
                              className="w-full text-left"
                              onClick={() => navigate(`/customers/${c.customerId}`)}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate max-w-[55%]">
                                  {c.name}
                                </span>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {outstanding > 0.01 && (
                                    <span className="text-xs text-amber-600 tabular-nums">{fmt(outstanding)} due</span>
                                  )}
                                  <span className="text-xs font-medium tabular-nums text-foreground">
                                    {fmt(c.invoiced)}
                                  </span>
                                </div>
                              </div>
                              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-500 transition-all"
                                  style={{ width: `${Math.min(rate, 100)}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{rate.toFixed(0)}% collected</p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── Aging Detail Table ── */}
              {agingData.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Receivables Aging Detail</CardTitle>
                    <CardDescription>
                      Outstanding balances by customer and age — live from your invoices
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs">Customer</TableHead>
                            <TableHead className="text-right text-xs text-green-700">Current</TableHead>
                            <TableHead className="text-right text-xs text-yellow-700">1–30d</TableHead>
                            <TableHead className="text-right text-xs text-orange-700">31–60d</TableHead>
                            <TableHead className="text-right text-xs text-red-700">61–90d</TableHead>
                            <TableHead className="text-right text-xs text-red-900">90+d</TableHead>
                            <TableHead className="text-right text-xs font-semibold">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agingData.map((row) => (
                            <TableRow
                              key={row.customerId}
                              className="cursor-pointer hover:bg-muted/40 transition-colors"
                              onClick={() => navigate(`/customers/${row.customerId}`)}
                            >
                              <TableCell className="text-sm font-medium py-2">{row.name}</TableCell>
                              <TableCell className="text-right text-sm py-2 tabular-nums text-green-700 dark:text-green-400">
                                {row.current > 0 ? fmt(row.current) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right text-sm py-2 tabular-nums text-yellow-700 dark:text-yellow-400">
                                {row["1-30"] > 0 ? fmt(row["1-30"]) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right text-sm py-2 tabular-nums text-orange-700 dark:text-orange-400">
                                {row["31-60"] > 0 ? (
                                  fmt(row["31-60"])
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm py-2 tabular-nums text-red-700 dark:text-red-400">
                                {row["61-90"] > 0 ? (
                                  fmt(row["61-90"])
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm py-2 tabular-nums text-red-900 dark:text-red-300 font-medium">
                                {row["90+"] > 0 ? fmt(row["90+"]) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right text-sm py-2 tabular-nums font-semibold">
                                {fmt(row.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Totals row */}
                          <TableRow className="border-t-2 bg-muted/30 font-semibold">
                            <TableCell className="text-sm py-2">Total</TableCell>
                            <TableCell className="text-right text-sm py-2 tabular-nums text-green-700 dark:text-green-400">
                              {fmt(agingTotals.current)}
                            </TableCell>
                            <TableCell className="text-right text-sm py-2 tabular-nums text-yellow-700 dark:text-yellow-400">
                              {fmt(agingTotals["1-30"])}
                            </TableCell>
                            <TableCell className="text-right text-sm py-2 tabular-nums text-orange-700 dark:text-orange-400">
                              {fmt(agingTotals["31-60"])}
                            </TableCell>
                            <TableCell className="text-right text-sm py-2 tabular-nums text-red-700 dark:text-red-400">
                              {fmt(agingTotals["61-90"])}
                            </TableCell>
                            <TableCell className="text-right text-sm py-2 tabular-nums text-red-900 dark:text-red-300 font-bold">
                              {fmt(agingTotals["90+"])}
                            </TableCell>
                            <TableCell className="text-right text-sm py-2 tabular-nums font-bold">
                              {fmt(agingTotals.total)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Click any row to view the customer's invoice history.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Reports;
