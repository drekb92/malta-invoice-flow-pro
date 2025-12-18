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
  ScrollText,
  Info,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { StatementModal } from "@/components/StatementModal";
import { InvoiceSettlementSheet } from "@/components/InvoiceSettlementSheet";
import { CreateCreditNoteDrawer } from "@/components/CreateCreditNoteDrawer";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  locality: string | null;
  post_code: string | null;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [outstandingAmount, setOutstandingAmount] = useState(0);
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [settlementSheetOpen, setSettlementSheetOpen] = useState(false);
  const [creditNoteDrawerOpen, setCreditNoteDrawerOpen] = useState(false);

  // Auto-open statement modal if navigated with ?statement=open
  useEffect(() => {
    if (searchParams.get('statement') === 'open' && customer) {
      setStatementModalOpen(true);
      // Clear the query param to prevent re-opening on refresh
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, customer, setSearchParams]);

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

      // Calculate outstanding amount (all non-paid, non-draft invoices)
      const outstanding = (invoicesData || [])
        .filter((inv) => inv.status !== "paid" && inv.status !== "draft")
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
      partially_paid: {
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
        icon: CreditCard,
      },
      issued: {
        className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        icon: FileText,
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

  const outstandingInvoices = invoices.filter(
    (inv) => inv.status !== "paid" && inv.status !== "draft" && inv.status !== "overdue"
  );
  const overdueInvoices = invoices.filter((inv) => inv.status === "overdue");
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

  const handleOpenSettlement = (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click navigation
    setSelectedInvoice(invoice);
    setSettlementSheetOpen(true);
  };

  const InvoiceTable = ({ invoiceList }: { invoiceList: Invoice[] }) => (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <TableHead className="h-9 text-xs font-semibold">Invoice #</TableHead>
          <TableHead className="h-9 text-xs font-semibold">Date</TableHead>
          <TableHead className="h-9 text-xs font-semibold">Due Date</TableHead>
          <TableHead className="h-9 text-xs font-semibold">Status</TableHead>
          <TableHead className="h-9 text-xs font-semibold text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoiceList.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
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
                className="cursor-pointer hover:bg-muted/50 transition-colors h-10 group"
                onClick={() => navigate(`/invoices/${invoice.id}`)}
              >
                <TableCell className="py-2">
                  <span className="font-medium text-primary hover:underline">
                    {invoice.invoice_number}
                  </span>
                </TableCell>
                <TableCell className="py-2 text-sm">
                  {format(new Date(invoice.invoice_date), "dd/MM/yyyy")}
                </TableCell>
                <TableCell className="py-2 text-sm">
                  {format(new Date(invoice.due_date), "dd/MM/yyyy")}
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-1.5">
                    <Badge className={`${statusBadge.className} text-xs`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {invoice.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleOpenSettlement(invoice, e)}
                    >
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="py-2 text-right font-medium">
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
                  <p className="text-sm text-muted-foreground">
                    Customer since {new Date(customer.created_at).getFullYear()}
                    <span className="mx-2">·</span>
                    {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
                    {outstandingAmount > 0 && (
                      <>
                        <span className="mx-2">·</span>
                        <span className="text-destructive font-medium">{formatCurrency(outstandingAmount)} outstanding</span>
                      </>
                    )}
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
                <Button
                  variant="outline"
                  onClick={() => setStatementModalOpen(true)}
                >
                  <ScrollText className="h-4 w-4 mr-2" />
                  Issue Statement
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCreditNoteDrawerOpen(true)}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  New Credit Note
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
          <div className="flex gap-6">
            {/* Left Column - Main Content */}
            <div className="flex-1 space-y-6 min-w-0">
            {/* Customer Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Customer Information
                    </CardTitle>
                    <Badge variant="outline">
                      {customer.client_type === "Business" ? "Business" : "Individual"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium truncate">{customer.email || <span className="text-muted-foreground">—</span>}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="font-medium">{customer.phone || <span className="text-muted-foreground">—</span>}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Address</p>
                        {customer.address_line1 || customer.address_line2 || customer.locality || customer.post_code ? (
                          <div className="font-medium text-sm leading-relaxed">
                            {customer.address_line1 && <div>{customer.address_line1}</div>}
                            {customer.address_line2 && <div>{customer.address_line2}</div>}
                            {customer.locality && <div>{customer.locality}</div>}
                            {customer.post_code && <div>{customer.post_code}</div>}
                          </div>
                        ) : customer.address ? (
                          <p className="font-medium whitespace-pre-line">{customer.address}</p>
                        ) : (
                          <p className="font-medium text-muted-foreground">—</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">VAT Number</p>
                        <p className="font-medium">{customer.vat_number || <span className="text-muted-foreground">—</span>}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">VAT Status</p>
                        <Badge variant="outline" className="mt-0.5">{customer.vat_status || "Not set"}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Payment Terms</p>
                        <Badge variant="outline" className="mt-0.5">{customer.payment_terms || "Net 30"}</Badge>
                      </div>
                    </div>
                  </div>
                  {customer.notes && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm">{customer.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Invoices Tabs */}
              <Card>
                <CardHeader>
                  <CardTitle>Invoices</CardTitle>
                  <CardDescription>View and manage invoices for this customer</CardDescription>
                </CardHeader>
                <CardContent>
                <Tabs defaultValue="outstanding" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 max-w-xl">
                      <TabsTrigger value="outstanding" className="flex items-center gap-1.5 text-xs">
                        <Clock className="h-3.5 w-3.5" />
                        Outstanding ({outstandingInvoices.length})
                      </TabsTrigger>
                      <TabsTrigger value="overdue" className="flex items-center gap-1.5 text-xs">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Overdue
                        {overdueInvoices.length > 0 && (
                          <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                            {overdueInvoices.length}
                          </span>
                        )}
                        {overdueInvoices.length === 0 && <span>(0)</span>}
                      </TabsTrigger>
                      <TabsTrigger value="paid" className="flex items-center gap-1.5 text-xs">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Paid ({paidInvoices.length})
                      </TabsTrigger>
                      <TabsTrigger value="all" className="flex items-center gap-1.5 text-xs">
                        <FileText className="h-3.5 w-3.5" />
                        All ({invoices.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="outstanding" className="mt-4">
                      <InvoiceTable invoiceList={outstandingInvoices} />
                    </TabsContent>

                    <TabsContent value="overdue" className="mt-4">
                      <InvoiceTable invoiceList={overdueInvoices} />
                    </TabsContent>

                    <TabsContent value="paid" className="mt-4">
                      <InvoiceTable invoiceList={paidInvoices} />
                    </TabsContent>

                    <TabsContent value="all" className="mt-4">
                      <InvoiceTable invoiceList={invoices} />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Floating Customer Summary */}
            <div className="hidden lg:block w-80 flex-shrink-0">
              <div className="sticky top-6">
                <Card className="shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CreditCard className="h-5 w-5" />
                      Customer Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Total Outstanding - Big Red Number */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Total Outstanding</p>
                      <p className="text-3xl font-bold text-destructive">
                        {formatCurrency(outstandingAmount)}
                      </p>
                    </div>

                    {/* Invoice Stats */}
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Invoices</span>
                        <span className="font-medium">{invoices.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Paid</span>
                        <span className="font-medium text-green-600 dark:text-green-400">{paidInvoices.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Outstanding</span>
                        <span className="font-medium text-yellow-600 dark:text-yellow-400">{outstandingInvoices.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Overdue</span>
                        <span className="font-medium text-destructive">{overdueInvoices.length}</span>
                      </div>
                    </div>

                    {/* Payment Terms */}
                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payment Terms</span>
                        <span className="font-medium">{customer.payment_terms || "Net 30"}</span>
                      </div>
                    </div>

                    {/* Issue Statement Button */}
                    <Button 
                      className="w-full mt-2" 
                      variant="outline"
                      onClick={() => setStatementModalOpen(true)}
                    >
                      <ScrollText className="h-4 w-4 mr-2" />
                      Issue Statement
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Statement Modal */}
      {customer && (
        <StatementModal
          open={statementModalOpen}
          onOpenChange={setStatementModalOpen}
          customer={{
            id: customer.id,
            name: customer.name,
            email: customer.email,
            address: customer.address,
            vat_number: customer.vat_number,
          }}
        />
      )}

      {/* Invoice Settlement Sheet */}
      <InvoiceSettlementSheet
        open={settlementSheetOpen}
        onOpenChange={setSettlementSheetOpen}
        invoice={selectedInvoice}
      />

      {/* Standalone Credit Note Drawer */}
      <CreateCreditNoteDrawer
        open={creditNoteDrawerOpen}
        onOpenChange={setCreditNoteDrawerOpen}
        customerId={customer?.id || ""}
        customerName={customer?.name}
        defaultType="customer_credit"
        onSuccess={() => {
          // Optionally refresh data or show toast
        }}
      />
    </div>
  );
};

export default CustomerDetail;
