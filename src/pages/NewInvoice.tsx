import { useState, useEffect, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft, Download, Zap, Settings2, Clock, Lightbulb, Info, Shield, AlertCircle, FileText } from "lucide-react";
import { Link, useNavigate, useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, addDays } from "date-fns";
import { formatNumber } from "@/lib/utils";
import { UnifiedInvoiceLayout } from "@/components/UnifiedInvoiceLayout";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { generateInvoicePDFWithTemplate } from "@/lib/pdfGenerator";
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import type { InvoiceData } from "@/services/pdfService";
import { InvoiceErrorBoundary } from "@/components/InvoiceErrorBoundary";
import { invoiceService } from "@/services/invoiceService";
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import type { InvoiceWithCompliance } from '@/types/invoice-compliance';

// Type-safe RPC wrapper
type RpcFunction = 'next_invoice_number' | 'next_credit_note_number';

const callRpc = async (
  functionName: RpcFunction,
  params: { p_business_id: string; p_prefix?: string }
): Promise<{ data: string | null; error: any }> => {
  return await supabase.rpc(functionName, params) as any;
};

interface Customer {
  id: string;
  name: string;
  email: string | null;
  address: string | null;
  vat_number: string | null;
  payment_terms: string | null;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  unit: string;
}

interface ServiceTemplate {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  vat_rate: number;
  unit: string;
  category: string | null;
  usage_count: number;
}

interface RecentItem {
  description: string;
  unit_price: number;
  vat_rate: number;
  unit: string;
  usage_count: number;
}

