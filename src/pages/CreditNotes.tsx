import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  FileText,
  Shield,
  AlertCircle,
  MessageCircle,
  Mail,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  Plus,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CreditNote as CreditNoteType } from "@/types/invoice-compliance";
import { TransactionDrawer } from "@/components/TransactionDrawer";
import { CreateCreditNoteDrawer } from "@/components/CreateCreditNoteDrawer";
import { UnifiedInvoiceLayout, InvoiceData } from "@/components/UnifiedInvoiceLayout";
import { SendWhatsAppDialog } from "@/components/SendWhatsAppDialog";
import { SendDocumentEmailDialog } from "@/components/SendDocumentEmailDialog";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { useInvoiceSettings } from "@/hooks/useInvoiceSettings";
import { downloadPdfFromFunction } from "@/lib/edgePdf";

interface CreditNoteWithRelations extends CreditNoteType {
  customers?: {
    name: string;
    email?: string;
    address?: string;
    vat_number?: string;
    phone?: string;
  };
  invoices?: {
    invoice_number: string;
  };
}

const CreditNotes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creditNotes, setCreditNotes] = useState<CreditNoteWithRelations[]>([]);
  const [filteredCreditNotes, setFilteredCreditNotes] = useState<CreditNoteWithRelations[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNoteWithRelations | null>(null);

  // Selection mode & sorting
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<"credit_note_date" | "amount" | "status" | "customer" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [bulkLoading, setBulkLoading] = useState(false);

  // Standalone credit note drawer
  const [standaloneDrawerOpen, setStandaloneDrawerOpen] = useState(false);

  // PDF download state
  const [pdfCreditNoteData, setPdfCreditNoteData] = useState<InvoiceData | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // WhatsApp state
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappCreditNote, setWhatsappCreditNote] = useState<CreditNoteWithRelations | null>(null);
  const [whatsappCreditNoteData, setWhatsappCreditNoteData] = useState<InvoiceData | null>(null);

  // Email state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailCreditNote, setEmailCreditNote] = useState<CreditNoteWithRelations | null>(null);

  const { toast } = useToast();

  // Hooks for PDF / template
  const { template } = useInvoiceTemplate();
  const { settings: companySettings } = useCompanySettings();
  const { settings: bankingSettings } = useBankingSettings();
  const { settings: invoiceSettings } = useInvoiceSettings();

  // ── Shared template settings builder ──────────────────────────────────────
  const buildTemplateSettings = () =>
    template
      ? {
          primaryColor: template.primary_color,
          fontFamily: template.font_family,
          fontSize: template.font_size,
          layout: template.layout as any,
          headerLayout: template.header_layout as any,
          tableStyle: template.table_style as any,
          totalsStyle: template.totals_style as any,
          bankingVisibility: template.banking_visibility,
          bankingStyle: template.banking_style as any,
          marginTop: template.margin_top,
          marginRight: template.margin_right,
          marginBottom: template.margin_bottom,
          marginLeft: template.margin_left,
          style: (template.style as any) || "modern",
        }
      : undefined;

  const buildCompanySettings = () =>
    companySettings
      ? {
          name: companySettings.company_name,
          email: companySettings.company_email,
          phone: companySettings.company_phone,
          address: companySettings.company_address,
          addressLine1: companySettings.company_address_line1 || undefined,
          addressLine2: companySettings.company_address_line2 || undefined,
          locality: companySettings.company_locality || undefined,
          postCode: companySettings.company_post_code || undefined,
          city: companySettings.company_city,
          state: companySettings.company_state,
          zipCode: companySettings.company_zip_code,
          country: companySettings.company_country,
          taxId: companySettings.company_vat_number,
          registrationNumber: companySettings.company_registration_number,
          logo: companySettings.company_logo,
        }
      : undefined;

  const buildBankingSettings = () =>
    bankingSettings
      ? {
          bankName: bankingSettings.bank_name,
          accountName: bankingSettings.bank_account_name,
          swiftCode: bankingSettings.bank_swift_code,
          iban: bankingSettings.bank_iban,
        }
      : undefined;

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchCreditNotes = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("credit_notes")
        .select(
          `
          *,
          customers (
            name,
            email,
            phone
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const creditNotesWithInvoices = await Promise.all(
        (data || []).map(async (cn: any) => {
          if (cn.invoice_id) {
            const { data: invoiceData } = await supabase
              .from("invoices")
              .select("invoice_number")
              .eq("id", cn.invoice_id)
              .maybeSingle();
            return { ...cn, invoices: invoiceData || undefined } as CreditNoteWithRelations;
          }
          return cn as CreditNoteWithRelations;
        }),
      );

      setCreditNotes(creditNotesWithInvoices);
      setFilteredCreditNotes(creditNotesWithInvoices);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load credit notes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditNotes();
  }, []);

  useEffect(() => {
    let filtered = creditNotes;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (cn) =>
          cn.credit_note_number.toLowerCase().includes(term) ||
          cn.customers?.name.toLowerCase().includes(term) ||
          cn.invoices?.invoice_number?.toLowerCase().includes(term) ||
          cn.amount?.toString().includes(term),
      );
    }
    if (statusFilter !== "all") filtered = filtered.filter((cn) => cn.status === statusFilter);
    if (typeFilter !== "all") filtered = filtered.filter((cn) => cn.type === typeFilter);
    setFilteredCreditNotes(filtered);
  }, [searchTerm, statusFilter, typeFilter, creditNotes]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "invoice_adjustment":
        return "Invoice Adjustment";
      case "customer_credit":
        return "Customer Credit";
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return { className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", label: "Draft" };
      case "issued":
        return { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Issued" };
      case "applied":
        return { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Applied" };
      default:
        return { className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", label: status };
    }
  };

  const calculateTotal = (amount: number, vatRate: number) => amount + amount * vatRate;

  const sortedCreditNotes = useMemo(() => {
    if (!sortField) return filteredCreditNotes;
    return [...filteredCreditNotes].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      if (sortField === "credit_note_date") { aVal = a.credit_note_date || (a as any).created_at || ""; bVal = b.credit_note_date || (b as any).created_at || ""; }
      else if (sortField === "amount") { aVal = calculateTotal(a.amount, a.vat_rate); bVal = calculateTotal(b.amount, b.vat_rate); }
      else if (sortField === "status") { aVal = a.status; bVal = b.status; }
      else { aVal = a.customers?.name || ""; bVal = b.customers?.name || ""; }
      if (typeof aVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filteredCreditNotes, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const allSelected = sortedCreditNotes.length > 0 && sortedCreditNotes.every((cn) => selectedIds.has(cn.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(sortedCreditNotes.map((cn) => cn.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDownloadPDFs = async () => {
    const toDownload = sortedCreditNotes.filter((cn) => selectedIds.has(cn.id));
    for (const cn of toDownload) {
      await handleDownloadPDF(cn.id);
      await new Promise((r) => setTimeout(r, 600));
    }
    setSelectedIds(new Set());
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSelectionMode) {
        setIsSelectionMode(false);
        setSelectedIds(new Set());
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSelectionMode]);

  // ── Build InvoiceData from a credit note (shared by PDF + WhatsApp) ────────
  const buildCreditNoteInvoiceData = async (creditNoteId: string): Promise<InvoiceData> => {
    const { data: cn, error: cnError } = await (supabase as any)
      .from("credit_notes")
      .select(`*, customers(name, email, address, vat_number, phone)`)
      .eq("id", creditNoteId)
      .maybeSingle();

    if (cnError || !cn) throw new Error(cnError?.message || "Credit note not found");

    const { data: itemsData, error: itemsError } = await supabase
      .from("credit_note_items")
      .select("*")
      .eq("credit_note_id", creditNoteId);

    if (itemsError) throw new Error(itemsError.message);

    const items = (itemsData || []).map((item: any) => ({
      description: item.description,
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      vat_rate: Number(item.vat_rate ?? cn.vat_rate ?? 0.18),
      unit: item.unit || "unit",
    }));

    // Fallback single item if no line items exist
    if (items.length === 0) {
      const net = Number(cn.amount || 0);
      items.push({
        description: cn.reason || "Credit Note",
        quantity: 1,
        unit_price: net,
        vat_rate: Number(cn.vat_rate ?? 0.18),
        unit: "unit",
      });
    }

    const net = Number(cn.amount || 0);
    const vatRate = Number(cn.vat_rate ?? 0.18);
    const vat = net * vatRate;

    return {
      invoiceNumber: cn.credit_note_number,
      invoiceDate: cn.credit_note_date,
      dueDate: cn.credit_note_date,
      customer: {
        name: cn.customers?.name || "Unknown Customer",
        email: cn.customers?.email || "",
        address: cn.customers?.address || "",
        vat_number: cn.customers?.vat_number || "",
      },
      items,
      totals: { netTotal: net, vatTotal: vat, grandTotal: net + vat },
    };
  };

  // ── PDF download ───────────────────────────────────────────────────────────
  const handleDownloadPDF = async (creditNoteId: string) => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const data = await buildCreditNoteInvoiceData(creditNoteId);
      setPdfCreditNoteData(data);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await downloadPdfFromFunction(`CreditNote-${data.invoiceNumber}`, template?.font_family);
      toast({ title: "PDF generated", description: `Credit note ${data.invoiceNumber} downloaded.` });
    } catch (error: any) {
      console.error("Error generating credit note PDF:", error);
      toast({ title: "PDF error", description: error.message || "Could not generate PDF.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
      setPdfCreditNoteData(null);
    }
  };

  // ── WhatsApp send ──────────────────────────────────────────────────────────
  const handleSendWhatsApp = async (cn: CreditNoteWithRelations) => {
    try {
      const data = await buildCreditNoteInvoiceData(cn.id);
      setWhatsappCreditNoteData(data);
      setWhatsappCreditNote(cn);
      // Give the hidden layout time to render before the dialog captures the DOM
      await new Promise((r) => setTimeout(r, 150));
      setWhatsappDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not prepare WhatsApp send.",
        variant: "destructive",
      });
    }
  };

  // ── Email send ────────────────────────────────────────────────────────────
  const handleSendEmail = async (cn: CreditNoteWithRelations) => {
    try {
      const data = await buildCreditNoteInvoiceData(cn.id);
      setPdfCreditNoteData(data);
      setEmailCreditNote(cn);
      await new Promise((r) => setTimeout(r, 150));
      setEmailDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Could not prepare email.",
        variant: "destructive",
      });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Credit Notes</h1>
                <p className="text-muted-foreground">Manage Malta VAT-compliant credit notes for invoice corrections</p>
              </div>
              <Button onClick={() => setStandaloneDrawerOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Credit Note
              </Button>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Malta VAT Compliance Alert */}
          <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Malta VAT Compliance:</strong> Credit notes are used to correct issued invoices without modifying
              the original immutable invoice record. Each credit note is tracked for audit compliance.
            </AlertDescription>
          </Alert>

          {/* Filters and Search */}
          <div className="flex flex-wrap items-center gap-3 mb-6 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by number, client, invoice..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={statusFilter !== "all" ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Status:{" "}
                  {statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                  {statusFilter !== "all" && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setStatusFilter("all"); }}
                      className="ml-1 rounded-full hover:bg-white/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border border-border z-50">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Statuses</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("issued")}>Issued</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={typeFilter !== "all" ? "default" : "outline"}
                  size="sm"
                  className="gap-1"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Type: {typeFilter === "all" ? "All" : getTypeLabel(typeFilter)}
                  {typeFilter !== "all" && (
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); setTypeFilter("all"); }}
                      className="ml-1 rounded-full hover:bg-white/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border border-border z-50">
                <DropdownMenuItem onClick={() => setTypeFilter("all")}>All Types</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("invoice_adjustment")}>
                  Invoice Adjustment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter("customer_credit")}>Customer Credit</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="border-l border-border pl-4 ml-auto">
              <Button
                variant={isSelectionMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  const next = !isSelectionMode;
                  setIsSelectionMode(next);
                  if (!next) setSelectedIds(new Set());
                }}
              >
                {isSelectionMode ? "Cancel" : "Select"}
              </Button>
            </div>
          </div>

          {/* Credit Notes Table */}
          <Card>
            <CardContent className="p-0">
              {isSelectionMode && selectedIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-b border-border">
                  <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleBulkDownloadPDFs} disabled={bulkLoading}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download PDFs
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                      Clear
                    </Button>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
                  <TableRow>
                    {isSelectionMode && (
                      <TableHead className="w-10 pl-4">
                        <Checkbox
                          checked={allSelected}
                          data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                          className="translate-y-px"
                        />
                      </TableHead>
                    )}
                    <TableHead className="pl-4">Credit Note #</TableHead>
                    <TableHead>
                      <button type="button" onClick={() => handleSort("customer")} className="flex items-center hover:text-foreground transition-colors">
                        Client {sortField === "customer" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />) : <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />}
                      </button>
                    </TableHead>
                    <TableHead>Linked Invoice</TableHead>
                    <TableHead>
                      <button type="button" onClick={() => handleSort("status")} className="flex items-center hover:text-foreground transition-colors">
                        Status {sortField === "status" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />) : <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button type="button" onClick={() => handleSort("amount")} className="flex items-center ml-auto hover:text-foreground transition-colors">
                        Total {sortField === "amount" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />) : <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />}
                      </button>
                    </TableHead>
                    <TableHead>
                      <button type="button" onClick={() => handleSort("credit_note_date")} className="flex items-center hover:text-foreground transition-colors">
                        Issue Date {sortField === "credit_note_date" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />) : <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />}
                      </button>
                    </TableHead>
                    <TableHead className="text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={isSelectionMode ? 8 : 7} className="text-center py-8 text-muted-foreground text-sm">
                        Loading credit notes…
                      </TableCell>
                    </TableRow>
                  ) : sortedCreditNotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSelectionMode ? 8 : 7}>
                        {searchTerm || statusFilter !== "all" || typeFilter !== "all" ? (
                          <div className="flex flex-col items-center gap-3 py-14 text-center">
                            <div className="rounded-full bg-muted p-4">
                              <Search className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">No results found</p>
                              <p className="text-xs text-muted-foreground mt-0.5">No credit notes match your current filters.</p>
                            </div>
                            <button type="button" onClick={() => { setStatusFilter("all"); setTypeFilter("all"); }} className="text-xs text-primary underline underline-offset-2">Clear filters</button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <div className="rounded-full bg-muted p-4">
                              <FileText className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">No credit notes yet</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Create a general customer credit, or link one to an issued invoice.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={() => setStandaloneDrawerOpen(true)}>
                                <Plus className="h-3.5 w-3.5 mr-1.5" />
                                New Credit Note
                              </Button>
                              <Button asChild size="sm" variant="outline">
                                <Link to="/invoices">
                                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                                  Go to Invoices
                                </Link>
                              </Button>
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedCreditNotes.map((creditNote) => {
                      const total = calculateTotal(creditNote.amount, creditNote.vat_rate);
                      const statusBadge = getStatusBadge(creditNote.status);

                      return (
                        <TableRow key={creditNote.id} className="hover:bg-muted/50">
                          {isSelectionMode && (
                            <TableCell className="pl-4 w-10">
                              <Checkbox checked={selectedIds.has(creditNote.id)} onCheckedChange={() => toggleSelect(creditNote.id)} aria-label={`Select ${creditNote.credit_note_number}`} className="translate-y-px" />
                            </TableCell>
                          )}
                          <TableCell className="font-medium pl-4">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-left hover:text-primary transition-colors group"
                              onClick={() => setSelectedCreditNote(creditNote)}
                            >
                              <span className="group-hover:underline">{creditNote.credit_note_number}</span>
                              <span title="Officially issued — cannot be edited">
                                <Shield className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              </span>
                            </button>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{creditNote.customers?.name || "Unknown Customer"}</TableCell>
                          <TableCell>
                            {creditNote.invoice_id ? (
                              <Link
                                to={`/invoices/${creditNote.invoice_id}`}
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                {creditNote.invoices?.invoice_number || "View"}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${statusBadge.className} pointer-events-none`}>{statusBadge.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatCurrency(total)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {creditNote.issued_at ? (
                              format(new Date(creditNote.issued_at), "dd/MM/yyyy")
                            ) : (
                              <span>—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background border border-border z-50">
                                <DropdownMenuItem onClick={() => setSelectedCreditNote(creditNote)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {creditNote.invoice_id && (
                                  <DropdownMenuItem asChild>
                                    <Link to={`/invoices/${creditNote.invoice_id}`}>
                                      <FileText className="h-4 w-4 mr-2" />
                                      View Original Invoice
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleDownloadPDF(creditNote.id)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSendEmail(creditNote)}>
                                  <Mail className="h-4 w-4 mr-2" />
                                  Send Email
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSendWhatsApp(creditNote)}>
                                  <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                                  Send via WhatsApp
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Info Panel */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                About Credit Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Credit notes are created to correct issued invoices in compliance with Malta VAT regulations. They
                preserve the integrity of the original invoice while providing a formal correction.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Invoice adjustment</strong>: corrects a specific issued invoice and references it explicitly</li>
                <li><strong>Customer credit</strong>: a general balance credit not tied to any invoice (e.g. goodwill, prepayment)</li>
                <li>All credit notes are tracked for audit purposes</li>
                <li>Status changes from Draft → Issued</li>
                <li>VAT-bearing credit notes that adjust output tax must reference the original invoice per EU VAT Directive</li>
              </ul>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Transaction Drawer */}
      <TransactionDrawer
        open={!!selectedCreditNote}
        onOpenChange={(open) => !open && setSelectedCreditNote(null)}
        transaction={
          selectedCreditNote
            ? {
                id: selectedCreditNote.id,
                credit_note_number: selectedCreditNote.credit_note_number,
                credit_note_date: selectedCreditNote.credit_note_date,
                amount: selectedCreditNote.amount,
                vat_rate: selectedCreditNote.vat_rate,
                reason: selectedCreditNote.reason,
                status: selectedCreditNote.status,
                invoice_id: selectedCreditNote.invoice_id,
                customer_id: selectedCreditNote.customer_id,
              }
            : null
        }
        type="credit_note"
        onSendEmail={selectedCreditNote ? () => handleSendEmail(selectedCreditNote) : undefined}
        onSendWhatsApp={selectedCreditNote ? () => handleSendWhatsApp(selectedCreditNote) : undefined}
      />

      {/* Hidden PDF preview for download */}
      {pdfCreditNoteData && (
        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <UnifiedInvoiceLayout
            id="invoice-preview-root"
            variant="pdf"
            invoiceData={pdfCreditNoteData}
            documentType="CREDIT NOTE"
            companySettings={buildCompanySettings()}
            bankingSettings={buildBankingSettings()}
            templateSettings={buildTemplateSettings()}
            footerText={invoiceSettings?.invoice_footer_text}
          />
        </div>
      )}

      {/* Hidden PDF preview for WhatsApp (uses same id — rendered after pdfCreditNoteData is cleared) */}
      {whatsappCreditNoteData && !pdfCreditNoteData && (
        <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
          <UnifiedInvoiceLayout
            id="invoice-preview-root"
            variant="pdf"
            invoiceData={whatsappCreditNoteData}
            documentType="CREDIT NOTE"
            companySettings={buildCompanySettings()}
            bankingSettings={buildBankingSettings()}
            templateSettings={buildTemplateSettings()}
            footerText={invoiceSettings?.invoice_footer_text}
          />
        </div>
      )}

      {/* Email dialog */}
      {emailCreditNote && user && companySettings && (
        <SendDocumentEmailDialog
          open={emailDialogOpen}
          onOpenChange={(open) => {
            setEmailDialogOpen(open);
            if (!open) {
              setEmailCreditNote(null);
              setPdfCreditNoteData(null);
            }
          }}
          documentType="credit_note"
          documentId={emailCreditNote.id}
          documentNumber={emailCreditNote.credit_note_number}
          customer={{
            id: emailCreditNote.customer_id || "",
            name: emailCreditNote.customers?.name || "Customer",
            email: emailCreditNote.customers?.email || null,
          }}
          companyName={companySettings.company_name || ""}
          userId={user.id}
          fontFamily={template?.font_family}
          previewAvailable={true}
        />
      )}

      {/* Standalone credit note drawer */}
      <CreateCreditNoteDrawer
        open={standaloneDrawerOpen}
        onOpenChange={setStandaloneDrawerOpen}
        defaultType="customer_credit"
        onSuccess={() => {
          setStandaloneDrawerOpen(false);
          fetchCreditNotes();
        }}
      />

      {/* WhatsApp dialog */}
      {whatsappCreditNote && user && (
        <SendWhatsAppDialog
          open={whatsappDialogOpen}
          onOpenChange={(open) => {
            setWhatsappDialogOpen(open);
            if (!open) {
              setWhatsappCreditNote(null);
              setWhatsappCreditNoteData(null);
            }
          }}
          documentType="credit_note"
          documentId={whatsappCreditNote.id}
          documentNumber={whatsappCreditNote.credit_note_number}
          customer={{
            id: whatsappCreditNote.customer_id || "",
            name: whatsappCreditNote.customers?.name || "Customer",
            phone: whatsappCreditNote.customers?.phone || null,
          }}
          companyName={companySettings?.company_name || ""}
          userId={user.id}
          totalAmount={calculateTotal(whatsappCreditNote.amount, whatsappCreditNote.vat_rate)}
          onSuccess={() => {
            setWhatsappDialogOpen(false);
            setWhatsappCreditNote(null);
            setWhatsappCreditNoteData(null);
          }}
        />
      )}
    </div>
  );
};

export default CreditNotes;
