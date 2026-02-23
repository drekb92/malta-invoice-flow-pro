// src/lib/dashboard.ts
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export type DateRange = "7-days" | "30-days" | "90-days" | "12-months" | "ytd" | "all";

export interface DashboardFilters {
  dateRange?: DateRange;
  customerId?: string; // "all" or a UUID
}

// Converts a dateRange string into a UTC ISO start-of-period string.
// Returns null for "all" (no lower bound).
function dateRangeToStartISO(dateRange: DateRange | undefined): string | null {
  if (!dateRange || dateRange === "all") return null;

  const now = new Date();

  if (dateRange === "ytd") {
    return new Date(now.getFullYear(), 0, 1).toISOString();
  }

  const days: Record<string, number> = {
    "7-days": 7,
    "30-days": 30,
    "90-days": 90,
    "12-months": 365,
  };

  const d = days[dateRange];
  if (!d) return null;

  const start = new Date(now);
  start.setDate(start.getDate() - d);
  return start.toISOString();
}

// ---------------------------------------------------------------------------
// Setup status  (no filters — always reflects full account state)
// ---------------------------------------------------------------------------

export async function getSetupStatus(userId: string) {
  const { data: companyData } = await supabase
    .from("company_settings")
    .select("id, company_name, company_vat_number, company_address")
    .eq("user_id", userId)
    .maybeSingle();

  const hasCompanyInfo = !!companyData;

  const { data: bankingData } = await supabase
    .from("banking_details")
    .select("id, bank_name, bank_iban")
    .eq("user_id", userId)
    .maybeSingle();

  const hasBankingInfo = !!bankingData;

  const { data: customers } = await supabase.from("customers").select("id").eq("user_id", userId).limit(1);

  const hasCustomers = !!customers && customers.length > 0;

  const { data: invoices } = await supabase.from("invoices").select("id").eq("user_id", userId).limit(1);

  const hasInvoices = !!invoices && invoices.length > 0;

  const completedSteps = [hasCompanyInfo, hasBankingInfo, hasCustomers, hasInvoices].filter(Boolean).length;

  const completionPercentage = (completedSteps / 4) * 100;
  const isComplete = completionPercentage === 100;

  return {
    hasCompanyInfo,
    hasBankingInfo,
    hasCustomers,
    hasInvoices,
    completionPercentage,
    isComplete,
  };
}

// ---------------------------------------------------------------------------
// Dashboard metrics  (filtered by dateRange + customerId)
// ---------------------------------------------------------------------------

export async function getDashboardMetrics(userId: string, filters: DashboardFilters = {}) {
  const startISO = dateRangeToStartISO(filters.dateRange as DateRange);
  const filterCustomer = filters.customerId && filters.customerId !== "all" ? filters.customerId : null;

  // ── Invoices query ──────────────────────────────────────────────────────────
  let invoicesQuery = supabase
    .from("invoices")
    .select("total_amount, status, customer_id, created_at")
    .eq("user_id", userId);

  if (startISO) invoicesQuery = invoicesQuery.gte("created_at", startISO);
  if (filterCustomer) invoicesQuery = invoicesQuery.eq("customer_id", filterCustomer);

  const { data: invoices } = await invoicesQuery;

  const outstanding =
    invoices?.filter((inv) => inv.status !== "paid").reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;

  const payments =
    invoices?.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;

  const totalInvoiced = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;

  const collectionRate = totalInvoiced > 0 ? ((totalInvoiced - outstanding) / totalInvoiced) * 100 : 0;

  const invoicesCount = invoices?.length || 0;
  const invoicesTotal = totalInvoiced;

  // ── Customers count ─────────────────────────────────────────────────────────
  // When a customer filter is active, count = 1 (the selected customer).
  // When no filter: count all customers for this user (unaffected by date range
  // since customers aren't time-scoped the same way).
  let customersCount = 0;
  if (filterCustomer) {
    customersCount = 1;
  } else {
    let customersQuery = supabase.from("customers").select("id").eq("user_id", userId);

    // If date-scoped, only count customers created within the window
    if (startISO) customersQuery = customersQuery.gte("created_at", startISO);

    const { data: customerRows } = await customersQuery;
    customersCount = customerRows?.length || 0;
  }

  return {
    outstanding,
    customers: customersCount,
    payments,
    collectionRate,
    invoicesCount,
    invoicesTotal,
  };
}

// ---------------------------------------------------------------------------
// Recent customers  (unfiltered — used to populate the customer dropdown)
// ---------------------------------------------------------------------------

export async function getRecentCustomersWithOutstanding(userId: string) {
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, email")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50); // broader limit so the dropdown is useful

  if (!customers || customers.length === 0) return [];

  const { data: invoices } = await supabase
    .from("invoices")
    .select("customer_id, total_amount, status")
    .eq("user_id", userId)
    .in(
      "customer_id",
      customers.map((c) => c.id),
    );

  return customers.map((customer) => {
    const customerInvoices = invoices?.filter((inv) => inv.customer_id === customer.id) || [];

    const outstanding = customerInvoices
      .filter((inv) => inv.status !== "paid")
      .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

    return { ...customer, outstanding_amount: outstanding };
  });
}

