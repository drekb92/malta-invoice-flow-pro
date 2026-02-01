// src/lib/dashboard.ts
import { supabase } from "@/integrations/supabase/client";

// --- Setup status -------------------------------------------------------------
export async function getSetupStatus(userId: string) {
  // COMPANY INFO: complete if there's any row for this user
  const { data: companyData } = await supabase
    .from("company_settings")
    .select("id, company_name, company_vat_number, company_address")
    .eq("user_id", userId)
    .maybeSingle();

  const hasCompanyInfo = !!companyData;

  // BANKING INFO: complete if there's any row
  const { data: bankingData } = await supabase
    .from("banking_details")
    .select("id, bank_name, bank_iban")
    .eq("user_id", userId)
    .maybeSingle();

  const hasBankingInfo = !!bankingData;

  // CUSTOMERS: at least one
  const { data: customers } = await supabase.from("customers").select("id").eq("user_id", userId).limit(1);

  const hasCustomers = !!customers && customers.length > 0;

  // INVOICES: at least one
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

// --- Metrics ------------------------------------------------------------------
export async function getDashboardMetrics(userId: string) {
  // Invoices (for outstanding, payments, collection rate)
  const { data: invoices } = await supabase.from("invoices").select("total_amount, status").eq("user_id", userId);

  const outstanding =
    invoices?.filter((inv) => inv.status !== "paid").reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;

  const payments =
    invoices?.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;

  const totalInvoiced = invoices?.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0;

  const collectionRate = totalInvoiced > 0 ? ((totalInvoiced - outstanding) / totalInvoiced) * 100 : 0;

  // Customers count
  const { data: customers } = await supabase.from("customers").select("id").eq("user_id", userId);

  const customersCount = customers?.length || 0;

  // Invoices issued stats (count and total value)
  const invoicesCount = invoices?.length || 0;
  const invoicesTotal = totalInvoiced;

  return {
    outstanding,
    customers: customersCount,
    payments,
    collectionRate,
    invoicesCount,
    invoicesTotal,
  };
}

// --- Recent customers ---------------------------------------------------------
export async function getRecentCustomersWithOutstanding(userId: string) {
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, email")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

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

    return {
      ...customer,
      outstanding_amount: outstanding,
    };
  });
}

// --- Overdue invoices ---------------------------------------------------------
export async function getOverdueInvoices(userId: string) {
  const todayStr = new Date().toISOString().split("T")[0];

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_id, total_amount, due_date, status, last_sent_at, last_sent_channel")
    .eq("user_id", userId)
    .neq("status", "paid")
    .lt("due_date", todayStr)
    .order("due_date", { ascending: true })
    .limit(10);

  if (!invoices || invoices.length === 0) return [];

  const customerIds = [...new Set(invoices.map((inv) => inv.customer_id))];

  const { data: customers } = await supabase.from("customers").select("id, name").in("id", customerIds);

  const customerMap = new Map((customers || []).map((c) => [c.id, c.name]));

  // Get last reminder sent for each invoice
  const { data: reminderLogs } = await supabase
    .from("reminder_logs")
    .select("invoice_id, sent_at")
    .in("invoice_id", invoices.map((inv) => inv.id))
    .order("sent_at", { ascending: false });

  const lastReminderMap = new Map<string, string>();
  reminderLogs?.forEach((log) => {
    if (!lastReminderMap.has(log.invoice_id)) {
      lastReminderMap.set(log.invoice_id, log.sent_at || "");
    }
  });

  const today = new Date();

  return invoices.map((invoice) => {
    const dueDate = new Date(invoice.due_date);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      customer_name: customerMap.get(invoice.customer_id) || "Unknown",
      total_amount: Number(invoice.total_amount || 0),
      due_date: invoice.due_date,
      days_overdue: daysOverdue,
      last_sent_at: invoice.last_sent_at || null,
      last_sent_channel: invoice.last_sent_channel || null,
      last_reminded_at: lastReminderMap.get(invoice.id) || null,
    };
  });
}

// --- Pending reminders --------------------------------------------------------
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

// --- Today's snapshot ---------------------------------------------------------
export async function getTodaySnapshot(userId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  // Invoices created today
  const { data: invoicesToday } = await supabase
    .from("invoices")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", todayStr);

  // Payments received today
  const { data: paymentsToday } = await supabase
    .from("payments")
    .select("id, amount")
    .eq("user_id", userId)
    .gte("created_at", todayStr);

  const invoicesCreatedToday = invoicesToday?.length || 0;
  const paymentsReceivedToday = paymentsToday?.length || 0;
  const amountCollectedToday = paymentsToday?.reduce(
    (sum, p) => sum + Number(p.amount || 0),
    0
  ) || 0;

  return {
    invoicesCreatedToday,
    paymentsReceivedToday,
    amountCollectedToday,
  };
}

// --- Invoices needing sending -------------------------------------------------
export async function getInvoicesNeedingSending(userId: string) {
  // Get invoices that are draft OR issued but never sent
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_id, total_amount, status, last_sent_at")
    .eq("user_id", userId)
    .or("status.eq.draft,and(status.neq.draft,last_sent_at.is.null)")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!invoices || invoices.length === 0) return [];

  const customerIds = [...new Set(invoices.map((inv) => inv.customer_id).filter(Boolean))];

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, email")
    .in("id", customerIds);

  const customerMap = new Map((customers || []).map((c) => [c.id, { name: c.name, email: c.email }]));

  return invoices.map((invoice) => {
    const customer = customerMap.get(invoice.customer_id) || { name: "Unknown", email: null };
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
