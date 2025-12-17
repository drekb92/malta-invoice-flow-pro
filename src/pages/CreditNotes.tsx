import { generateInvoicePDFWithTemplate } from "@/lib/pdfGenerator";
import type { InvoiceData } from "@/services/pdfService";
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
import { Search, Filter, Download, MoreHorizontal, Eye, FileText, Shield, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { CreditNote as CreditNoteType } from "@/types/invoice-compliance";
import { TransactionDrawer } from "@/components/TransactionDrawer";

interface CreditNoteWithRelations extends CreditNoteType {
  customers?: {
    name: string;
    email?: string;
  };
  invoices?: {
    invoice_number: string;
  };
}

const CreditNotes = () => {
  const navigate = useNavigate();
  const [creditNotes, setCreditNotes] = useState<CreditNoteWithRelations[]>([]);
  const [filteredCreditNotes, setFilteredCreditNotes] = useState<CreditNoteWithRelations[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNoteWithRelations | null>(null);
  const { toast } = useToast();

  const fetchCreditNotes = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("credit_notes")
        .select(
          `
          *,
          customers (
            name,
            email
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch original invoice numbers separately
      const creditNotesWithInvoices = await Promise.all(
        (data || []).map(async (cn) => {
          if (cn.invoice_id) {
            const { data: invoiceData } = await supabase
              .from("invoices")
              .select("invoice_number")
              .eq("id", cn.invoice_id)
              .maybeSingle();

            return {
              ...cn,
              invoices: invoiceData || undefined,
            } as CreditNoteWithRelations;
          }
          return cn as CreditNoteWithRelations;
        }),
      );

      setCreditNotes(creditNotesWithInvoices);
      setFilteredCreditNotes(creditNotesWithInvoices);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load credit notes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditNotes();
  }, []);

  useEffect(() => {
    let filtered = creditNotes;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (creditNote) =>
          creditNote.credit_note_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          creditNote.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          creditNote.invoices?.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((creditNote) => creditNote.status === statusFilter);
    }

    setFilteredCreditNotes(filtered);
  }, [searchTerm, statusFilter, creditNotes]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return {
          className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
          label: "Draft",
        };
      case "issued":
        return {
          className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          label: "Issued",
        };
      case "applied":
        return {
          className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
          label: "Applied",
        };
      default:
        return {
          className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
          label: status,
        };
    }
  };

  const handleDownloadPDF = async (creditNoteId: string) => {
    try {
      // 1) Load credit note + customer
      const { data: cn, error: cnError } = await (supabase as any)
        .from("credit_notes")
        .select(
          `
        *,
        customers (
          name,
          email,
          address,
          vat_number
        )
      `,
        )
        .eq("id", creditNoteId)
        .maybeSingle();

      if (cnError || !cn) {
        throw new Error(cnError?.message || "Credit note not found");
      }

      // 2) Load credit note items
      const { data: itemsData, error: itemsError } = await supabase
        .from("credit_note_items")
        .select("*")
        .eq("credit_note_id", creditNoteId);

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      const items = (itemsData || []).map((item: any) => ({
        description: item.description,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        vat_rate: Number(item.vat_rate ?? cn.vat_rate ?? 0.18),
        unit: item.unit || undefined,
      }));

      // 3) Totals from header (your column `amount` is NET)
      const net = Number(cn.amount || 0);
      const vatRate = Number(cn.vat_rate ?? 0.18);
      const vat = net * vatRate;
      const total = net + vat;

      const invoiceData: InvoiceData = {
        invoiceNumber: cn.credit_note_number,
        invoiceDate: cn.credit_note_date,
        dueDate: cn.credit_note_date,
        documentType: "CREDIT NOTE",
        customer: {
          name: cn.customers?.name || "Unknown Customer",
          email: cn.customers?.email || "",
          address: cn.customers?.address || "",
          vat_number: cn.customers?.vat_number || "",
        },
        items,
        totals: {
          netTotal: net,
          vatTotal: vat,
          grandTotal: total,
        },
      };

      await generateInvoicePDFWithTemplate(invoiceData, cn.credit_note_number || "credit-note");

      toast({
        title: "PDF generated",
        description: `Credit note ${cn.credit_note_number} downloaded.`,
      });
    } catch (error: any) {
      console.error("Error generating credit note PDF:", error);
      toast({
        title: "PDF error",
        description: error.message || "Could not generate credit note PDF.",
        variant: "destructive",
      });
    }
  };

  const calculateTotal = (amount: number, vatRate: number) => {
    const vat = amount * vatRate;
    return amount + vat;
  };

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
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search credit notes..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter (
                  {statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background border border-border z-50">
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Credit Notes</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("issued")}>Issued</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("applied")}>Applied</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Credit Notes Table */}
          <Card>
            <CardHeader>
              <CardTitle>Credit Note List</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Credit Note #</TableHead>
                    <TableHead>Original Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6">
                        Loading credit notes...
                      </TableCell>
                    </TableRow>
                  ) : filteredCreditNotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6">
                        {searchTerm || statusFilter !== "all"
                          ? "No credit notes found matching your criteria."
                          : "No credit notes found. Credit notes are created to correct issued invoices."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCreditNotes.map((creditNote) => {
                      const total = calculateTotal(creditNote.amount, creditNote.vat_rate);
                      const statusBadge = getStatusBadge(creditNote.status);

                      return (
                        <TableRow key={creditNote.id}>
                          <TableCell className="font-medium">
                            <button
                              type="button"
                              className="flex items-center gap-2 text-left hover:text-primary transition-colors group"
                              onClick={() => setSelectedCreditNote(creditNote)}
                            >
                              <span className="group-hover:underline">{creditNote.credit_note_number}</span>
                              <span title="Malta VAT Compliant">
                                <Shield className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              </span>
                            </button>
                          </TableCell>
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
                          <TableCell>{creditNote.customers?.name || "Unknown Customer"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{formatCurrency(total)}</span>
                              <span className="text-xs text-muted-foreground">
                                Net: {formatCurrency(creditNote.amount)} + VAT ({(creditNote.vat_rate * 100).toFixed(0)}
                                %)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm max-w-[200px] truncate block" title={creditNote.reason}>
                              {creditNote.reason}
                            </span>
                          </TableCell>
                          <TableCell>{format(new Date(creditNote.credit_note_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background border border-border z-50">
                                <DropdownMenuItem onClick={() => navigate(`/credit-notes/${creditNote.id}`)}>
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
                <li>Credit notes must reference the original invoice</li>
                <li>All credit notes are tracked for audit purposes</li>
                <li>Status changes from Draft → Issued → Applied</li>
                <li>Each credit note reduces the outstanding amount of the original invoice</li>
              </ul>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Transaction Drawer */}
      <TransactionDrawer
        open={!!selectedCreditNote}
        onOpenChange={(open) => !open && setSelectedCreditNote(null)}
        transaction={selectedCreditNote ? {
          id: selectedCreditNote.id,
          credit_note_number: selectedCreditNote.credit_note_number,
          credit_note_date: selectedCreditNote.credit_note_date,
          amount: selectedCreditNote.amount,
          vat_rate: selectedCreditNote.vat_rate,
          reason: selectedCreditNote.reason,
          status: selectedCreditNote.status,
          invoice_id: selectedCreditNote.invoice_id,
          customer_id: selectedCreditNote.customer_id,
        } : null}
        type="credit_note"
      />
    </div>
  );
};

export default CreditNotes;