// ---------------------------------------------------------------------------
// Overdue invoices  (filtered by customerId only — "overdue" is always today)
// ---------------------------------------------------------------------------

export async function getOverdueInvoices(userId: string, filters: DashboardFilters = {}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const filterCustomer = filters.customerId && filters.customerId !== "all" ? filters.customerId : null;

  let query = supabase
    .from("invoices")
    .select("id, invoice_number, customer_id, total_amount, due_date, status, last_sent_at, last_sent_channel")
    .eq("user_id", userId)
    .neq("status", "paid")
    .lt("due_date", todayStr)
    .order("due_date", { ascending: true })
    .limit(10);

  if (filterCustomer) query = query.eq("customer_id", filterCustomer);

  const { data: invoices } = await query;

  if (!invoices || invoices.length === 0) return [];

  const invoiceIds = invoices.map((inv) => inv.id);
  const customerIds = [...new Set(invoices.map((inv) => inv.customer_id))];

  const [customersRes, reminderRes, paymentsRes] = await Promise.all([
    supabase.from("customers").select("id, name").in("id", customerIds),
    supabase
      .from("reminder_logs")
      .select("invoice_id, sent_at")
      .in("invoice_id", invoiceIds)
      .order("sent_at", { ascending: false }),
    supabase.from("payments").select("invoice_id, amount").in("invoice_id", invoiceIds),
  ]);

  const customerMap = new Map((customersRes.data || []).map((c) => [c.id, c.name]));

  const lastReminderMap = new Map<string, string>();
  reminderRes.data?.forEach((log) => {
    if (!lastReminderMap.has(log.invoice_id)) {
      lastReminderMap.set(log.invoice_id, log.sent_at || "");
    }
  });

  const paidMap = new Map<string, number>();
  paymentsRes.data?.forEach((p) => {
    paidMap.set(p.invoice_id, (paidMap.get(p.invoice_id) || 0) + Number(p.amount || 0));
  });

  const today = new Date();

  return invoices.map((invoice) => {
    const dueDate = new Date(invoice.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalAmount = Number(invoice.total_amount || 0);
    const totalPaid = paidMap.get(invoice.id) || 0;
    const balanceDue = Math.max(totalAmount - totalPaid, 0);

    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      customer_name: customerMap.get(invoice.customer_id) || "Unknown",
      total_amount: totalAmount,
      balance_due: balanceDue,
      due_date: invoice.due_date,
      days_overdue: daysOverdue,
      last_sent_at: invoice.last_sent_at || null,
      last_sent_channel: invoice.last_sent_channel || null,
      last_reminded_at: lastReminderMap.get(invoice.id) || null,
    };
  });
}

// ---------------------------------------------------------------------------
// Pending reminders  (no filters)
// ---------------------------------------------------------------------------

export async function getPendingReminders(userId: string) {
  const today = new Date();
  const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { count } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "paid")
    .lte("due_date", threeDaysFromNow);

  return count || 0;
}

// ---------------------------------------------------------------------------
// Today's snapshot  (no filters — always "what happened today")
// ---------------------------------------------------------------------------

export async function getTodaySnapshot(userId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  const { data: invoicesToday } = await supabase
    .from("invoices")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", todayStr);

  const { data: paymentsToday } = await supabase
    .from("payments")
    .select("id, amount")
    .eq("user_id", userId)
    .gte("created_at", todayStr);

  return {
    invoicesCreatedToday: invoicesToday?.length || 0,
    paymentsReceivedToday: paymentsToday?.length || 0,
    amountCollectedToday: paymentsToday?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0,
  };
}

// ---------------------------------------------------------------------------
// Invoices needing sending  (filtered by customerId only)
// ---------------------------------------------------------------------------

export async function getInvoicesNeedingSending(userId: string, filters: DashboardFilters = {}) {
  const filterCustomer = filters.customerId && filters.customerId !== "all" ? filters.customerId : null;

  let query = supabase
    .from("invoices")
    .select("id, invoice_number, customer_id, total_amount, status, last_sent_at")
    .eq("user_id", userId)
    .or("status.eq.draft,and(status.neq.draft,last_sent_at.is.null)")
    .order("created_at", { ascending: false })
    .limit(5);

  if (filterCustomer) query = query.eq("customer_id", filterCustomer);

  const { data: invoices } = await query;

  if (!invoices || invoices.length === 0) return [];

  const customerIds = [...new Set(invoices.map((inv) => inv.customer_id).filter(Boolean))];

  const { data: customers } = await supabase.from("customers").select("id, name, email").in("id", customerIds);

  const customerMap = new Map((customers || []).map((c) => [c.id, { name: c.name, email: c.email }]));

  return invoices.map((invoice) => {
    const customer = customerMap.get(invoice.customer_id) || {
      name: "Unknown",
      email: null,
    };
    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number || "Draft",
      customer_id: invoice.customer_id,
      customer_name: customer.name,
      customer_email: customer.email,
      total_amount: Number(invoice.total_amount || 0),
      status: invoice.status || "draft",
    };
  });
}
