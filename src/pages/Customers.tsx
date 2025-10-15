
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Zap,
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
  last_payment_date?: string | null;
  invoice_count?: number;
  has_overdue?: boolean;
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
        .select("id, customer_id, total_amount, status, invoice_date, due_date");

      if (metricsError) throw metricsError;

      // Fetch payment data for each customer
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("invoice_id, payment_date, amount");

      if (paymentsError) throw paymentsError;

      // Calculate metrics per customer
      const metricsMap = new Map<string, {
        total_invoiced: number;
        outstanding_amount: number;
        last_invoice_date: string | null;
        last_payment_date: string | null;
        invoice_count: number;
        has_overdue: boolean;
      }>();

      // Create a map of payments by invoice_id
      const paymentsMap = new Map<string, { payment_date: string; amount: number }[]>();
      paymentsData?.forEach(payment => {
        if (!payment.invoice_id) return;
        const existing = paymentsMap.get(payment.invoice_id) || [];
        existing.push({ payment_date: payment.payment_date, amount: Number(payment.amount || 0) });
        paymentsMap.set(payment.invoice_id, existing);
      });

      const today = new Date().toISOString().split('T')[0];

      invoiceMetrics?.forEach(invoice => {
        if (!invoice.customer_id) return;
        
        const existing = metricsMap.get(invoice.customer_id) || {
          total_invoiced: 0,
          outstanding_amount: 0,
          last_invoice_date: null,
          last_payment_date: null,
          invoice_count: 0,
          has_overdue: false,
        };

        existing.total_invoiced += Number(invoice.total_amount || 0);
        existing.invoice_count += 1;
        
        if (invoice.status !== 'paid') {
          existing.outstanding_amount += Number(invoice.total_amount || 0);
          
          // Check if this invoice is overdue
          if (invoice.due_date && invoice.due_date < today) {
            existing.has_overdue = true;
          }
        }

        if (invoice.invoice_date) {
          if (!existing.last_invoice_date || invoice.invoice_date > existing.last_invoice_date) {
            existing.last_invoice_date = invoice.invoice_date;
          }
        }

        // Get payments for this invoice
        const invoicePayments = paymentsMap.get(invoice.id);
        if (invoicePayments && invoicePayments.length > 0) {
          invoicePayments.forEach(payment => {
            if (payment.payment_date) {
              if (!existing.last_payment_date || payment.payment_date > existing.last_payment_date) {
                existing.last_payment_date = payment.payment_date;
              }
            }
          });
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
        variant: "outline" as const,
        color: "text-muted-foreground"
      };
    }

    const outstanding = customer.outstanding_amount || 0;
    
    // Red: Has overdue invoices
    if (customer.has_overdue && outstanding > 0) {
      return { 
        status: "overdue", 
        label: "Overdue",
        variant: "destructive" as const,
        color: "text-destructive"
      };
    }

    // Yellow: Has outstanding but not overdue
    if (outstanding > 0) {
      return { 
        status: "outstanding", 
        label: "Outstanding",
        variant: "default" as const,
        color: "text-yellow-600"
      };
    }

    // Green: All paid up
    return { 
      status: "paid", 
      label: "Paid Up",
      variant: "outline" as const,
      color: "text-green-600"
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

  const handleQuickInvoice = async (customerId: string, serviceType: string) => {
    try {
      // Navigate to new invoice with customer pre-selected and service type
      navigate(`/invoices/new?client=${customerId}&quickService=${serviceType}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not create quick invoice",
        variant: "destructive",
      });
    }
  };

  const quickInvoiceTemplates = [
    { label: 'Consulting (5h @ €100)', type: 'consulting', hours: 5, rate: 100 },
    { label: 'Development (10h @ €80)', type: 'development', hours: 10, rate: 80 },
    { label: 'Design (3h @ €90)', type: 'design', hours: 3, rate: 90 },
    { label: 'Monthly Retainer (€1,500)', type: 'retainer', amount: 1500 },
  ];

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
                            <p>Customer payment status: Overdue (red), Outstanding (yellow), Paid Up (green)</p>
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
                              onClick={() => handleSort('last_invoice_date')}
                            >
                              Last Invoice
                              <ArrowUpDown className="ml-2 h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Date of most recent invoice issued</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 cursor-help">
                              Last Payment
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Date of most recent payment received</p>
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
                      <TableCell colSpan={10} className="text-center py-6">
                        Loading customers...
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-6">
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
                            <Badge variant={paymentStatus.variant} className={paymentStatus.color}>
                              {paymentStatus.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(customer.last_invoice_date)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(customer.last_payment_date)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Primary Create Invoice Button */}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="sm"
                                      onClick={() => navigate(`/invoices/new?client=${customer.id}`)}
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Invoice
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Create new invoice for {customer.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              {/* Quick Invoice Dropdown */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    <Zap className="h-4 w-4 mr-2" />
                                    Quick
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuLabel>Quick Invoice Templates</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {quickInvoiceTemplates.map((template, idx) => (
                                    <DropdownMenuItem
                                      key={idx}
                                      onClick={() => handleQuickInvoice(customer.id, template.type)}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      {template.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>

                              {/* More Actions Popover */}
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
                            </div>
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
