
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
  Download,
  Upload,
  MoreHorizontal,
  Eye,
  Edit,
  Mail,
  Trash2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  amount: number;
  vat_rate: number;
  due_date: string;
  status: string;
  created_at: string;
  customers?: {
    name: string;
    payment_terms: string | null;
  };
}

const Invoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          customers (
            name,
            payment_terms
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setInvoices(data || []);
      setFilteredInvoices(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    let filtered = invoices;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter((invoice) =>
        invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customers?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === statusFilter);
    }

    setFilteredInvoices(filtered);
  }, [searchTerm, statusFilter, invoices]);

  const handleDeleteInvoice = async (id: string) => {
    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Invoice deleted",
        description: "Invoice has been successfully removed.",
      });
      
      fetchInvoices();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete invoice",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Import the PDF generator
      const { generatePDF } = await import('../lib/pdfGenerator');
      
      // Create a temporary preview element for PDF generation
      const previewId = `temp-invoice-preview-${invoiceId}`;
      const previewElement = document.createElement('div');
      previewElement.id = previewId;
      previewElement.style.position = 'absolute';
      previewElement.style.left = '-9999px';
      previewElement.className = 'bg-white p-8 min-h-[297mm] w-[210mm]';
      
      // Create invoice HTML content using template styling
      previewElement.innerHTML = `
        <div class="max-w-4xl mx-auto p-8 bg-white">
          <!-- Header -->
          <div class="flex justify-between items-start mb-8">
            <div>
              <h1 class="text-4xl font-bold text-gray-900 mb-2">INVOICE</h1>
              <p class="text-lg text-gray-600">#${invoice.invoice_number}</p>
            </div>
            <div class="text-right">
              <div class="w-20 h-20 bg-gray-200 rounded mb-4"></div>
              <p class="text-sm text-gray-600">Company Logo</p>
            </div>
          </div>

          <!-- Invoice Details -->
          <div class="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 class="text-lg font-semibold text-gray-900 mb-3">Bill To:</h3>
              <div class="text-gray-700">
                <p class="font-medium">${invoice.customers?.name || 'Unknown Customer'}</p>
                <p class="text-sm mt-1">Customer ID: ${invoice.customer_id}</p>
              </div>
            </div>
            <div class="text-right">
              <div class="space-y-2">
                <div>
                  <span class="text-gray-600">Invoice Date:</span>
                  <span class="ml-2 font-medium">${new Date(invoice.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span class="text-gray-600">Due Date:</span>
                  <span class="ml-2 font-medium">${new Date(invoice.due_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span class="text-gray-600">Status:</span>
                  <span class="ml-2 px-2 py-1 rounded text-xs font-medium ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' : invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}">${invoice.status.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="mb-8">
            <table class="w-full">
              <thead>
                <tr class="border-b-2 border-gray-300">
                  <th class="text-left py-3 px-2 font-semibold text-gray-900">Description</th>
                  <th class="text-center py-3 px-2 font-semibold text-gray-900">Qty</th>
                  <th class="text-right py-3 px-2 font-semibold text-gray-900">Unit Price</th>
                  <th class="text-right py-3 px-2 font-semibold text-gray-900">VAT</th>
                  <th class="text-right py-3 px-2 font-semibold text-gray-900">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-gray-200">
                  <td class="py-4 px-2 text-gray-700">Professional Services</td>
                  <td class="py-4 px-2 text-center text-gray-700">1</td>
                  <td class="py-4 px-2 text-right text-gray-700">€${(invoice.amount / 1.18).toFixed(2)}</td>
                  <td class="py-4 px-2 text-right text-gray-700">18%</td>
                  <td class="py-4 px-2 text-right font-medium text-gray-900">€${invoice.amount.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Total -->
          <div class="flex justify-end">
            <div class="w-64">
              <div class="border-t-2 border-gray-300 pt-4">
                <div class="flex justify-between items-center">
                  <span class="text-xl font-bold text-gray-900">Total:</span>
                  <span class="text-2xl font-bold text-gray-900">€${invoice.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="mt-12 pt-8 border-t border-gray-200 text-center text-gray-600 text-sm">
            <p>Thank you for your business!</p>
          </div>
        </div>
      `;
      
      document.body.appendChild(previewElement);
      
      // Generate PDF
      await generatePDF(previewId, `invoice-${invoice.invoice_number}`, {
        format: 'A4',
        orientation: 'portrait',
        margin: 15,
        quality: 0.95
      });
      
      // Clean up
      document.body.removeChild(previewElement);
      
      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to download PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    };
    return variants[status as keyof typeof variants] || variants.draft;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
                <p className="text-muted-foreground">
                  Manage your Malta VAT-compliant invoices
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
                <Button asChild>
                  <Link to="/invoices/new">
                    <Plus className="h-4 w-4 mr-2" />
                    New Invoice
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
              <Input
                placeholder="Search invoices..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter ({statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>All Invoices</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("draft")}>Draft</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("pending")}>Pending</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("paid")}>Paid</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("overdue")}>Overdue</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Invoices Table */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice List</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6">
                        Loading invoices...
                      </TableCell>
                    </TableRow>
                  ) : filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6">
                        {searchTerm || statusFilter !== "all" ? "No invoices found matching your criteria." : "No invoices found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((invoice) => {
                      const totalAmount = invoice.amount + (invoice.amount * invoice.vat_rate);
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{invoice.customers?.name || "Unknown Customer"}</TableCell>
                          <TableCell>€{totalAmount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadge(invoice.status)}>
                              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(invoice.created_at), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{format(new Date(invoice.due_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{invoice.customers?.payment_terms || "Not set"}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link to={`/invoices/${invoice.id}`}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to={`/invoices/edit/${invoice.id}`}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDownloadPDF(invoice.id)}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteInvoice(invoice.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
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
        </main>
      </div>
    </div>
  );
};

export default Invoices;
