// src/lib/dashboard.ts
import { supabase } from "@/integrations/supabase/client";

// --- Setup status -------------------------------------------------------------

export async function getSetupStatus(userId: string) {
  const [{ data: company }, { data: banking }, { data: customers }, { data: invoices }] =
    await Promise.all([
      supabase.from("company_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("banking_details").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("customers").select("id").eq("user_id", userId),
      supabase.from("invoices").select("id").eq("user_id", userId)
    ]);

  return {
    companyCompleted: !!company,
    bankingCompleted: !!banking,
    customersCompleted: (customers?.length ?? 0) > 0,
    invoicesCompleted: (invoices?.length ?? 0) > 0,
  };
}

// --- Metrics ------------------------------------------------------------------

export async function getDashboardMetrics(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: unpaid },
    { data: payments },
    { data: creditNotes }
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("total_amount, vat_amount, due_date, status")
      .eq("user_id", userId)
      .neq("status", "paid"),

    supabase
      .from("payments")
      .select("amount")
      .eq("user_id", userId),

    supabase
      .from("credit_notes")
      .select("total, vat")
      .eq("user_id", userId)
  ]);

  const outstanding = unpaid?.reduce((sum, inv) => sum + (inv.total_amount ?? 0) + (inv.vat_amount ?? 0), 0) ?? 0;
  const collected = payments?.reduce((sum, p) => sum + (p.amount ?? 0), 0) ?? 0;
  const creditNoteTotal = creditNotes?.reduce((sum, cn) => sum + (cn.total ?? 0) + (cn.vat ?? 0), 0) ?? 0;

  return {
    outstanding,
    collected,
    creditNoteTotal,
  };
}

// --- Recent customers ----------------------------------------------------------

export async function getRecentCustomersWithOutstanding(userId: string) {
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!customers) return [];

  const ids = customers.map(c => c.id);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("customer_id, total_amount, vat_amount, status")
    .in("customer_id", ids);

  const map = new Map();

  customers.forEach(c => map.set(c.id, { ...c, outstanding: 0 }));

  invoices?.forEach(inv => {
    if (inv.status !== "paid") {
      const total = (inv.total_amount ?? 0) + (inv.vat_amount ?? 0);
      map.get(inv.customer_id).outstanding += total;
    }
  });

  return Array.from(map.values());
}

// --- Overdue invoices ----------------------------------------------------------

export async function getOverdueInvoices(userId: string) {
  const today = new Date().toISOString().split("T")[0];

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_id, due_date, total_amount, vat_amount")
    .eq("user_id", userId)
    .neq("status", "paid")
    .lt("due_date", today);

  const customerIds = Array.from(new Set(invoices?.map(i => i.customer_id) ?? []));

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .in("id", customerIds);

  const customerMap = new Map(customers?.map(c => [c.id, c.name]) ?? []);

  return invoices?.map(inv => {
    const days =
      Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));

    return {
      ...inv,
      customer_name: customerMap.get(inv.customer_id) ?? "Unknown",
      daysOverdue: days,
    };
  }) ?? [];
}