const NewInvoice = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<string>("draft");
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      description: "",
      quantity: 1,
      unit_price: 0,
      vat_rate: 0.18,
      unit: "service",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isIssued, setIsIssued] = useState(false);
  const [issuedAt, setIssuedAt] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>("");
  const discountInputRef = useRef<HTMLInputElement>(null);
  const [isQuickMode, setIsQuickMode] = useState(true);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplate[]>([]);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Load template using unified hook
  const { template: templateForPreview, isLoading: templateLoading } = useInvoiceTemplate();
  
  // Load company and banking settings
  const { settings: companySettings } = useCompanySettings();
  const { settings: bankingSettings } = useBankingSettings();

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, address, vat_number, payment_terms")
        .order("name");

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
    }
  };

  // Generate invoice number using RPC
  const generateInvoiceNumber = async () => {
    try {
      const { data, error } = await callRpc('next_invoice_number', {
        p_business_id: user?.id,
        p_prefix: 'INV-'
      });

      if (error) throw error;
      if (data) {
        setInvoiceNumber(data);
      }
    } catch (error) {
      console.error("Error generating invoice number:", error);
      // Fallback to old method if RPC fails
      try {
        const { data, error } = await supabase
          .from("invoices")
          .select("invoice_number")
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) throw error;

        let nextNumber = 1;
        if (data && data.length > 0) {
          const lastNumber = data[0].invoice_number;
          const match = lastNumber.match(/INV-(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1]) + 1;
          }
        }

        const invoiceNum = `INV-${String(nextNumber).padStart(6, '0')}`;
        setInvoiceNumber(invoiceNum);
      } catch (fallbackError) {
        console.error("Fallback invoice number generation failed:", fallbackError);
      }
    }
  };

  // Issue invoice - assign number and change status
  const handleIssueInvoice = async () => {
    if (!id || !isEditMode) return;
    
    setLoading(true);
    try {
      let finalInvoiceNumber = invoiceNumber;
      
      // If no invoice number exists, generate one
      if (!invoiceNumber) {
        const { data, error } = await callRpc('next_invoice_number', {
          p_business_id: user?.id,
          p_prefix: 'INV-'
        });
        
        if (error) throw error;
        finalInvoiceNumber = data;
        setInvoiceNumber(data);
      }

      // Update invoice with Malta VAT compliance fields
      const updatePayload = {
        invoice_number: finalInvoiceNumber,
        status: 'issued' as const,
        is_issued: true,
        issued_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("invoices")
        .update(updatePayload)
        .eq("id", id);

      if (updateError) throw updateError;
      
      setStatus('issued');
      setIsIssued(true);
      setIssuedAt(new Date().toISOString());
      
      toast({
        title: "Invoice issued",
        description: `Invoice issued: ${finalInvoiceNumber}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to issue invoice",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Pre-select customer if coming from customer page or load invoice data for editing
  const clientId = searchParams.get("client");
  useEffect(() => {
    if (clientId && customers.length > 0) {
      setSelectedCustomer(clientId);
    }
  }, [clientId, customers]);

  // Load invoice data if in edit mode
  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      fetchInvoiceData(id);
    }
  }, [id]);

  const fetchInvoiceData = async (invoiceId: string) => {
    try {
      // First check if invoice can be edited
      const editCheckResult = await invoiceService.canEditInvoice(invoiceId);
      
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select(`
          *,
          invoice_items (
            description,
            quantity,
            unit,
            unit_price,
            vat_rate
          )
        `)
        .eq("id", invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Type the invoice data properly
      const invoice = invoiceData as InvoiceWithCompliance;

      setInvoiceNumber(invoice.invoice_number || '');
      setSelectedCustomer(invoice.customer_id || '');
      setInvoiceDate(invoice.invoice_date || invoice.created_at?.split("T")[0] || '');
      setStatus(invoice.status || 'draft');
      setIsIssued(invoice.is_issued || false);
      setIssuedAt(invoice.issued_at || null);
      setDiscountType((invoice.discount_type || 'amount') as 'amount' | 'percent');
      setDiscountValue(Number(invoice.discount_value || 0));
      setDiscountReason(invoice.discount_reason || '');
      
      if (invoice.invoice_items && invoice.invoice_items.length > 0) {
        setItems(invoice.invoice_items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          vat_rate: Number(item.vat_rate),
          unit: item.unit || 'service',
        })));
      }
      
      // Show warning if invoice cannot be edited
      if (!editCheckResult.canEdit) {
        toast({
          title: "Invoice is Immutable",
          description: editCheckResult.reason || "This invoice has been issued and cannot be modified. Use credit notes for corrections.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load invoice data",
        variant: "destructive",
      });
      navigate("/invoices");
    }
  };

  // Fetch service templates from database
  const fetchServiceTemplates = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("usage_count", { ascending: false })
        .limit(6);

      if (error) throw error;
      setServiceTemplates(data || []);
    } catch (error) {
      console.error("Error fetching service templates:", error);
    }
  };

  // Fetch recently used items
  const fetchRecentItems = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('description, unit_price, vat_rate, unit')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Group by description and count usage
      const itemMap = new Map<string, RecentItem>();
      data?.forEach((item) => {
        const key = `${item.description}`;
        if (itemMap.has(key)) {
          const existing = itemMap.get(key)!;
          existing.usage_count += 1;
        } else {
          itemMap.set(key, {
            description: item.description,
            unit_price: Number(item.unit_price),
            vat_rate: Number(item.vat_rate),
            unit: item.unit || 'service',
            usage_count: 1,
          });
        }
      });

      // Sort by usage count and take top 5
      const recent = Array.from(itemMap.values())
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 5);

      setRecentItems(recent);
    } catch (error) {
      console.error('Error fetching recent items:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCustomers();
      fetchServiceTemplates();
      fetchRecentItems();
    }
  }, [user]);

  useEffect(() => {
    if (searchParams.get('focus') === 'discount') {
      setTimeout(() => discountInputRef.current?.focus(), 0);
    }
  }, [searchParams]);

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0, vat_rate: 0.18, unit: "service" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const addTemplateItem = async (template: ServiceTemplate) => {
    setItems([...items, {
      description: template.name,
      quantity: 1,
      unit_price: template.default_price,
      vat_rate: template.vat_rate,
      unit: template.unit,
    }]);
    
    // Increment usage count in database
    try {
      await supabase
        .from("services")
        .update({ usage_count: template.usage_count + 1 })
        .eq("id", template.id);
      
      // Refresh templates to show updated usage
      fetchServiceTemplates();
    } catch (error) {
      console.error("Error updating service usage:", error);
    }
    
    toast({
      title: "Service added",
      description: `${template.name} added to invoice`,
    });
  };

  const addRecentItem = (item: RecentItem) => {
    setItems([...items, {
      description: item.description,
      quantity: 1,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate,
      unit: item.unit,
    }]);
    toast({
      title: "Item added",
      description: "Recently used item added to invoice",
    });
  };

  const calculateTotals = () => {
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

    // Subtotal per item and per VAT rate
    const perRate = new Map<number, number>();
    let subtotal = 0;
    items.forEach((item) => {
      const net = (item.quantity || 0) * (item.unit_price || 0);
      subtotal += net;
      const rate = item.vat_rate || 0;
      perRate.set(rate, (perRate.get(rate) || 0) + net);
    });

    // Discount amount
    let discountAmount = 0;
    if (discountType === 'percent') {
      const pct = Math.min(Math.max(Number(discountValue) || 0, 0), 100);
      discountAmount = round2(subtotal * (pct / 100));
    } else {
      const amt = Math.min(Math.max(Number(discountValue) || 0, 0), subtotal);
      discountAmount = round2(amt);
    }

    // Allocate discount pro‑rata by net across rates
    let taxable = 0;
    let vatTotal = 0;
    const totalNet = subtotal;
    perRate.forEach((rateNet, rate) => {
      const share = totalNet > 0 ? (rateNet / totalNet) : 0;
      const rateDiscount = round2(discountAmount * share);
      const rateTaxable = Math.max(rateNet - rateDiscount, 0);
      taxable += rateTaxable;
      vatTotal += round2(rateTaxable * rate);
    });

    taxable = round2(taxable);
    vatTotal = round2(vatTotal);
    const grandTotal = round2(taxable + vatTotal);

    return { netTotal: round2(subtotal), discountAmount, taxable, vatTotal, grandTotal };
  };

  const handleSubmit = async (e: React.FormEvent, shouldIssue: boolean = false) => {
    e.preventDefault();
    
    // Prevent submission if invoice is issued
    if (isIssued && isEditMode) {
      toast({
        title: "Cannot Modify Issued Invoice",
        description: "This invoice has been issued and is immutable per Malta VAT regulations. Please create a credit note to make corrections.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      if (!selectedCustomer) {
        throw new Error("Please select a customer");
      }

      if (items.some(item => !item.description || item.quantity <= 0 || item.unit_price < 0)) {
        throw new Error("Please fill in all item details");
      }

      // Get selected customer's payment terms to calculate due date
      const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
      const paymentTerms = selectedCustomerData?.payment_terms || "Net 30";
      
      // Extract number of days from payment terms (e.g., "Net 30" -> 30)
      const daysMatch = paymentTerms.match(/\d+/);
      const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
      
      // Calculate due date from invoice date + payment terms
      const invoiceDateObj = new Date(invoiceDate);
      const calculatedDueDate = addDays(invoiceDateObj, paymentDays);

      const { taxable, vatTotal, grandTotal } = calculateTotals();

      // Type-safe invoice payload
      const invoicePayload = {
        invoice_number: invoiceNumber || null,
        customer_id: selectedCustomer,
        amount: taxable,
        vat_amount: vatTotal,
        total_amount: grandTotal,
        invoice_date: invoiceDate,
        due_date: calculatedDueDate.toISOString().split("T")[0],
        status: shouldIssue ? 'issued' as const : 'draft' as const,
        is_issued: shouldIssue,
        issued_at: shouldIssue ? new Date().toISOString() : null,
        user_id: user?.id,
        vat_rate: items[0]?.vat_rate || 0.18,
        discount_type: discountType,
        discount_value: discountValue,
        discount_reason: discountReason || null,
      };

      if (isEditMode && id) {
        // Check if invoice can be edited before updating
        const editCheckResult = await invoiceService.canEditInvoice(id);
        
        if (!editCheckResult.canEdit) {
          throw new Error(
            editCheckResult.reason || 
            "This invoice has been issued and cannot be modified. Malta VAT regulations require issued invoices to remain immutable. Please create a credit note to make corrections."
          );
        }
        
        // Update existing invoice (only if not issued)
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update(invoicePayload)
          .eq("id", id);

        if (invoiceError) throw invoiceError;

        // Only update invoice items if the invoice is not issued
        // Malta VAT compliance requires issued invoices to be immutable
        if (!isIssued) {
          try {
            // Delete existing items and insert new ones
            const { error: deleteError } = await supabase
              .from("invoice_items")
              .delete()
              .eq("invoice_id", id);

            if (deleteError) throw deleteError;

            // Type-safe items data
            const itemsData: TablesInsert<'invoice_items'>[] = items.map(item => ({
              invoice_id: id,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit || 'service',
              unit_price: item.unit_price,
              vat_rate: item.vat_rate,
            }));

            const { error: itemsError } = await supabase
              .from("invoice_items")
              .insert(itemsData);

            if (itemsError) throw itemsError;
          } catch (itemError) {
            const error = itemError as Error;
            // Handle specific Malta VAT compliance errors
            if (error.message?.includes("Cannot modify items of issued invoices")) {
              throw new Error(
                "Cannot modify items of issued invoices. Malta VAT regulations require issued invoices to remain immutable. Please create a credit note to make corrections to this invoice."
              );
            }
            throw itemError;
          }
        }

        toast({
          title: "Invoice updated",
          description: isIssued 
            ? "Invoice details updated. Items cannot be modified for issued invoices." 
            : "Invoice has been successfully updated.",
        });
      } else {
        // Create new invoice - auto-generate invoice number if issuing
        let finalInvoiceNumber = invoiceNumber;
        
        if (shouldIssue && !invoiceNumber) {
          const { data, error } = await callRpc('next_invoice_number', {
            p_business_id: user?.id,
            p_prefix: 'INV-'
          });
          
          if (error) throw error;
          finalInvoiceNumber = data;
        }
        
        // Type-safe invoice data with number
        const invoiceDataWithNumber = {
          ...invoicePayload,
          invoice_number: finalInvoiceNumber
        };
        
        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert(invoiceDataWithNumber)
          .select("id")
          .single();

        if (invoiceError) throw invoiceError;

        // Type-safe items data
        const itemsData: TablesInsert<'invoice_items'>[] = items.map(item => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || 'service',
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
        }));

        const { error: itemsError } = await supabase
          .from("invoice_items")
          .insert(itemsData);

        if (itemsError) throw itemsError;

        // If issuing, use invoiceService to properly issue the invoice with audit logging
        if (shouldIssue) {
          const issueResult = await invoiceService.issueInvoice(invoice.id);
          if (!issueResult.success) {
            throw new Error(issueResult.error || "Failed to issue invoice");
          }
        }

        toast({
          title: shouldIssue ? "Invoice issued" : "Draft saved",
          description: shouldIssue 
            ? `Invoice ${finalInvoiceNumber} has been issued and is now immutable.` 
            : "Invoice saved as draft. You can edit it until you issue it.",
        });
      }

      navigate("/invoices");
    } catch (error) {
      let errorMessage = "An error occurred";
      
      if (error instanceof Error) {
        // Check for Malta VAT compliance errors
        if (error.message.includes("Cannot modify items of issued invoices") || 
            error.message.includes("issued invoices to remain immutable")) {
          errorMessage = "This invoice has been issued and cannot be modified. Malta VAT regulations require issued invoices to remain immutable for compliance. To make corrections, please create a credit note instead.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setLoading(true);
    try {
      // IMPORTANT: PDF generation now captures from UnifiedInvoiceLayout preview
      // This ensures the PDF matches exactly what the user sees
      
      if (!selectedCustomer) {
        throw new Error("Please select a customer");
      }

      if (!companySettings?.company_name) {
        toast({
          title: 'Company Settings Required',
          description: 'Please complete your company information in Settings before downloading PDFs.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Use edge function to generate PDF from the preview element
      // This captures the exact UnifiedInvoiceLayout HTML
      const filename = `Invoice-${invoiceNumber || 'DRAFT'}`;
      await downloadPdfFromFunction(filename, templateForPreview?.font_family);
      
      toast({ 
        title: 'Success', 
        description: 'Invoice PDF downloaded successfully' 
      });
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to download invoice PDF',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button variant="ghost" asChild>
                    <Link to="/invoices">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Invoices
                    </Link>
                  </Button>
                  <div className="flex items-center gap-3">
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">
                        {isEditMode ? "Edit Invoice" : "New Invoice"}
                      </h1>
                      <p className="text-muted-foreground">
                        {isEditMode ? "Update existing invoice" : "Create a new Malta VAT-compliant invoice"}
                      </p>
                    </div>
                    {!isIssued && (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300">
                        DRAFT
                      </Badge>
                    )}
                    {isIssued && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300">
                        <Shield className="h-3 w-3 mr-1" />
                        ISSUED
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {/* Quick Mode Toggle */}
                  {!isEditMode && (
                    <div className="flex items-center gap-2 mr-4">
                      <Zap className="h-4 w-4 text-primary" />
                      <Label htmlFor="quick-mode" className="text-sm font-medium cursor-pointer">
                        Quick Mode
                      </Label>
                      <Switch
                        id="quick-mode"
                        checked={isQuickMode}
                        onCheckedChange={setIsQuickMode}
                      />
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
          </div>
        </header>

        <main className="p-6">
          <form 
            onSubmit={(e) => handleSubmit(e, false)} 
            className={`space-y-6 ${isIssued ? 'opacity-75 pointer-events-none' : ''}`}
          >
            {/* Malta VAT Compliance Alert */}
            {!isIssued && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>Draft Mode:</strong> This invoice can be edited freely until you issue it. 
                  Once issued, it becomes immutable to comply with Malta VAT regulations. 
                  Any corrections to an issued invoice must be made through a credit note.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Issued Invoice Warning */}
            {isIssued && isEditMode && (
              <Alert variant="destructive" className="border-2 border-red-500 bg-red-50 dark:bg-red-950 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <AlertDescription className="text-red-900 dark:text-red-100">
                      <div className="text-lg font-bold mb-2">🔒 Invoice Issued - Immutable</div>
                      <p className="mb-3">
                        This invoice has been officially issued on {issuedAt ? format(new Date(issuedAt), "PPP 'at' p") : 'N/A'} and 
                        <strong> cannot be modified</strong> in accordance with Malta VAT regulations (VAT Act, Chapter 406). 
                        All issued invoices must remain unchanged to ensure tax compliance and audit integrity.
                      </p>
                      <div className="bg-white dark:bg-red-900 p-3 rounded-md mb-3 border border-red-200 dark:border-red-700">
                        <p className="text-sm font-semibold mb-1">✓ What you can view:</p>
                        <ul className="text-sm space-y-1 ml-4 list-disc">
                          <li>All invoice details and items</li>
                          <li>Download and print the invoice</li>
                          <li>View audit history</li>
                        </ul>
                      </div>
                      <div className="bg-white dark:bg-red-900 p-3 rounded-md border border-red-200 dark:border-red-700">
                        <p className="text-sm font-semibold mb-1">✗ What you cannot do:</p>
                        <ul className="text-sm space-y-1 ml-4 list-disc">
                          <li>Edit customer or invoice details</li>
                          <li>Modify, add, or remove line items</li>
                          <li>Change amounts, dates, or VAT rates</li>
                        </ul>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button
                          type="button"
                          variant="default"
                          size="default"
                          onClick={() => navigate(`/credit-notes/new?invoice=${id}`)}
                          className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Create Credit Note for Corrections
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="default"
                          onClick={() => navigate(`/invoices/${id}`)}
                          className="border-red-300 dark:border-red-700"
                        >
                          View Full Invoice Details
                        </Button>
                      </div>
                    </AlertDescription>
                  </div>
                </div>
              </Alert>
            )}
            
            {/* Service Templates and Recent Items - Only in Quick Mode */}
            {isQuickMode && !isEditMode && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Service Templates */}
                <Card className="border-primary/20">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">Service Templates</CardTitle>
                        <CardDescription>Pre-configured common services</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                   <CardContent>
                    {serviceTemplates.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground mb-3">
                          No services yet. Add common services to save time.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/services')}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Manage Services
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {serviceTemplates.map((template) => (
                          <Button
                            key={template.id}
                            type="button"
                            variant="outline"
                            className="w-full justify-start h-auto py-3 px-4"
                            onClick={() => addTemplateItem(template)}
                          >
                            <div className="flex flex-col items-start w-full">
                              <div className="flex items-center justify-between w-full">
                                <span className="font-semibold">{template.name}</span>
                                <div className="flex items-center gap-2">
                                  {template.usage_count > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {template.usage_count}x
                                    </Badge>
                                  )}
                                  <Badge variant="secondary">
                                    €{template.default_price}/{template.unit}
                                  </Badge>
                                </div>
                              </div>
                              {template.description && (
                                <span className="text-xs text-muted-foreground mt-1">
                                  {template.description} • VAT {(template.vat_rate * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recently Used Items */}
                <Card className="border-primary/20">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-lg">Recently Used</CardTitle>
                        <CardDescription>Your frequently invoiced items</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {recentItems.length > 0 ? (
                      <div className="space-y-2">
                        {recentItems.map((item, idx) => (
                          <Button
                            key={idx}
                            type="button"
                            variant="outline"
                            className="w-full justify-start h-auto py-3 px-4"
                            onClick={() => addRecentItem(item)}
                          >
                            <div className="flex flex-col items-start w-full">
                              <div className="flex items-center justify-between w-full">
                                <span className="font-semibold text-sm">{item.description}</span>
                                <Badge variant="outline" className="ml-2">
                                  Used {item.usage_count}x
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground mt-1">
                                €{formatNumber(item.unit_price, 2)} • VAT {(item.vat_rate * 100).toFixed(0)}%
                              </span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground text-center py-6">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No recent items yet</p>
                        <p className="text-xs mt-1">Items you frequently invoice will appear here</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Invoice Details */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customer">Customer *</Label>
                      <Select 
                        value={selectedCustomer} 
                        onValueChange={setSelectedCustomer}
                        disabled={isIssued}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                      <Input
                        id="invoiceNumber"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder={isEditMode ? (invoiceNumber ? invoiceNumber : "Auto-assigned") : "Will be assigned automatically"}
                        required
                        readOnly={true}
                        disabled={false}
                      />
                      {!isEditMode && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Invoice numbers are assigned automatically and sequentially per EU VAT requirements
                        </p>
                      )}
                      {isEditMode && invoiceNumber && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Invoice numbers are assigned automatically and cannot be changed. To correct an issued invoice, create a credit note.
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="invoiceDate">Invoice Date *</Label>
                      <Input
                        id="invoiceDate"
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        required
                        disabled={isIssued}
                      />
                    </div>
                    
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select 
                          value={status} 
                          onValueChange={setStatus}
                          disabled={isIssued}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  
                  {selectedCustomer && (
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      <strong>Due Date Preview:</strong> {(() => {
                        const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
                        const paymentTerms = selectedCustomerData?.payment_terms || "Net 30";
                        const daysMatch = paymentTerms.match(/\d+/);
                        const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
                        const calculatedDueDate = addDays(new Date(invoiceDate), paymentDays);
                        return format(calculatedDueDate, "PPP");
                      })()}
                      <br />
                      <strong>Payment Terms:</strong> {customers.find(c => c.id === selectedCustomer)?.payment_terms || "Net 30"}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Invoice Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Summary</CardTitle>
                </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Discount Type</Label>
                      <ToggleGroup
                        type="single"
                        value={discountType}
                        onValueChange={(v) => v && setDiscountType(v as 'amount' | 'percent')}
                        disabled={isIssued}
                      >
                        <ToggleGroupItem value="amount" aria-label="Amount (€)" disabled={isIssued}>
                          Amount (€)
                        </ToggleGroupItem>
                        <ToggleGroupItem value="percent" aria-label="Percent (%)" disabled={isIssued}>
                          Percent (%)
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="discountValue">Discount</Label>
                        <Input
                          id="discountValue"
                          ref={discountInputRef}
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min={0}
                          max={discountType === 'percent' ? 100 : totals.netTotal}
                          value={discountValue}
                          onChange={(e) => {
                            let v = parseFloat(e.target.value);
                            if (isNaN(v)) v = 0;
                            if (discountType === 'percent') {
                              v = Math.max(0, Math.min(100, v));
                            } else {
                              v = Math.max(0, Math.min(totals.netTotal, v));
                            }
                            setDiscountValue(v);
                          }}
                          disabled={isIssued}
                          readOnly={isIssued}
                        />
                        {discountType === 'percent' ? (
                          <p className="text-xs text-muted-foreground mt-1">Allowed: 0–100%</p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">Max: €{formatNumber(totals.netTotal, 2)}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="discountReason">Reason (optional)</Label>
                        <Textarea
                          id="discountReason"
                          placeholder="Add a note for this discount"
                          value={discountReason}
                          onChange={(e) => setDiscountReason(e.target.value)}
                          disabled={isIssued}
                          readOnly={isIssued}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">Calculation order: Subtotal → Discount → Taxable → VAT → Total</p>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>€{formatNumber(totals.netTotal, 2)}</span>
                      </div>
                      {totals.discountAmount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Discount</span>
                          <span>
                            —€{formatNumber(totals.discountAmount, 2)}
                            {discountType === 'percent' && (
                              <> ({formatNumber(Number(discountValue), 2)}%)</>
                            )}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Taxable Amount</span>
                        <span>€{formatNumber(totals.taxable, 2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VAT</span>
                        <span>€{formatNumber(totals.vatTotal, 2)}</span>
                      </div>
                      <div className="border-t pt-3">
                        <div className="flex justify-between font-bold">
                          <span>Total</span>
                          <span>€{formatNumber(totals.grandTotal, 2)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
              </Card>
            </div>

            {/* Invoice Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Invoice Items</CardTitle>
                    {isQuickMode && (
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Lightbulb className="h-3 w-3" />
                        Click templates above to quickly add items
                      </CardDescription>
                    )}
                  </div>
                  <Button 
                    type="button" 
                    onClick={addItem} 
                    size="sm"
                    disabled={isIssued}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 border rounded-lg">
                      <div className="md:col-span-2">
                        <Label>Description *</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="Service description"
                          required
                          disabled={isIssued}
                          readOnly={isIssued}
                        />
                      </div>
                      
                      {/* Show simplified fields in Quick Mode */}
                      {isQuickMode ? (
                        <>
                          <div>
                            <Label>Quantity *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              required
                              disabled={isIssued}
                              readOnly={isIssued}
                            />
                          </div>
                          
                          <div>
                            <Label>Unit Price (€) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              required
                              disabled={isIssued}
                              readOnly={isIssued}
                            />
                          </div>
                          
                          <div>
                            <Label className="flex items-center gap-1">
                              VAT Rate
                              <span className="text-xs text-muted-foreground">(Malta)</span>
                            </Label>
                            <Select 
                              value={item.vat_rate.toString()} 
                              onValueChange={(value) => updateItem(index, 'vat_rate', parseFloat(value))}
                              disabled={isIssued}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="0">
                                  <div className="flex items-center gap-2">
                                    <span>0% (Exempt)</span>
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                </SelectItem>
                                <SelectItem value="0.05">
                                  <div>
                                    <div>5% (Reduced)</div>
                                    <div className="text-xs text-muted-foreground">Books, food, medical</div>
                                  </div>
                                </SelectItem>
                                <SelectItem value="0.18">
                                  <div>
                                    <div>18% (Standard)</div>
                                    <div className="text-xs text-muted-foreground">Most services & goods</div>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                              VAT: €{formatNumber(item.quantity * item.unit_price * item.vat_rate, 2)}
                            </p>
                          </div>
                          
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeItem(index)}
                              disabled={items.length === 1 || isIssued}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Advanced Mode - All Fields */}
                          <div>
                            <Label>Quantity *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              required
                              disabled={isIssued}
                              readOnly={isIssued}
                            />
                          </div>
                          
                          <div>
                            <Label>Unit Price (€) *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              required
                              disabled={isIssued}
                              readOnly={isIssued}
                            />
                          </div>
                          
                          <div>
                            <Label>VAT Rate</Label>
                            <Select 
                              value={item.vat_rate.toString()} 
                              onValueChange={(value) => updateItem(index, 'vat_rate', parseFloat(value))}
                              disabled={isIssued}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="0">0% (Exempt)</SelectItem>
                                <SelectItem value="0.05">5% (Reduced)</SelectItem>
                                <SelectItem value="0.18">18% (Standard)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                              VAT: €{formatNumber(item.quantity * item.unit_price * item.vat_rate, 2)}
                            </p>
                          </div>
                          
                          <div className="flex items-end">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeItem(index)}
                              disabled={items.length === 1 || isIssued}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* VAT Help Text */}
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-900 dark:text-blue-100">
                      <p className="font-semibold mb-1">Malta VAT Rates Guide:</p>
                      <ul className="space-y-0.5 ml-4 list-disc">
                        <li><strong>18% (Standard)</strong>: Most goods and services, consulting, professional services</li>
                        <li><strong>5% (Reduced)</strong>: Books, newspapers, certain food items, medical equipment</li>
                        <li><strong>0% (Exempt)</strong>: Educational services, medical services, financial services</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" asChild>
                <Link to="/invoices">Back to Invoices</Link>
              </Button>
              {isEditMode && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleDownloadPDF}
                  disabled={loading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              )}
              {!isIssued && (
                <>
                  <Button 
                    type="submit" 
                    variant="outline"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save as Draft"}
                  </Button>
                  <Button 
                    type="button"
                    onClick={(e) => handleSubmit(e as any, true)}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    {loading ? "Issuing..." : "Save & Issue"}
                  </Button>
                </>
              )}
              {isIssued && isEditMode && (
                <>
                  <Button 
                    type="button"
                    variant="default"
                    onClick={() => navigate(`/credit-notes/new?invoice=${id}`)}
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Create Credit Note
                  </Button>
                </>
              )}
            </div>
          </form>
        </main>
      </div>

      {/* Hidden Font Injector for Google Font based on template */}
      <div style={{ display: 'none' }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent((templateForPreview as any)?.font_family || 'Inter')}:wght@400;600;700&display=swap`}
          rel="stylesheet"
        />
      </div>

      {/* A4 canvas + template CSS variables */}
      <style>{`
        @page { size: A4; margin: 0; }
        #invoice-preview-root{
          --font: '${(templateForPreview as any)?.font_family || 'Inter'}', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          --color-primary: ${(templateForPreview as any)?.primary_color || '#111827'};
          --color-accent: ${(templateForPreview as any)?.accent_color || '#2563EB'};
          --th-bg: ${(templateForPreview as any)?.line_item_header_bg || '#F3F4F6'};
          --th-text: ${(templateForPreview as any)?.line_item_header_text || '#111827'};

          /* margins (cm) */
          --m-top: ${typeof (templateForPreview as any)?.margin_top === 'number' ? `${(templateForPreview as any).margin_top}cm` : '1.2cm'};
          --m-right: ${typeof (templateForPreview as any)?.margin_right === 'number' ? `${(templateForPreview as any).margin_right}cm` : '1.2cm'};
          --m-bottom: ${typeof (templateForPreview as any)?.margin_bottom === 'number' ? `${(templateForPreview as any).margin_bottom}cm` : '1.2cm'};
          --m-left: ${typeof (templateForPreview as any)?.margin_left === 'number' ? `${(templateForPreview as any).margin_left}cm` : '1.2cm'};

          width: 21cm; min-height: 29.7cm; background:#fff; color: var(--color-primary);
          font-family: var(--font);
          box-sizing: border-box; position: relative;
        }
        #invoice-inner{
          padding-top: var(--m-top);
          padding-right: var(--m-right);
          padding-bottom: var(--m-bottom);
          padding-left: var(--m-left);
        }
        table.items{ width:100%; border-collapse:collapse; font-size:10pt; }
        table.items th{
          background: var(--th-bg); color: var(--th-text);
          padding: 8pt; text-align:left; border-bottom: 1px solid #E5E7EB;
        }
        table.items td{ padding: 8pt; border-bottom: 1px solid #E5E7EB; }
        .totals{ width:45%; margin-left:auto; font-size:10pt; margin-top:8pt; }
        .totals .row{ display:grid; grid-template-columns:1fr auto; padding:4pt 0; }
        .totals .row.total{ font-weight:700; border-top:1px solid #E5E7EB; padding-top:8pt; }
      `}</style>

      {/* Hidden A4 DOM used for 1:1 export */}
      <div style={{ display: 'none' }}>
        {selectedCustomer && templateForPreview && !templateLoading && (
          <InvoiceErrorBoundary fallback={
            <div className="p-4 bg-red-50 text-red-800">
              Error rendering invoice preview. Please check template settings.
            </div>
          }>
            <UnifiedInvoiceLayout
              id="invoice-preview-root"
              variant="pdf"
              templateId={templateForPreview?.id}
              debug={false}
              invoiceData={{
                invoiceNumber: invoiceNumber,
                invoiceDate: invoiceDate,
                dueDate: (() => {
                  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
                  const paymentTerms = selectedCustomerData?.payment_terms || "Net 30";
                  const daysMatch = paymentTerms.match(/\d+/);
                  const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
                  const invoiceDateObj = new Date(invoiceDate);
                  const calculatedDueDate = addDays(invoiceDateObj, paymentDays);
                  return calculatedDueDate.toISOString().split("T")[0];
                })(),
                customer: {
                  name: customers.find(c => c.id === selectedCustomer)?.name || '',
                  email: customers.find(c => c.id === selectedCustomer)?.email || undefined,
                  address: customers.find(c => c.id === selectedCustomer)?.address || undefined,
                  vat_number: customers.find(c => c.id === selectedCustomer)?.vat_number || undefined,
                },
                items: items,
                totals: {
                  netTotal: totals.taxable,
                  vatTotal: totals.vatTotal,
                  grandTotal: totals.grandTotal,
                },
                discount: totals.discountAmount > 0 ? {
                  type: discountType,
                  value: discountValue,
                  amount: totals.discountAmount,
                } : undefined,
              }}
              templateSettings={{
                primaryColor: templateForPreview.primary_color,
                accentColor: templateForPreview.accent_color,
                fontFamily: templateForPreview.font_family,
                fontSize: templateForPreview.font_size,
                layout: templateForPreview?.layout || 'default',
                headerLayout: templateForPreview?.header_layout || 'default',
                tableStyle: templateForPreview?.table_style || 'default',
                totalsStyle: templateForPreview?.totals_style || 'default',
                bankingVisibility: templateForPreview?.banking_visibility !== false,
                bankingStyle: templateForPreview?.banking_style || 'default',
                marginTop: templateForPreview?.margin_top || 20,
                marginRight: templateForPreview?.margin_right || 20,
                marginBottom: templateForPreview?.margin_bottom || 20,
                marginLeft: templateForPreview?.margin_left || 20
              }}
              companySettings={companySettings ? {
                name: companySettings.company_name,
                email: companySettings.company_email,
                phone: companySettings.company_phone,
                address: companySettings.company_address,
                city: companySettings.company_city,
                state: companySettings.company_state,
                zipCode: companySettings.company_zip_code,
                country: companySettings.company_country,
                taxId: companySettings.company_vat_number,
                registrationNumber: companySettings.company_registration_number,
                logo: companySettings.company_logo,
              } : undefined}
              bankingSettings={bankingSettings ? {
                bankName: bankingSettings.bank_name,
                accountName: bankingSettings.bank_account_name,
                iban: bankingSettings.bank_iban,
                swiftCode: bankingSettings.bank_swift_code,
              } : undefined}
            />
          </InvoiceErrorBoundary>
        )}
      </div>
    </div>
  );
};

export default NewInvoice;