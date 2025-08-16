import React, { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Download } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  name: string;
  email?: string;
  vat_number?: string;
  address?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  customer_name: string;
}

interface InvoiceExportData {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  client_name: string;
  client_email: string;
  client_vat: string;
  client_address: string;
  item_description: string;
  quantity: number;
  unit_price: number;
  vat_percentage: number;
  net_line_total: number;
  vat_line_total: number;
  grand_invoice_total: number;
  payment_terms: string;
}

const ExportInvoices = () => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const statuses = ["Draft", "Pending", "Paid", "Overdue", "Cancelled"];

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, vat_number, address")
        .order("name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
    }
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("invoices")
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          status,
          total_amount,
          customers!inner(name)
        `)
        .order("invoice_date", { ascending: false });

      // Apply date filters
      if (startDate) {
        query = query.gte("invoice_date", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        query = query.lte("invoice_date", format(endDate, "yyyy-MM-dd"));
      }

      // Apply customer filter
      if (selectedCustomer !== "all") {
        query = query.eq("customer_id", selectedCustomer);
      }

      // Apply status filters
      if (selectedStatuses.length > 0) {
        query = query.in("status", selectedStatuses);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedInvoices = (data || []).map((invoice: any) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        status: invoice.status,
        total_amount: invoice.total_amount,
        customer_name: invoice.customers?.name || "Unknown",
      }));

      setInvoices(formattedInvoices);
      setTotalCount(formattedInvoices.length);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async () => {
    setLoading(true);
    try {
      // Build the same query as fetchInvoices but include all needed data
      let query = supabase
        .from("invoices")
        .select(`
          id,
          invoice_number,
          invoice_date,
          due_date,
          status,
          total_amount,
          customers!inner(name, email, vat_number, address, payment_terms)
        `);

      // Apply the same filters
      if (startDate) {
        query = query.gte("invoice_date", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        query = query.lte("invoice_date", format(endDate, "yyyy-MM-dd"));
      }
      if (selectedCustomer !== "all") {
        query = query.eq("customer_id", selectedCustomer);
      }
      if (selectedStatuses.length > 0) {
        query = query.in("status", selectedStatuses);
      }

      const { data: invoicesData, error: invoicesError } = await query;
      if (invoicesError) throw invoicesError;

      // Get invoice items for each invoice
      const exportData: InvoiceExportData[] = [];
      
      for (const invoice of invoicesData || []) {
        const { data: items, error: itemsError } = await supabase
          .from("invoice_items")
          .select("description, quantity, unit_price, vat_rate")
          .eq("invoice_id", invoice.id);

        if (itemsError) {
          console.error("Error fetching items for invoice:", invoice.invoice_number, itemsError);
          continue;
        }

        if (items && items.length > 0) {
          for (const item of items) {
            const netLineTotal = item.quantity * item.unit_price;
            const vatLineTotal = netLineTotal * (item.vat_rate || 0);
            
            exportData.push({
              invoice_number: invoice.invoice_number || "",
              invoice_date: invoice.invoice_date || "",
              due_date: invoice.due_date || "",
              status: invoice.status || "",
              client_name: invoice.customers?.name || "",
              client_email: invoice.customers?.email || "",
              client_vat: invoice.customers?.vat_number || "",
              client_address: invoice.customers?.address || "",
              item_description: item.description || "",
              quantity: item.quantity || 0,
              unit_price: item.unit_price || 0,
              vat_percentage: (item.vat_rate || 0) * 100,
              net_line_total: netLineTotal,
              vat_line_total: vatLineTotal,
              grand_invoice_total: invoice.total_amount || 0,
              payment_terms: invoice.customers?.payment_terms || "",
            });
          }
        } else {
          // Handle invoices without items
          exportData.push({
            invoice_number: invoice.invoice_number || "",
            invoice_date: invoice.invoice_date || "",
            due_date: invoice.due_date || "",
            status: invoice.status || "",
            client_name: invoice.customers?.name || "",
            client_email: invoice.customers?.email || "",
            client_vat: invoice.customers?.vat_number || "",
            client_address: invoice.customers?.address || "",
            item_description: "",
            quantity: 0,
            unit_price: 0,
            vat_percentage: 0,
            net_line_total: 0,
            vat_line_total: 0,
            grand_invoice_total: invoice.total_amount || 0,
            payment_terms: invoice.customers?.payment_terms || "",
          });
        }
      }

      // Generate CSV content
      const headers = [
        "Invoice Number",
        "Invoice Date (YYYY-MM-DD)",
        "Due Date (YYYY-MM-DD)",
        "Status",
        "Client Name",
        "Client Email",
        "Client VAT",
        "Client Address",
        "Item Description",
        "Quantity",
        "Unit Price",
        "VAT %",
        "Net Line Total",
        "VAT Line Total",
        "Grand Invoice Total",
        "Payment Terms"
      ];

      const csvContent = [
        headers.join(","),
        ...exportData.map(row => [
          `"${row.invoice_number}"`,
          `"${row.invoice_date}"`,
          `"${row.due_date}"`,
          `"${row.status}"`,
          `"${row.client_name}"`,
          `"${row.client_email}"`,
          `"${row.client_vat}"`,
          `"${row.client_address.replace(/"/g, '""')}"`,
          `"${row.item_description.replace(/"/g, '""')}"`,
          row.quantity.toString(),
          row.unit_price.toString(),
          row.vat_percentage.toString(),
          row.net_line_total.toString(),
          row.vat_line_total.toString(),
          row.grand_invoice_total.toString(),
          `"${row.payment_terms}"`
        ].join(","))
      ].join("\n");

      // Download CSV
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `invoices_export_${format(new Date(), "yyyyMMdd")}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Success",
        description: "Invoice data exported successfully",
      });
    } catch (error) {
      console.error("Error downloading CSV:", error);
      toast({
        title: "Error",
        description: "Failed to export invoice data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "default";
      case "pending":
        return "secondary";
      case "overdue":
        return "destructive";
      case "draft":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Export Invoices</h1>
          <p className="text-muted-foreground">
            Filter and export invoice data to CSV format
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date Range */}
              <div className="space-y-2">
                <Label>Issue Date Range</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : "Start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : "End date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Client Selector */}
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Multi-select */}
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <Badge
                      key={status}
                      variant={selectedStatuses.includes(status) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleStatusToggle(status)}
                    >
                      {status}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Apply Filters Button */}
              <Button onClick={fetchInvoices} disabled={loading} className="w-full">
                Apply Filters
              </Button>
            </CardContent>
          </Card>

          {/* Right Column - Results */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Total: {totalCount} invoices
                </p>
                <Button 
                  onClick={downloadCSV} 
                  disabled={loading || invoices.length === 0}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Grand Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : invoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          No invoices found. Click "Apply Filters" to load data.
                        </TableCell>
                      </TableRow>
                    ) : (
                      invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell>{invoice.customer_name}</TableCell>
                          <TableCell>
                            {invoice.invoice_date ? format(new Date(invoice.invoice_date), "MMM dd, yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            {invoice.due_date ? format(new Date(invoice.due_date), "MMM dd, yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(invoice.status)}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            ${invoice.total_amount?.toFixed(2) || "0.00"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ExportInvoices;