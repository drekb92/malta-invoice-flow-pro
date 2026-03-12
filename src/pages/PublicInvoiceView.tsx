import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, differenceInDays } from "date-fns";
import { formatNumber } from "@/lib/utils";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Building2,
  User,
  CreditCard,
  FileText,
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────

interface PublicInvoiceData {
  invoice: {
    id: string;
    invoice_number: string;
    invoice_date: string | null;
    due_date: string;
    status: string | null;
    amount: number | null;
    vat_amount: number | null;
    total_amount: number | null;
    vat_rate: number | null;
    discount_type: string | null;
    discount_value: number | null;
    is_issued: boolean | null;
  };
  customer: {
    name: string;
    email: string | null;
    address: string | null;
    address_line1: string | null;
    address_line2: string | null;
    locality: string | null;
    post_code: string | null;
    vat_number: string | null;
  } | null;
  items: Array<{
    description: string;
    quantity: number;
    unit: string | null;
    unit_price: number;
    vat_rate: number;
  }>;
  totals: {
    net_amount: number;
    vat_amount: number;
    total_amount: number;
  } | null;
  company: {
    company_name: string | null;
    company_email: string | null;
    company_phone: string | null;
    company_address: string | null;
    company_locality: string | null;
    company_post_code: string | null;
    company_country: string | null;
    company_vat_number: string | null;
    company_registration_number: string | null;
    company_logo: string | null;
    company_website: string | null;
  } | null;
  banking: {
    bank_name: string | null;
    bank_account_name: string | null;
    bank_iban: string | null;
    bank_swift_code: string | null;
    include_on_invoices: boolean;
  } | null;
  payments: Array<{ amount: number; payment_date: string; method: string | null }>;
  shareLink: { expires_at: string };
}

// ── Status helpers ─────────────────────────────────────────────────────────

function deriveStatus(invoice: PublicInvoiceData["invoice"], totalPaid: number) {
  const total = invoice.total_amount ?? 0;
  if (totalPaid >= total - 0.01) return "paid";
  if (!invoice.is_issued) return "draft";
  if (invoice.due_date && isPast(new Date(invoice.due_date))) return "overdue";
  return "issued";
}

const STATUS_CONFIG = {
  paid: {
    label: "Paid",
    icon: CheckCircle,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconClass: "text-emerald-500",
    barClass: "bg-emerald-500",
  },
  overdue: {
    label: "Overdue",
    icon: AlertTriangle,
    className: "bg-red-50 text-red-700 border-red-200",
    iconClass: "text-red-500",
    barClass: "bg-red-500",
  },
  issued: {
    label: "Awaiting Payment",
    icon: Clock,
    className: "bg-blue-50 text-blue-700 border-blue-200",
    iconClass: "text-blue-500",
    barClass: "bg-blue-500",
  },
  draft: {
    label: "Draft",
    icon: FileText,
    className: "bg-slate-50 text-slate-600 border-slate-200",
    iconClass: "text-slate-400",
    barClass: "bg-slate-400",
  },
};

// ── Component ──────────────────────────────────────────────────────────────

