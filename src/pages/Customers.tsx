
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
  FileText,
  Receipt,
  ArrowUpDown,
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
  outstanding_amount?: number;
  open_invoice_count?: number;
  last_activity_date?: string | null;
}

type SortField = 'name' | 'outstanding_amount' | 'open_invoice_count' | 'last_activity_date';
type SortDirection = 'asc' | 'desc';

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('outstanding_amount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchCustomers = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (customersError) throw customersError;

      const { data: invoiceMetrics, error: metricsError } = await supabase
        .from("invoices")
        .select("id, customer_id, total_amount, status, invoice_date");

      if (metricsError) throw metricsError;

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("invoice_id, payment_date, amount")
        .eq("user_id", user.id);

      if (paymentsError) throw paymentsError;

      const metricsMap = new Map<string, {
        outstanding_amount: number;
        open_invoice_count: number;
        last_activity_date: string | null;
      }>();

      const paymentsMap = new Map<string, { payment_date: string; amount: number }[]>();
      paymentsData?.forEach(payment => {
        if (!payment.invoice_id) return;
        const existing = paymentsMap.get(payment.invoice_id) || [];
        existing.push({ payment_date: payment.payment_date, amount: Number(payment.amount || 0) });
        paymentsMap.set(payment.invoice_id, existing);
      });

      invoiceMetrics?.forEach(invoice => {
        if (!invoice.customer_id) return;
        
        const existing = metricsMap.get(invoice.customer_id) || {
          outstanding_amount: 0,
          open_invoice_count: 0,
          last_activity_date: null,
        };

        // Count open invoices (not fully paid)
        if (invoice.status !== 'paid') {
          existing.outstanding_amount += Number(invoice.total_amount || 0);
          existing.open_invoice_count += 1;
        }

        // Track last activity (invoice date)
        if (invoice.invoice_date) {
          if (!existing.last_activity_date || invoice.invoice_date > existing.last_activity_date) {
            existing.last_activity_date = invoice.invoice_date;
          }
        }

        // Track last activity (payment date)
        const invoicePayments = paymentsMap.get(invoice.id);
        if (invoicePayments && invoicePayments.length > 0) {
          invoicePayments.forEach(payment => {
            if (payment.payment_date) {
              if (!existing.last_activity_date || payment.payment_date > existing.last_activity_date) {
                existing.last_activity_date = payment.payment_date;
              }
            }
          });
        }

        metricsMap.set(invoice.customer_id, existing);
      });

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
  }, [user]);

  useEffect(() => {
    let result = [...customers];
    
    if (searchTerm) {
      result = result.filter((customer) =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    result.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (aValue === null || aValue === undefined) aValue = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bValue === null || bValue === undefined) bValue = sortDirection === 'asc' ? Infinity : -Infinity;

      if (sortField === 'outstanding_amount' || sortField === 'open_invoice_count') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredCustomers(result);
  }, [searchTerm, customers, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'outstanding_amount' ? 'desc' : 'asc');
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
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Customers</h1>
                <p className="text-muted-foreground text-sm">
                  Manage your customer database
                </p>
              </div>
              <TooltipProvider>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate('/customers/import')}
                        className="hidden sm:flex"
                      >
                        <Upload className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Import</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Import clients from CSV</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate('/customers/export')}
                        className="hidden sm:flex"
                      >
                        <Download className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Export</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export clients to CSV</TooltipContent>
                  </Tooltip>
                  
                  <CustomerForm onSave={fetchCustomers} />
                </div>
              </TooltipProvider>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          {/* Search */}
          <div className="flex items-center mb-4">
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
            <CardHeader className="py-4">
              <CardTitle className="text-base">Customer List</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 -ml-3 font-medium"
                          onClick={() => handleSort('name')}
                        >
                          Customer
                          <ArrowUpDown className="ml-2 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="hidden sm:table-cell min-w-[160px]">Contact</TableHead>
                      <TableHead className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 font-medium"
                          onClick={() => handleSort('open_invoice_count')}
                        >
                          <span className="hidden sm:inline">Open Invoices</span>
                          <span className="sm:hidden">Open</span>
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 -ml-3 font-medium"
                          onClick={() => handleSort('outstanding_amount')}
                        >
                          Outstanding
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 -ml-3 font-medium"
                          onClick={() => handleSort('last_activity_date')}
                        >
                          Last Activity
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Loading customers...
                        </TableCell>
                      </TableRow>
                    ) : filteredCustomers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {searchTerm ? "No customers found." : "No customers yet."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <TableRow 
                          key={customer.id} 
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => navigate(`/customers/${customer.id}`)}
                        >
                          {/* Customer */}
                          <TableCell>
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {customer.id.substring(0, 8)}
                            </div>
                          </TableCell>

                          {/* Contact */}
                          <TableCell className="hidden sm:table-cell">
                            <div className="text-sm">
                              {customer.email ? (
                                customer.email
                              ) : (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  No email
                                </Badge>
                              )}
                            </div>
                            {customer.phone && (
                              <div className="text-xs text-muted-foreground">{customer.phone}</div>
                            )}
                          </TableCell>

                          {/* Open Invoices */}
                          <TableCell className="text-center">
                            <span className={`text-sm tabular-nums ${
                              (customer.open_invoice_count || 0) > 0 
                                ? 'font-medium' 
                                : 'text-muted-foreground'
                            }`}>
                              {customer.open_invoice_count || 0}
                            </span>
                          </TableCell>

                          {/* Outstanding */}
                          <TableCell>
                            <span className={`text-sm font-medium tabular-nums ${
                              (customer.outstanding_amount || 0) > 0 
                                ? 'text-destructive' 
                                : 'text-muted-foreground'
                            }`}>
                              {formatCurrency(customer.outstanding_amount || 0)}
                            </span>
                          </TableCell>

                          {/* Last Activity */}
                          <TableCell className="hidden md:table-cell">
                            <span className="text-sm text-muted-foreground">
                              {formatDate(customer.last_activity_date)}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                      onClick={() => navigate(`/invoices/new?client=${customer.id}`)}
                                    >
                                      <Plus className="h-4 w-4" />
                                      <span className="sr-only">New invoice</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>New invoice</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">More actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => navigate(`/customers/${customer.id}`)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate(`/customers/edit/${customer.id}`)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate(`/customers/${customer.id}?statement=open`)}>
                                    <Receipt className="h-4 w-4 mr-2" />
                                    Statement
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => navigate(`/invoices/new?client=${customer.id}`)}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    New Invoice
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate(`/quotations/new?client=${customer.id}`)}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    New Quotation
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
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default Customers;
