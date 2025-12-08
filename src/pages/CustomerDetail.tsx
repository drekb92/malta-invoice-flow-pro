import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building,
  FileText,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  vat_number: string | null;
  vat_status: string | null;
  payment_terms: string | null;
  business_name: string | null;
  client_type: string | null;
  notes: string | null;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  is_issued: boolean;
}

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [outstandingAmount, setOutstandingAmount] = useState(0);

  useEffect(() => {
    if (user && id) {
      fetchCustomerData();
    }
  }, [user, id]);

  const fetchCustomerData = async () => {
    if (!user || !id) return;

    try {
      // Fetch customer
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (customerError) throw customerError;

      if (!customerData) {
        toast({
          title: "Customer not found",
          description: "The customer you're looking for doesn't exist or you don't have access.",
          variant: "destructive",
        });
        navigate("/customers");
        return;
      }

      setCustomer(customerData);

      // Fetch invoices for this customer
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, due_date, status, total_amount, is_issued")
        .eq("customer_id", id)
        .eq("user_id", user.id)
        .order("invoice_date", { ascending: false });

      if (invoicesError) throw invoicesError;

      setInvoices(invoicesData || []);

      // Calculate outstanding amount
      const outstanding = (invoicesData || [])
        .filter((inv) => inv.status === "pending" || inv.status === "overdue")
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

      setOutstandingAmount(outstanding);
    } catch (error) {
      console.error("Error fetching customer data:", error);
      toast({
        title: "Error",
        description: "Failed to load customer details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; icon: React.ElementType }> = {
      paid: {
        className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        icon: CheckCircle,
      },
      pending: {
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
        icon: Clock,
      },
      overdue: {
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        icon: AlertCircle,
      },
      draft: {
        className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        icon: FileText,
      },
    };
    return variants[status] || variants.draft;
  };

  const openInvoices = invoices.filter(
    (inv) => inv.status === "pending" || inv.status === "overdue"
  );
  const paidInvoices = invoices.filter((inv) => inv.status === "paid");

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view customer details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="md:ml-64 p-6">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="md:ml-64 p-6">
          <p className="text-muted-foreground">Customer not found.</p>
        </div>
      </div>
    );
  }

  const InvoiceTable = ({ invoiceList }: { invoiceList: Invoice[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice #</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoiceList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
              No invoices found
            </TableCell>
          </TableRow>
        ) : (
          invoiceList.map((invoice) => {
            const statusBadge = getStatusBadge(invoice.status);
            const StatusIcon = statusBadge.icon;
            return (
              <TableRow
                key={invoice.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/invoices/${invoice.id}`)}
              >
                <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                <TableCell>
                  {format(new Date(invoice.invoice_date), "dd/MM/yyyy")}
                </TableCell>
                <TableCell>
                  {format(new Date(invoice.due_date), "dd/MM/yyyy")}
                </TableCell>
                <TableCell>
                  <Badge className={statusBadge.className}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(invoice.total_amount)}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/customers")}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
                  <p className="text-muted-foreground">
                    {customer.client_type === "Business" ? customer.business_name : "Individual Client"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => navigate(`/customers/edit/${customer.id}`)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Customer
                </Button>
                <Button onClick={() => navigate(`/invoices/new?client=${customer.id}`)}>
                  <FileText className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <div className="space-y-6">
            {/* Customer Info Card */}
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </p>
                      <p className="font-medium">{customer.email || "Not provided"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone
                      </p>
                      <p className="font-medium">{customer.phone || "Not provided"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Address
                      </p>
                      <p className="font-medium">{customer.address || "Not provided"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">VAT Number</p>
                      <p className="font-medium">{customer.vat_number || "Not provided"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">VAT Status</p>
                      <Badge variant="outline">{customer.vat_status || "Not set"}</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Payment Terms</p>
                      <Badge variant="outline">{customer.payment_terms || "Net 30"}</Badge>
                    </div>
                  </div>
                  {customer.notes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{customer.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Outstanding Amount Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Outstanding
                  </CardTitle>
                  <CardDescription>Total unpaid invoices</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-destructive">
                    {formatCurrency(outstandingAmount)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {openInvoices.length} open invoice{openInvoices.length !== 1 ? "s" : ""}
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Invoices</span>
                      <span className="font-medium">{invoices.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Paid</span>
                      <span className="font-medium text-green-600">{paidInvoices.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Open</span>
                      <span className="font-medium text-yellow-600">{openInvoices.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Invoices Tabs */}
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>View and manage invoices for this customer</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="open" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="open" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Open ({openInvoices.length})
                    </TabsTrigger>
                    <TabsTrigger value="paid" className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Paid ({paidInvoices.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="open" className="mt-4">
                    <InvoiceTable invoiceList={openInvoices} />
                  </TabsContent>

                  <TabsContent value="paid" className="mt-4">
                    <InvoiceTable invoiceList={paidInvoices} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CustomerDetail;