export default function PublicInvoiceView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedIban, setCopiedIban] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchInvoice(token);
  }, [token]);

  async function fetchInvoice(tok: string) {
    setLoading(true);
    setError(null);

    try {
      // 1. Validate token — uses the public RLS policy (anon can read active links)
      const { data: linkData, error: linkErr } = await supabase
        .from("invoice_share_links")
        .select("invoice_id, user_id, expires_at")
        .eq("token", tok)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (linkErr || !linkData) {
        setError("This link is invalid, has expired, or has been revoked.");
        setLoading(false);
        return;
      }

      const { invoice_id, user_id } = linkData;

      // 2. Fetch all invoice data in parallel
      const [invoiceRes, itemsRes, totalsRes, companyRes, bankingRes, paymentsRes] = await Promise.all([
        supabase
          .from("invoices")
          .select(
            "id, invoice_number, invoice_date, due_date, status, amount, vat_amount, total_amount, vat_rate, discount_type, discount_value, is_issued, customer_id",
          )
          .eq("id", invoice_id)
          .eq("user_id", user_id)
          .single(),

        supabase
          .from("invoice_items")
          .select("description, quantity, unit, unit_price, vat_rate")
          .eq("invoice_id", invoice_id)
          .order("created_at", { ascending: true }),

        supabase
          .from("invoice_totals")
          .select("net_amount, vat_amount, total_amount")
          .eq("invoice_id", invoice_id)
          .maybeSingle(),

        supabase
          .from("company_settings")
          .select(
            "company_name, company_email, company_phone, company_address, company_locality, company_post_code, company_country, company_vat_number, company_registration_number, company_logo, company_website",
          )
          .eq("user_id", user_id)
          .maybeSingle(),

        supabase
          .from("banking_details")
          .select("bank_name, bank_account_name, bank_iban, bank_swift_code, include_on_invoices")
          .eq("user_id", user_id)
          .maybeSingle(),

        supabase
          .from("payments")
          .select("amount, payment_date, method")
          .eq("invoice_id", invoice_id)
          .eq("user_id", user_id)
          .order("payment_date", { ascending: false }),
      ]);

      if (invoiceRes.error || !invoiceRes.data) {
        setError("Invoice data could not be loaded.");
        setLoading(false);
        return;
      }

      // Fetch customer separately (need customer_id from invoice)
      const customerId = (invoiceRes.data as any).customer_id;
      let customerData = null;
      if (customerId) {
        const { data: cust } = await supabase
          .from("customers")
          .select("name, email, address, address_line1, address_line2, locality, post_code, vat_number")
          .eq("id", customerId)
          .maybeSingle();
        customerData = cust;
      }

      setData({
        invoice: invoiceRes.data as PublicInvoiceData["invoice"],
        customer: customerData,
        items: (itemsRes.data || []) as PublicInvoiceData["items"],
        totals: totalsRes.data as PublicInvoiceData["totals"] | null,
        company: companyRes.data as PublicInvoiceData["company"] | null,
        banking: bankingRes.data?.include_on_invoices ? (bankingRes.data as PublicInvoiceData["banking"]) : null,
        payments: (paymentsRes.data || []) as PublicInvoiceData["payments"],
        shareLink: { expires_at: linkData.expires_at },
      });
    } catch (e: any) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
          <p className="text-sm text-slate-500">Loading invoice…</p>
        </div>
      </div>
    );
  }

  // ── Error / Invalid ──────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800">Link Not Available</h1>
          <p className="text-sm text-slate-500 leading-relaxed">{error || "This invoice link is no longer active."}</p>
          <p className="text-xs text-slate-400">Please contact the sender to request a new link.</p>
        </div>
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const { invoice, customer, items, totals, company, banking, payments } = data;

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const status = deriveStatus(invoice, totalPaid);
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.issued;
  const StatusIcon = statusCfg.icon;

  const net = totals?.net_amount ?? invoice.amount ?? 0;
  const vat = totals?.vat_amount ?? invoice.vat_amount ?? 0;
  const grand = totals?.total_amount ?? invoice.total_amount ?? 0;
  const remaining = Math.max(0, grand - totalPaid);

  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
  const daysUntilDue = dueDate ? differenceInDays(dueDate, new Date()) : null;

  const formatAddr = (c: PublicInvoiceData["customer"]) => {
    if (!c) return null;
    const parts = [c.address_line1 || c.address, c.address_line2, c.locality, c.post_code].filter(Boolean);
    return parts.join(", ");
  };

  const companyAddr = company
    ? [company.company_address, company.company_locality, company.company_post_code, company.company_country]
        .filter(Boolean)
        .join(", ")
    : null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Status Banner ─────────────────────────────────────────────── */}
      <div className={`w-full border-b ${statusCfg.barClass}`} style={{ height: 4 }} />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Top row: company logo/name + status */}
          <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {company?.company_logo ? (
                <img
                  src={company.company_logo}
                  alt={company.company_name || "Logo"}
                  className="h-10 w-auto max-w-[120px] object-contain"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-slate-400" />
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-800">{company?.company_name || "Invoice"}</p>
                {company?.company_email && <p className="text-xs text-slate-400">{company.company_email}</p>}
              </div>
            </div>
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusCfg.className}`}
            >
              <StatusIcon className={`h-3.5 w-3.5 ${statusCfg.iconClass}`} />
              {statusCfg.label}
            </div>
          </div>

          {/* Invoice meta strip */}
          <div className="px-6 pb-5 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{invoice.invoice_number}</p>
                {invoice.invoice_date && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Issued {format(new Date(invoice.invoice_date), "d MMMM yyyy")}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-slate-900">€{formatNumber(grand, 2)}</p>
                {dueDate && status !== "paid" && (
                  <p
                    className={`text-xs mt-0.5 ${
                      status === "overdue"
                        ? "text-red-500 font-medium"
                        : daysUntilDue !== null && daysUntilDue <= 7
                          ? "text-amber-500 font-medium"
                          : "text-slate-400"
                    }`}
                  >
                    {status === "overdue"
                      ? `Overdue by ${Math.abs(daysUntilDue!)} days`
                      : `Due ${format(dueDate, "d MMMM yyyy")}`}
                  </p>
                )}
                {status === "paid" && (
                  <p className="text-xs text-emerald-500 font-medium mt-0.5">Fully settled — thank you!</p>
                )}
              </div>
            </div>

            {/* Partial payment progress bar */}
            {status !== "paid" && totalPaid > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>€{formatNumber(totalPaid, 2)} paid</span>
                  <span>€{formatNumber(remaining, 2)} remaining</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${Math.min(100, (totalPaid / grand) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── From / To ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* From */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">From</p>
            </div>
            <p className="font-semibold text-slate-800">{company?.company_name || "—"}</p>
            {companyAddr && <p className="text-sm text-slate-500 mt-1">{companyAddr}</p>}
            {company?.company_vat_number && (
              <p className="text-xs text-slate-400 mt-1">VAT: {company.company_vat_number}</p>
            )}
            {company?.company_registration_number && (
              <p className="text-xs text-slate-400">Reg: {company.company_registration_number}</p>
            )}
            {company?.company_website && (
              <a
                href={company.company_website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1"
              >
                {company.company_website.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>

          {/* To */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bill To</p>
            </div>
            {customer ? (
              <>
                <p className="font-semibold text-slate-800">{customer.name}</p>
                {formatAddr(customer) && <p className="text-sm text-slate-500 mt-1">{formatAddr(customer)}</p>}
                {customer.email && <p className="text-xs text-slate-400 mt-1">{customer.email}</p>}
                {customer.vat_number && <p className="text-xs text-slate-400">VAT: {customer.vat_number}</p>}
              </>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
          </div>
        </div>

        {/* ── Line Items ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice Items</p>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit Price</div>
            <div className="col-span-1 text-right">VAT</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>

          {/* Items */}
          {items.map((item, i) => {
            const lineNet = item.quantity * item.unit_price;
            return (
              <div
                key={i}
                className={`grid grid-cols-12 gap-2 px-5 py-3.5 text-sm items-start ${
                  i < items.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <div className="col-span-5">
                  <p className="font-medium text-slate-800 leading-snug">{item.description}</p>
                  {item.unit && <p className="text-xs text-slate-400 mt-0.5">per {item.unit}</p>}
                </div>
                <div className="col-span-2 text-right text-slate-600">{item.quantity}</div>
                <div className="col-span-2 text-right text-slate-600">€{formatNumber(item.unit_price, 2)}</div>
                <div className="col-span-1 text-right text-slate-400 text-xs">{item.vat_rate}%</div>
                <div className="col-span-2 text-right font-medium text-slate-800">€{formatNumber(lineNet, 2)}</div>
              </div>
            );
          })}

          {/* Totals */}
          <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-4 space-y-1.5">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>€{formatNumber(net, 2)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>VAT ({invoice.vat_rate ?? 18}%)</span>
              <span>€{formatNumber(vat, 2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 pt-1.5 border-t border-slate-200 mt-1.5">
              <span>Total</span>
              <span>€{formatNumber(grand, 2)}</span>
            </div>
            {totalPaid > 0 && (
              <>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Amount Paid</span>
                  <span>−€{formatNumber(totalPaid, 2)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-slate-800 border-t border-slate-200 pt-1.5">
                  <span>Balance Due</span>
                  <span>€{formatNumber(remaining, 2)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Pay Now + Banking ─────────────────────────────────────── */}
        {status !== "paid" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-400" />
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment Details</p>
            </div>

            <div className="px-5 py-5 space-y-5">
              {/* Pay Now button — placeholder */}
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700">Pay €{formatNumber(remaining, 2)} online</p>
                <p className="text-xs text-slate-400">Online payments coming soon — please use bank transfer below</p>
                <button
                  disabled
                  className="mt-1 inline-flex items-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white opacity-40 cursor-not-allowed"
                >
                  <CreditCard className="h-4 w-4" />
                  Pay Now
                </button>
              </div>

              {/* Banking details */}
              {banking && (banking.bank_iban || banking.bank_name) ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bank Transfer</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {banking.bank_name && (
                      <div>
                        <p className="text-[11px] text-slate-400 uppercase tracking-wide">Bank</p>
                        <p className="text-sm font-medium text-slate-800">{banking.bank_name}</p>
                      </div>
                    )}
                    {banking.bank_account_name && (
                      <div>
                        <p className="text-[11px] text-slate-400 uppercase tracking-wide">Account Name</p>
                        <p className="text-sm font-medium text-slate-800">{banking.bank_account_name}</p>
                      </div>
                    )}
                    {banking.bank_iban && (
                      <div className="sm:col-span-2">
                        <p className="text-[11px] text-slate-400 uppercase tracking-wide">IBAN</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-sm font-mono font-semibold text-slate-800 tracking-wider">
                            {banking.bank_iban}
                          </p>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(banking.bank_iban!);
                              setCopiedIban(true);
                              setTimeout(() => setCopiedIban(false), 2000);
                            }}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            title="Copy IBAN"
                          >
                            {copiedIban ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    {banking.bank_swift_code && (
                      <div>
                        <p className="text-[11px] text-slate-400 uppercase tracking-wide">SWIFT / BIC</p>
                        <p className="text-sm font-mono font-semibold text-slate-800">{banking.bank_swift_code}</p>
                      </div>
                    )}
                  </div>
                  {/* Reference reminder */}
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Please use <span className="font-semibold">{invoice.invoice_number}</span> as the payment
                      reference so your payment is matched correctly.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Please contact us for payment instructions.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Payment History (if any) ────────────────────────────── */}
        {payments.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payment History</p>
            </div>
            <div className="divide-y divide-slate-100">
              {payments.map((p, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      {p.method ? p.method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Payment"}
                    </p>
                    <p className="text-xs text-slate-400">{format(new Date(p.payment_date), "d MMMM yyyy")}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-600">€{formatNumber(Number(p.amount), 2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Trust footer ────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-1.5 py-4 text-center">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-slate-300" />
            <span>Secure link · expires {format(new Date(data.shareLink.expires_at), "d MMM yyyy")}</span>
          </div>
          <p className="text-[11px] text-slate-300">Powered by InvoicePro Malta</p>
        </div>
      </div>
    </div>
  );
}
