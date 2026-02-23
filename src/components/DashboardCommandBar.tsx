import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, ChevronDown, FileText, Users, Plus, Search, CreditCard, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

interface SearchResult {
  id: string;
  type: "invoice" | "quotation" | "customer";
  title: string;
  subtitle: string;
}

interface DashboardCommandBarProps {
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  customerId: string;
  onCustomerIdChange: (value: string) => void;
  customers: { id: string; name: string }[];
}

// ---------------------------------------------------------------------------
// NewButton — exported so the dashboard header can render it independently
// ---------------------------------------------------------------------------
export function NewButton() {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => navigate("/invoices/new")}>
          <FileText className="h-4 w-4 mr-2" />
          New Invoice
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/quotations/new")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          New Quotation
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/credit-notes")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          New Credit Note
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/invoices?action=record-payment")}>
          <CreditCard className="h-4 w-4 mr-2" />
          Record Payment
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// DashboardCommandBar
// ---------------------------------------------------------------------------
export function DashboardCommandBar({
  dateRange,
  onDateRangeChange,
  customerId,
  onCustomerIdChange,
  customers,
}: DashboardCommandBarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || !user?.id) {
      setSearchResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const query = searchQuery.toLowerCase();

        const { data: invoices } = await supabase
          .from("invoices")
          .select("id, invoice_number, total_amount, customers(name)")
          .eq("user_id", user.id)
          .or(`invoice_number.ilike.%${query}%`)
          .limit(5);

        const { data: quotations } = await supabase
          .from("quotations")
          .select("id, quotation_number, total_amount, customers(name)")
          .eq("user_id", user.id)
          .or(`quotation_number.ilike.%${query}%`)
          .limit(5);

        const { data: customersData } = await supabase
          .from("customers")
          .select("id, name, email")
          .eq("user_id", user.id)
          .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(5);

        const results: SearchResult[] = [];

        invoices?.forEach((inv: any) => {
          results.push({
            id: inv.id,
            type: "invoice",
            title: inv.invoice_number || "Draft Invoice",
            subtitle: inv.customers?.name || "No customer",
          });
        });

        quotations?.forEach((quot: any) => {
          results.push({
            id: quot.id,
            type: "quotation",
            title: quot.quotation_number || "Draft Quotation",
            subtitle: quot.customers?.name || "No customer",
          });
        });

        customersData?.forEach((cust) => {
          results.push({
            id: cust.id,
            type: "customer",
            title: cust.name,
            subtitle: cust.email || "No email",
          });
        });

        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, user?.id]);

  const handleSearchSelect = (result: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery("");
    switch (result.type) {
      case "invoice":
        navigate(`/invoices/${result.id}`);
        break;
      case "quotation":
        navigate(`/quotations/${result.id}/edit`);
        break;
      case "customer":
        navigate(`/customers/${result.id}`);
        break;
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case "invoice":
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case "quotation":
        return <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />;
      case "customer":
        return <Users className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  // ── Mobile layout ───────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <div className="space-y-3 mb-6">
          {/* Search */}
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices, quotes, customers…"
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value) setSearchOpen(true);
                  }}
                  onFocus={() => searchQuery && setSearchOpen(true)}
                />
              </div>
            </PopoverTrigger>
            {searchResults.length > 0 && (
              <PopoverContent className="w-[calc(100vw-2rem)] p-0" align="start">
                <Command>
                  <CommandList>
                    <CommandGroup heading="Results">
                      {searchResults.map((result) => (
                        <CommandItem
                          key={`${result.type}-${result.id}`}
                          onSelect={() => handleSearchSelect(result)}
                          className="cursor-pointer"
                        >
                          {getResultIcon(result.type)}
                          <div className="ml-2">
                            <div className="font-medium">{result.title}</div>
                            <div className="text-xs text-muted-foreground">{result.subtitle}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            )}
          </Popover>

          {/* Filters row */}
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={onDateRangeChange}>
              <SelectTrigger className="flex-1">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7-days">Last 7 days</SelectItem>
                <SelectItem value="30-days">Last 30 days</SelectItem>
                <SelectItem value="90-days">Last 90 days</SelectItem>
                <SelectItem value="year">This year</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            <Select value={customerId} onValueChange={onCustomerIdChange}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* FAB for mobile — NewButton lives in the header on desktop */}
        <div className="fixed bottom-6 right-6 z-50 md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg" className="h-14 w-14 rounded-full shadow-lg">
                <Plus className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 mb-2">
              <DropdownMenuItem onClick={() => navigate("/invoices/new")}>
                <FileText className="h-4 w-4 mr-2" />
                New Invoice
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/quotations/new")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                New Quotation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/credit-notes")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                New Credit Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/invoices?action=record-payment")}>
                <CreditCard className="h-4 w-4 mr-2" />
                Record Payment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </>
    );
  }

  // ── Desktop layout — NewButton is in the header, not here ──────────────────
  return (
    <div className="flex items-center gap-4 mb-6">
      {/* Search */}
      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
        <PopoverTrigger asChild>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices, quotes, customers…"
              className="pl-10"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value) setSearchOpen(true);
              }}
              onFocus={() => searchQuery && setSearchOpen(true)}
            />
          </div>
        </PopoverTrigger>
        {searchResults.length > 0 && (
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandList>
                <CommandGroup heading="Results">
                  {searchResults.map((result) => (
                    <CommandItem
                      key={`${result.type}-${result.id}`}
                      onSelect={() => handleSearchSelect(result)}
                      className="cursor-pointer"
                    >
                      {getResultIcon(result.type)}
                      <div className="ml-2">
                        <div className="font-medium">{result.title}</div>
                        <div className="text-xs text-muted-foreground">{result.subtitle}</div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        )}
      </Popover>

      {/* Date Range Filter */}
      <Select value={dateRange} onValueChange={onDateRangeChange}>
        <SelectTrigger className="w-40">
          <Calendar className="h-4 w-4 mr-2" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7-days">Last 7 days</SelectItem>
          <SelectItem value="30-days">Last 30 days</SelectItem>
          <SelectItem value="90-days">Last 90 days</SelectItem>
          <SelectItem value="year">This year</SelectItem>
          <SelectItem value="all">All time</SelectItem>
        </SelectContent>
      </Select>

      {/* Customer Filter */}
      <Select value={customerId} onValueChange={onCustomerIdChange}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All customers</SelectItem>
          {customers.map((customer) => (
            <SelectItem key={customer.id} value={customer.id}>
              {customer.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
