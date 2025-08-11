
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Mail,
  ArrowRight,
  Trash2,
  Download,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";

interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  amount: number;
  vat_amount: number;
  total_amount: number;
  issue_date: string;
  valid_until: string;
  status: string;
  created_at: string;
  customers?: {
    name: string;
    email?: string;
    address?: string;
    vat_number?: string;
    payment_terms: string | null;
  };
}

const Quotations = () => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [filtered, setFiltered] = useState<Quotation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [dateOption, setDateOption] = useState<"quotation" | "today" | "custom">("quotation");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [isConverting, setIsConverting] = useState(false);

  const fetchQuotations = async () => {
    try {
      const { data, error } = await supabase
        .from("quotations")
        .select(`*, customers ( name, email, address, vat_number, payment_terms )`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setQuotations(data || []);
      setFiltered(data || []);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load quotations", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  useEffect(() => {
    let list = quotations;
    if (searchTerm) {
      list = list.filter((q) =>
        q.quotation_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.customers?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((q) => q.status === statusFilter);
    }
    setFiltered(list);
  }, [searchTerm, statusFilter, quotations]);

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      converted: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      expired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return (variants as any)[status] || variants.draft;
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("quotations").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Quotation removed." });
      fetchQuotations();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete quotation", variant: "destructive" });
    }
  };

  const generateNextInvoiceNumber = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_number")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      let next = 1;
      if (data && data.length > 0) {
        const last = data[0].invoice_number || "";
        const match = last.match(/INV-(\d+)/);
        if (match) next = parseInt(match[1]) + 1;
      }
      return `INV-${String(next).padStart(6, "0")}`;
    } catch {
      return `INV-000001`;
    }
  };

  const handleConvertToInvoice = async (quotationId: string, invoiceDateOverride?: Date) => {
    try {
      // Load quotation + items + customer payment terms
      const { data: qData, error: qErr } = await supabase
        .from("quotations")
        .select(`*, customers ( payment_terms ), quotation_items ( description, quantity, unit, unit_price, vat_rate )`)
        .eq("id", quotationId)
        .single();
      if (qErr) throw qErr;

      const invoiceNumber = await generateNextInvoiceNumber();

      // Determine base invoice date
      const baseDateObj = invoiceDateOverride
        ? new Date(invoiceDateOverride)
        : new Date(qData.issue_date || qData.created_at);

      // Calculate due date from payment terms and base date
      const paymentTerms = qData.customers?.payment_terms || "Net 30";
      const daysMatch = paymentTerms.match(/\d+/);
      const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
      const dueDate = addDays(baseDateObj, paymentDays);

      // Create invoice
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert([
          {
            invoice_number: invoiceNumber,
            customer_id: qData.customer_id,
            amount: qData.amount,
            vat_amount: qData.vat_amount,
            total_amount: qData.total_amount,
            invoice_date: baseDateObj.toISOString().split("T")[0],
            due_date: dueDate.toISOString().split("T")[0],
            status: "pending",
            user_id: (qData as any).user_id,
          },
        ])
        .select("id")
        .single();
      if (invErr) throw invErr;

      // Create invoice items from quotation items
      const itemsPayload = (qData.quotation_items || []).map((it: any) => ({
        invoice_id: inv.id,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
      }));
      if (itemsPayload.length > 0) {
        const { error: itemsErr } = await supabase.from("invoice_items").insert(itemsPayload);
        if (itemsErr) throw itemsErr;
      }

      // Mark quotation as converted
      const { error: updErr } = await supabase
        .from("quotations")
        .update({ status: "converted" })
        .eq("id", quotationId);
      if (updErr) throw updErr;

      toast({ title: "Converted", description: "Quotation converted to invoice." });
      fetchQuotations();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to convert quotation", variant: "destructive" });
      throw e;
    }
  };

  const openConvertDialog = (q: Quotation) => {
    setSelectedQuotation(q);
    setDateOption("quotation");
    setCustomDate(undefined);
    setConvertDialogOpen(true);
  };

  const confirmConvert = async () => {
    if (!selectedQuotation) return;
    if (dateOption === "custom" && !customDate) {
      toast({ title: "Select a date", description: "Please choose a valid custom date.", variant: "destructive" });
      return;
    }
    setIsConverting(true);
    try {
      const override = dateOption === "today" ? new Date() : dateOption === "custom" ? customDate : undefined;
      await handleConvertToInvoice(selectedQuotation.id, override);
      setConvertDialogOpen(false);
      setSelectedQuotation(null);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
                <p className="text-muted-foreground">Create and manage quotations for potential customers</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button asChild size="sm">
                  <Link to="/quotations/new">
                    <Plus className="h-4 w-4 mr-2" />
                    New Quotation
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Filters and Search */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input placeholder="Search quotations..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter ({statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Quotations</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("sent")}>Sent</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("accepted")}>Accepted</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("converted")}>Converted</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("expired")}>Expired</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Quotations Table */}
          <Card>
            <CardHeader>
              <CardTitle>Quotation List</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quotation #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6">Loading quotations...</TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6">{searchTerm || statusFilter !== 'all' ? 'No quotations found matching your criteria.' : 'No quotations found.'}</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-medium">{q.quotation_number}</TableCell>
                        <TableCell>{q.customers?.name || "Unknown Customer"}</TableCell>
                        <TableCell>€{(q.total_amount || q.amount || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(q.status)}>
                            {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(q.issue_date || q.created_at), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{q.valid_until ? format(new Date(q.valid_until), "dd/MM/yyyy") : '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {q.status !== "converted" && (
                              <Button size="sm" onClick={() => openConvertDialog(q)}>
                                <ArrowRight className="h-4 w-4 mr-2" />
                                Convert to Invoice
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/quotations/${q.id}`}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to={`/quotations/edit/${q.id}`}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Mail className="h-4 w-4 mr-2" />
                                  Send Email
                                </DropdownMenuItem>
                                {q.status !== "converted" && (
                                  <DropdownMenuItem onClick={() => openConvertDialog(q)}>
                                    <ArrowRight className="h-4 w-4 mr-2" />
                                    Convert to Invoice
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleDelete(q.id)} className="text-red-600">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Convert Confirmation Dialog */}
          <Dialog open={convertDialogOpen} onOpenChange={(open) => { setConvertDialogOpen(open); if (!open) { setSelectedQuotation(null); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Convert quotation to invoice</DialogTitle>
                <DialogDescription>
                  {selectedQuotation ? `You are converting ${selectedQuotation.quotation_number}. Choose the invoice date.` : "Choose the invoice date."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <RadioGroup
                  value={dateOption}
                  onValueChange={(val) => setDateOption(val as "quotation" | "today" | "custom")}
                  className="space-y-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="quotation" id="date-quotation" />
                    <Label htmlFor="date-quotation" className="cursor-pointer">
                      Use quotation issue date ({selectedQuotation ? format(new Date(selectedQuotation.issue_date || selectedQuotation.created_at), "PPP") : "-"})
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="today" id="date-today" />
                    <Label htmlFor="date-today" className="cursor-pointer">
                      Use today's date ({format(new Date(), "PPP")})
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id="date-custom" />
                    <Label htmlFor="date-custom" className="cursor-pointer">Pick a custom date</Label>
                    {dateOption === "custom" && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="ml-2">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {customDate ? format(customDate, "PPP") : "Select date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={customDate}
                            onSelect={setCustomDate}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </RadioGroup>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setConvertDialogOpen(false)} disabled={isConverting}>
                  Cancel
                </Button>
                <Button onClick={confirmConvert} disabled={isConverting}>
                  {isConverting ? "Converting..." : "Convert"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
};

export default Quotations;

