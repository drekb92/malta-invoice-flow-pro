
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Search,
  Upload,
  Download,
  MoreHorizontal,
  Eye,
  Edit,
  Mail,
  Trash2,
  FileText,
  Receipt,
  ArrowUpDown,
  Info,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CustomerForm } from "@/components/CustomerForm";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  address: string | null;
  payment_terms: string | null;
  created_at: string;
  vat_status: string | null;
  client_type: string | null;
  business_name: string | null;
  notes: string | null;
  date_added?: string | null;
  user_id?: string;
  total_invoiced?: number;
  outstanding_amount?: number;
  last_invoice_date?: string | null;
  invoice_count?: number;
}

type SortField = 'name' | 'total_invoiced' | 'outstanding_amount' | 'last_invoice_date';
type SortDirection = 'asc' | 'desc';

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchCustomers = async () => {
    try {
      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (customersError) throw customersError;

      // Fetch invoice metrics for each customer
      const { data: invoiceMetrics, error: metricsError } = await supabase
        .from("invoices")
        .select("customer_id, total_amount, status, invoice_date");

      if (metricsError) throw metricsError;

      // Calculate metrics per customer
      const metricsMap = new Map<string, {
        total_invoiced: number;
        outstanding_amount: number;
        last_invoice_date: string | null;
        invoice_count: number;
      }>();

      invoiceMetrics?.forEach(invoice => {
        if (!invoice.customer_id) return;
        
        const existing = metricsMap.get(invoice.customer_id) || {
          total_invoiced: 0,
          outstanding_amount: 0,
          last_invoice_date: null,
          invoice_count: 0,
        };

        existing.total_invoiced += Number(invoice.total_amount || 0);
        existing.invoice_count += 1;
        
        if (invoice.status !== 'paid') {
          existing.outstanding_amount += Number(invoice.total_amount || 0);
        }

        if (invoice.invoice_date) {
          if (!existing.last_invoice_date || invoice.invoice_date > existing.last_invoice_date) {
            existing.last_invoice_date = invoice.invoice_date;
          }
        }

        metricsMap.set(invoice.customer_id, existing);
      });

      // Merge customer data with metrics
      const customersWithMetrics = (customersData || []).map(customer => ({
        ...customer,
        vat_status: (customer as any).vat_status || null,
        client_type: (customer as any).client_type || null,
        business_name: (customer as any).business_name || null,
        notes: (customer as any).notes || null,
        date_added: (customer as any).date_added || null,
        ...metricsMap.get(customer.id),
      }));
      
      setCustomers(customersWithMetrics);
      setFilteredCustomers(customersWithMetrics);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    let result = [...customers];
    
    // Apply search filter
    if (searchTerm) {
      result = result.filter((customer) =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.vat_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.payment_terms?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bValue === null || bValue === undefined) bValue = sortDirection === 'asc' ? Infinity : -Infinity;

      // Convert to numbers for numeric fields
      if (sortField === 'total_invoiced' || sortField === 'outstanding_amount') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredCustomers(result);
  }, [searchTerm, customers, sortField, sortDirection]);

  const handleDeleteCustomer = async (id: string) => {
    // Security check: Verify user owns this customer before deletion
    const customerToDelete = customers.find(c => c.id === id);
    if (!customerToDelete || customerToDelete.user_id !== user?.id) {
      toast({
        title: "Error",
        description: "Unauthorized: You can only delete your own customers",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Customer deleted",
        description: "Customer has been successfully removed.",
      });
      
      fetchCustomers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete customer. Please check your permissions.",
        variant: "destructive",
      });
    }
  };

  const getPaymentStatusBadge = (customer: Customer) => {
    if (!customer.invoice_count || customer.invoice_count === 0) {
      return { 
        status: "no-invoices", 
        label: "No Invoices",
        variant: "outline" as const
      };
    }

    const outstanding = customer.outstanding_amount || 0;
    const total = customer.total_invoiced || 0;

    if (outstanding === 0) {
      return { 
        status: "paid", 
        label: "Paid Up",
        variant: "success" as const
      };
    }

    const outstandingRatio = outstanding / total;
    
    if (outstandingRatio >= 0.5) {
      return { 
        status: "overdue", 
        label: "Payment Due",
        variant: "destructive" as const
      };
    }

    return { 
      status: "partial", 
      label: "Partial Paid",
      variant: "default" as const
    };
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '€0.00';
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-IE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Customers</h1>
                <p className="text-muted-foreground">
                  Manage your customer database and payment terms
                </p>
              </div>
              <TooltipProvider>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate('/customers/import')}
                        className="w-full sm:w-auto"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Import Clients (CSV)
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Bulk add or update clients from a CSV file</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate('/customers/export')}
                        className="w-full sm:w-auto"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export Clients (CSV)
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export filtered clients to a CSV file</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  <CustomerForm onSave={fetchCustomers} />
                </div>
              </TooltipProvider>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Search */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search customers..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Customers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Customer List</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 -ml-3 font-medium"
                        onClick={() => handleSort('name')}
                      >
                        Customer
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                      </Button>
                    </TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>VAT Number</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 -ml-3 font-medium"
                              onClick={() => handleSort('total_invoiced')}
                            >
                              Total Invoiced
                              <ArrowUpDown className="ml-2 h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Sum of all invoices issued to this customer</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 -ml-3 font-medium"
                              onClick={() => handleSort('outstanding_amount')}
                            >
                              Outstanding
                              <ArrowUpDown className="ml-2 h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Total unpaid invoice amount</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 cursor-help">
                              Payment Status
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Customer payment status based on outstanding balance</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6">
                        Loading customers...
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6">
                        {searchTerm ? "No customers found matching your search." : "No customers found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => {
                      const paymentStatus = getPaymentStatusBadge(customer);
                      return (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{customer.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {customer.id.substring(0, 8)}...
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm">{customer.email || "No email"}</div>
                              <div className="text-sm text-muted-foreground">{customer.phone || "No phone"}</div>
                            </div>
                          </TableCell>
                          <TableCell>{customer.vat_number || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{customer.payment_terms || "Not set"}</Badge>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="font-medium cursor-help">
                                    {customer.invoice_count ? formatCurrency(customer.total_invoiced) : (
                                      <span className="text-muted-foreground">No invoices yet</span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{customer.invoice_count || 0} invoice(s) • Last: {formatDate(customer.last_invoice_date)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`font-medium cursor-help ${
                                    (customer.outstanding_amount || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'
                                  }`}>
                                    {customer.invoice_count ? formatCurrency(customer.outstanding_amount) : '-'}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {customer.invoice_count 
                                      ? `${formatCurrency((customer.total_invoiced || 0) - (customer.outstanding_amount || 0))} paid of ${formatCurrency(customer.total_invoiced)}`
                                      : 'No outstanding balance'
                                    }
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <Badge variant={paymentStatus.variant}>
                              {paymentStatus.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-60">
                                <div className="space-y-1">
                                  <Button 
                                    variant="ghost" 
                                    className="justify-start w-full text-sm"
                                    onClick={() => navigate(`/customers/${customer.id}`)}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    className="justify-start w-full text-sm"
                                    onClick={() => navigate(`/statements/${customer.id}`)}
                                  >
                                    <Receipt className="h-4 w-4 mr-2" />
                                    View Statement
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    className="justify-start w-full text-sm"
                                    onClick={() => navigate(`/quotations?client=${customer.id}`)}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    View Quotations
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    className="justify-start w-full text-sm"
                                    onClick={() => navigate(`/invoices/new?client=${customer.id}`)}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Invoice
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    className="justify-start w-full text-sm"
                                    onClick={() => navigate(`/quotations/new?client=${customer.id}`)}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create Quotation
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    className="justify-start w-full text-sm"
                                    onClick={() => navigate(`/customers/edit/${customer.id}`)}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Customer
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    className="justify-start w-full text-sm"
                                    onClick={() => handleDeleteCustomer(customer.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Customer
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
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

export default Customers;
