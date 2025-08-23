
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
}

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Map the data to ensure all fields are present with defaults
      const customersWithDefaults = (data || []).map(customer => ({
        ...customer,
        vat_status: (customer as any).vat_status || null,
        client_type: (customer as any).client_type || null,
        business_name: (customer as any).business_name || null,
        notes: (customer as any).notes || null,
        date_added: (customer as any).date_added || null,
      }));
      
      setCustomers(customersWithDefaults);
      setFilteredCustomers(customersWithDefaults);
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
    if (!searchTerm) {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter((customer) =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.vat_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.payment_terms?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
    }
  }, [searchTerm, customers]);

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

  const getStatusBadge = (customer: Customer) => {
    // Simple status logic - could be enhanced with actual status field
    const hasRecentActivity = new Date(customer.created_at) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const status = hasRecentActivity ? "active" : "inactive";
    
    const variants = {
      active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      inactive: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    };
    return { status, className: variants[status] };
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
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>VAT Number</TableHead>
                    <TableHead>Payment Terms</TableHead>
                    <TableHead>Total Invoiced</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead>Status</TableHead>
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
                      const statusInfo = getStatusBadge(customer);
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
                          <TableCell>-</TableCell>
                          <TableCell className="font-medium">-</TableCell>
                          <TableCell>
                            <Badge className={statusInfo.className}>
                              {statusInfo.status.charAt(0).toUpperCase() + statusInfo.status.slice(1)}
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
