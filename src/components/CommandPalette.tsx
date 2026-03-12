import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  FileText,
  Users,
  Plus,
  FileCheck,
  FileSpreadsheet,
  Package,
  BarChart3,
  Settings,
  Mail,
  Calendar,
  CreditCard,
  ArrowRight,
  Clock,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  id: string;
  type: "invoice" | "customer" | "quotation";
  label: string;
  sublabel?: string;
  href: string;
}

const NAVIGATION_ITEMS = [
  { label: "Dashboard", href: "/", icon: BarChart3, keywords: "home overview" },
  { label: "Invoices", href: "/invoices", icon: FileText, keywords: "bills receivables" },
  { label: "New Invoice", href: "/invoices/new", icon: Plus, keywords: "create invoice bill" },
  { label: "Quotations", href: "/quotations", icon: FileCheck, keywords: "quotes estimates proposals" },
  { label: "New Quotation", href: "/quotations/new", icon: Plus, keywords: "create quote estimate" },
  { label: "Credit Notes", href: "/credit-notes", icon: FileSpreadsheet, keywords: "refund credit" },
  { label: "Customers", href: "/customers", icon: Users, keywords: "clients contacts" },
  { label: "Services", href: "/services", icon: Package, keywords: "products items library" },
  { label: "Payments", href: "/payments", icon: CreditCard, keywords: "paid received" },
  { label: "Reports", href: "/reports", icon: BarChart3, keywords: "analytics aging" },
  { label: "Reminders", href: "/reminders", icon: Mail, keywords: "email notifications overdue" },
  { label: "Calendar", href: "/calendar", icon: Calendar, keywords: "due dates schedule" },
  { label: "Templates", href: "/invoice-templates", icon: FileText, keywords: "design layout" },
  { label: "Settings", href: "/settings", icon: Settings, keywords: "preferences company profile" },
];

const RECENT_KEY = "cmdpalette_recent";
const MAX_RECENT = 5;

function getRecent(): SearchResult[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecent(item: SearchResult) {
  const current = getRecent().filter((r) => r.href !== item.href);
  localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...current].slice(0, MAX_RECENT)));
}

function statusBadgeClass(status: string | null) {
  switch (status) {
    case "paid":
      return "text-emerald-600";
    case "overdue":
      return "text-red-500";
    case "issued":
      return "text-blue-500";
    case "draft":
      return "text-slate-400";
    default:
      return "text-muted-foreground";
  }
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recent, setRecent] = useState<SearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent items when palette opens
  useEffect(() => {
    if (open) {
      setRecent(getRecent());
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const runSearch = useCallback(
    async (q: string) => {
      if (!user || q.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      const term = `%${q.trim()}%`;

      const [invoiceRes, customerRes, quotationRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, total_amount, status, customers(name)")
          .eq("user_id", user.id)
          .or(`invoice_number.ilike.${term}`)
          .limit(4),

        supabase.from("customers").select("id, name, email").eq("user_id", user.id).ilike("name", term).limit(4),

        supabase
          .from("quotations")
          .select("id, quotation_number, status, customers(name)")
          .eq("user_id", user.id)
          .or(`quotation_number.ilike.${term}`)
          .limit(3),
      ]);

      const found: SearchResult[] = [];

      (customerRes.data || []).forEach((c: any) => {
        found.push({
          id: c.id,
          type: "customer",
          label: c.name,
          sublabel: c.email || "Customer",
          href: `/customers/${c.id}`,
        });
      });

      (invoiceRes.data || []).forEach((inv: any) => {
        found.push({
          id: inv.id,
          type: "invoice",
          label: inv.invoice_number || "Draft Invoice",
          sublabel: `${inv.customers?.name || "Unknown"} · ${formatCurrency(inv.total_amount ?? 0)} · ${inv.status ?? "draft"}`,
          href: `/invoices/${inv.id}`,
        });
      });

      (quotationRes.data || []).forEach((q: any) => {
        found.push({
          id: q.id,
          type: "quotation",
          label: q.quotation_number || "Draft Quotation",
          sublabel: `${q.customers?.name || "Unknown"} · ${q.status ?? "draft"}`,
          href: `/quotations/${q.id}/edit`,
        });
      });

      setResults(found);
      setSearching(false);
    },
    [user],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => runSearch(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const handleSelect = (href: string, item?: SearchResult) => {
    if (item) addRecent(item);
    onOpenChange(false);
    navigate(href);
  };

  const filteredNav = query.trim()
    ? NAVIGATION_ITEMS.filter((n) => `${n.label} ${n.keywords}`.toLowerCase().includes(query.toLowerCase()))
    : [];

  const showRecent = !query.trim() && recent.length > 0;
  const showNav = filteredNav.length > 0;
  const showResults = results.length > 0;
  const showEmpty = query.trim().length >= 2 && !searching && !showResults && !showNav;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* Header hint */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Search className="h-3 w-3" />
          <span>Search invoices, customers, pages…</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          esc
        </kbd>
      </div>

      <CommandInput
        placeholder="Type a name, invoice number, or page…"
        value={query}
        onValueChange={setQuery}
        className="text-base"
      />

      <CommandList className="max-h-[420px]">
        {/* Searching indicator */}
        {searching && (
          <div className="py-3 px-4 text-xs text-muted-foreground flex items-center gap-2">
            <span className="animate-pulse">●</span> Searching…
          </div>
        )}

        {/* Recent items (empty query) */}
        {showRecent && (
          <CommandGroup heading="Recent">
            {recent.map((item) => (
              <CommandItem
                key={item.href}
                value={`recent-${item.href}`}
                onSelect={() => handleSelect(item.href, item)}
                className="flex items-center gap-3 py-2.5"
              >
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-sm truncate">{item.label}</span>
                  {item.sublabel && <span className="text-xs text-muted-foreground truncate">{item.sublabel}</span>}
                </div>
                <ArrowRight className="h-3 w-3 ml-auto shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick nav actions (empty query) */}
        {!query.trim() && (
          <>
            {showRecent && <CommandSeparator />}
            <CommandGroup heading="Quick Actions">
              {[
                { label: "New Invoice", href: "/invoices/new", icon: Plus },
                { label: "New Quotation", href: "/quotations/new", icon: Plus },
                { label: "View Customers", href: "/customers", icon: Users },
                { label: "View Reports", href: "/reports", icon: BarChart3 },
              ].map((action) => (
                <CommandItem
                  key={action.href}
                  value={`action-${action.label}`}
                  onSelect={() => handleSelect(action.href)}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <action.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm">{action.label}</span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Live DB results */}
        {showResults && (
          <>
            {/* Customers */}
            {results.filter((r) => r.type === "customer").length > 0 && (
              <CommandGroup heading="Customers">
                {results
                  .filter((r) => r.type === "customer")
                  .map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`customer-${r.id}-${r.label}`}
                      onSelect={() => handleSelect(r.href, r)}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0 text-blue-700 dark:text-blue-300 text-xs font-bold">
                        {r.label.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-sm truncate">{r.label}</span>
                        {r.sublabel && <span className="text-xs text-muted-foreground truncate">{r.sublabel}</span>}
                      </div>
                      <ArrowRight className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}

            {/* Invoices */}
            {results.filter((r) => r.type === "invoice").length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Invoices">
                  {results
                    .filter((r) => r.type === "invoice")
                    .map((r) => {
                      const parts = r.sublabel?.split(" · ") || [];
                      const status = parts[2] || "";
                      return (
                        <CommandItem
                          key={r.id}
                          value={`invoice-${r.id}-${r.label}`}
                          onSelect={() => handleSelect(r.href, r)}
                          className="flex items-center gap-3 py-2.5"
                        >
                          <div className="h-7 w-7 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-slate-500" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-sm truncate">{r.label}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {parts[0]} · {parts[1]} <span className={statusBadgeClass(status)}>· {status}</span>
                            </span>
                          </div>
                          <ArrowRight className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
              </>
            )}

            {/* Quotations */}
            {results.filter((r) => r.type === "quotation").length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Quotations">
                  {results
                    .filter((r) => r.type === "quotation")
                    .map((r) => (
                      <CommandItem
                        key={r.id}
                        value={`quotation-${r.id}-${r.label}`}
                        onSelect={() => handleSelect(r.href, r)}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <div className="h-7 w-7 rounded-md bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
                          <FileCheck className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm truncate">{r.label}</span>
                          {r.sublabel && <span className="text-xs text-muted-foreground truncate">{r.sublabel}</span>}
                        </div>
                        <ArrowRight className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
                      </CommandItem>
                    ))}
                </CommandGroup>
              </>
            )}
          </>
        )}

        {/* Filtered navigation pages */}
        {showNav && (
          <>
            {showResults && <CommandSeparator />}
            <CommandGroup heading="Pages">
              {filteredNav.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`nav-${item.label}-${item.keywords}`}
                  onSelect={() => handleSelect(item.href)}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="font-medium text-sm">{item.label}</span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Empty state */}
        {showEmpty && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-4">
              <Search className="h-8 w-8 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">
                No results for <strong>"{query}"</strong>
              </p>
              <p className="text-xs text-muted-foreground">Try an invoice number, customer name, or page</p>
            </div>
          </CommandEmpty>
        )}
      </CommandList>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground bg-muted/30">
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
          navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">↵</kbd>
          open
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">esc</kbd>
          close
        </span>
        <span className="ml-auto flex items-center gap-1">
          <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">⌘K</kbd>
          toggle
        </span>
      </div>
    </CommandDialog>
  );
}
