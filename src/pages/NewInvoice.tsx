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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ArrowLeft, Download, Zap, Info, Shield, FileText, Library } from "lucide-react";
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
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import { InvoiceErrorBoundary } from "@/components/InvoiceErrorBoundary";
import { invoiceService } from "@/services/invoiceService";
import type { TablesInsert } from '@/integrations/supabase/types';
import type { InvoiceWithCompliance } from '@/types/invoice-compliance';
import { validateDocumentItems } from "@/lib/documentItems";
import { ItemLibraryDrawer } from "@/components/invoice/ItemLibraryDrawer";

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
  address_line1: string | null;
  address_line2: string | null;
  locality: string | null;
  post_code: string | null;
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
  const [discountType, setDiscountType] = useState<'none' | 'amount' | 'percent'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>("");
  const [showDiscountReason, setShowDiscountReason] = useState(false);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const [isQuickMode, setIsQuickMode] = useState(true);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplate[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { template: templateForPreview, isLoading: templateLoading } = useInvoiceTemplate();
  const { settings: companySettings } = useCompanySettings();
  const { settings: bankingSettings } = useBankingSettings();

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, address, address_line1, address_line2, locality, post_code, vat_number, payment_terms")
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

      const invoice = invoiceData as InvoiceWithCompliance;

      setInvoiceNumber(invoice.invoice_number || '');
      setSelectedCustomer(invoice.customer_id || '');
      setInvoiceDate(invoice.invoice_date || invoice.created_at?.split("T")[0] || '');
      setIsIssued(invoice.is_issued || false);
      setIssuedAt(invoice.issued_at || null);
      
      // Handle discount type migration
      const savedType = invoice.discount_type || 'amount';
      const savedValue = Number(invoice.discount_value || 0);
      if (savedValue > 0) {
        setDiscountType(savedType as 'amount' | 'percent');
        setDiscountValue(savedValue);
      } else {
        setDiscountType('none');
        setDiscountValue(0);
      }
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
      
      if (!editCheckResult.canEdit) {
        toast({
          title: "Invoice Issued",
          description: editCheckResult.reason || "This invoice has been issued and cannot be modified.",
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
        .limit(20);

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

      const recent = Array.from(itemMap.values())
        .sort((a, b) => b.usage_count - a.usage_count)
        .slice(0, 10);

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
    
    try {
      await supabase
        .from("services")
        .update({ usage_count: template.usage_count + 1 })
        .eq("id", template.id);
      
      fetchServiceTemplates();
    } catch (error) {
      console.error("Error updating service usage:", error);
    }
    
    toast({
      title: "Item added",
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

    const perRate = new Map<number, number>();
    let subtotal = 0;
    items.forEach((item) => {
      const net = (item.quantity || 0) * (item.unit_price || 0);
      subtotal += net;
      const rate = item.vat_rate || 0;
      perRate.set(rate, (perRate.get(rate) || 0) + net);
    });

    let discountAmount = 0;
    if (discountType === 'percent') {
      const pct = Math.min(Math.max(Number(discountValue) || 0, 0), 100);
      discountAmount = round2(subtotal * (pct / 100));
    } else if (discountType === 'amount') {
      const amt = Math.min(Math.max(Number(discountValue) || 0, 0), subtotal);
      discountAmount = round2(amt);
    }

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
    
    if (isIssued && isEditMode) {
      toast({
        title: "Invoice Already Issued",
        description: "This invoice has been issued and cannot be modified.",
      });
      return;
    }
    
    setLoading(true);

    try {
      if (!selectedCustomer) {
        throw new Error("Please select a customer");
      }

      const validationError = validateDocumentItems(items);
      if (validationError) {
        throw new Error(validationError);
      }

      const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
      const paymentTerms = selectedCustomerData?.payment_terms || "Net 30";
      
      const daysMatch = paymentTerms.match(/\d+/);
      const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
      
      const invoiceDateObj = new Date(invoiceDate);
      const calculatedDueDate = addDays(invoiceDateObj, paymentDays);

      const { taxable, vatTotal, grandTotal } = calculateTotals();

      let finalInvoiceNumber = invoiceNumber || null;
      if (shouldIssue && !finalInvoiceNumber) {
        const { data: generatedNumber, error: numberError } = await callRpc('next_invoice_number', {
          p_business_id: user?.id,
          p_prefix: 'INV-'
        });
        
        if (numberError) throw numberError;
        if (!generatedNumber) throw new Error("Failed to generate invoice number");
        
        finalInvoiceNumber = generatedNumber;
        setInvoiceNumber(generatedNumber);
      }

      // Convert discount type for storage (none -> amount with 0 value)
      const storeDiscountType = discountType === 'none' ? 'amount' : discountType;
      const storeDiscountValue = discountType === 'none' ? 0 : discountValue;

      const invoicePayload = {
        invoice_number: finalInvoiceNumber,
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
        discount_type: storeDiscountType,
        discount_value: storeDiscountValue,
        discount_reason: discountReason || null,
      };

      if (isEditMode && id) {
        const editCheckResult = await invoiceService.canEditInvoice(id);
        
        if (!editCheckResult.canEdit) {
          throw new Error(
            editCheckResult.reason || 
            "This invoice has been issued and cannot be modified."
          );
        }
        
        const draftPayload = shouldIssue 
          ? { ...invoicePayload, is_issued: false, issued_at: null, status: 'draft' as const }
          : invoicePayload;
        
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update(draftPayload)
          .eq("id", id);

        if (invoiceError) throw invoiceError;

        if (!isIssued) {
          try {
            const { error: deleteError } = await supabase
              .from("invoice_items")
              .delete()
              .eq("invoice_id", id);

            if (deleteError) throw deleteError;

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
            if (error.message?.includes("Cannot modify items of issued invoices")) {
              throw new Error(
                "Cannot modify items of issued invoices."
              );
            }
            throw itemError;
          }
        }

        if (shouldIssue) {
          const issueResult = await invoiceService.issueInvoice(id);
          if (!issueResult.success) {
            throw new Error(issueResult.error || "Failed to issue invoice");
          }
        }

        toast({
          title: shouldIssue ? "Invoice issued" : "Invoice updated",
          description: shouldIssue 
            ? `Invoice ${finalInvoiceNumber} has been issued.` 
            : "Invoice has been successfully updated.",
        });
        
        navigate(shouldIssue ? `/invoices/${id}` : "/invoices");
        return;
      } else {
        let finalInvoiceNumber = invoiceNumber || null;
        if (shouldIssue && !finalInvoiceNumber) {
          const { data, error } = await callRpc("next_invoice_number", {
            p_business_id: user?.id,
            p_prefix: "INV-",
          });

          if (error) throw error;
          if (!data) throw new Error("Failed to generate invoice number");
          finalInvoiceNumber = data;
          setInvoiceNumber(data);
        }

        const draftPayload = shouldIssue
          ? {
              ...invoicePayload,
              status: "draft" as const,
              is_issued: false,
              issued_at: null,
              invoice_number: finalInvoiceNumber,
            }
          : {
              ...invoicePayload,
              invoice_number: finalInvoiceNumber,
            };

        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert(draftPayload)
          .select("id")
          .single();

        if (invoiceError) throw invoiceError;
        if (!invoice?.id) throw new Error("Failed to create invoice");

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

        if (shouldIssue) {
          const issueResult = await invoiceService.issueInvoice(invoice.id);
          if (!issueResult.success) {
            throw new Error(issueResult.error || "Failed to issue invoice");
          }
        }

        toast({
          title: shouldIssue ? "Invoice issued" : "Draft saved",
          description: shouldIssue 
            ? `Invoice ${finalInvoiceNumber} has been issued.` 
            : "Invoice saved as draft.",
        });
        
        navigate(shouldIssue ? `/invoices/${invoice.id}` : "/invoices");
        return;
      }

      navigate("/invoices");
    } catch (error) {
      let errorMessage = "An error occurred";
      
      if (error instanceof Error) {
        if (error.message.includes("Cannot modify items of issued invoices") || 
            error.message.includes("issued invoices to remain immutable")) {
          errorMessage = "This invoice has been issued and cannot be modified.";
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

  // Calculate due date for display
  const getDueDate = () => {
    if (!selectedCustomer) return null;
    const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
    const paymentTerms = selectedCustomerData?.payment_terms || "Net 30";
    const daysMatch = paymentTerms.match(/\d+/);
    const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;
    return addDays(new Date(invoiceDate), paymentDays);
  };

  const dueDate = getDueDate();

  // Calculate line total for display
  const getLineTotal = (item: InvoiceItem) => {
    return item.quantity * item.unit_price * (1 + item.vat_rate);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        {/* Modern Header */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              {/* Left: Back + Title + Badge */}
              <div className="flex items-center gap-3 min-w-0">
                <Button variant="ghost" size="sm" asChild className="shrink-0">
                  <Link to="/invoices">
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-lg font-semibold text-foreground truncate">
                    {isEditMode ? "Edit Invoice" : "New Invoice"}
                  </h1>
                  {!isIssued ? (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800 shrink-0">
                      Draft
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800 shrink-0">
                      <Shield className="h-3 w-3 mr-1" />
                      Issued
                    </Badge>
                  )}
                </div>
              </div>

              {/* Right: Quick Mode Toggle - ALWAYS visible */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 shrink-0">
                      <Zap className={`h-4 w-4 ${isQuickMode ? 'text-primary' : 'text-muted-foreground'}`} />
                      <Label htmlFor="quick-mode" className="text-sm font-medium cursor-pointer hidden sm:inline">
                        Quick
                      </Label>
                      <Switch
                        id="quick-mode"
                        checked={isQuickMode}
                        onCheckedChange={setIsQuickMode}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Quick Mode hides discount reason & VAT info</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">
          <form 
            onSubmit={(e) => handleSubmit(e, false)} 
            className={isIssued ? 'opacity-75 pointer-events-none' : ''}
          >
            {/* Issued Invoice Banner */}
            {isIssued && isEditMode && (
              <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <span className="font-medium">Invoice issued on {issuedAt ? format(new Date(issuedAt), "PPP") : 'N/A'}.</span>
                  {" "}This invoice cannot be modified. To make corrections, create a credit note.
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-blue-700 dark:text-blue-300 p-0 h-auto ml-2"
                    onClick={() => navigate(`/credit-notes/new?invoice=${id}`)}
                  >
                    Create Credit Note →
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* 2-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* LEFT COLUMN: Invoice Details + Items */}
              <div className="lg:col-span-2 space-y-4">
                {/* Invoice Details Card - Compact */}
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium">Invoice Details</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Customer */}
                      <div className="col-span-2">
                        <Label htmlFor="customer" className="text-xs text-muted-foreground">Customer *</Label>
                        <Select 
                          value={selectedCustomer} 
                          onValueChange={setSelectedCustomer}
                          disabled={isIssued}
                        >
                          <SelectTrigger className="mt-1 h-9">
                            <SelectValue placeholder="Select customer" />
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

                      {/* Invoice Date */}
                      <div>
                        <Label htmlFor="invoiceDate" className="text-xs text-muted-foreground">Date *</Label>
                        <Input
                          id="invoiceDate"
                          type="date"
                          value={invoiceDate}
                          onChange={(e) => setInvoiceDate(e.target.value)}
                          required
                          disabled={isIssued}
                          className="mt-1 h-9"
                        />
                      </div>

                      {/* Due Date (calculated) */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Due</Label>
                        <Input
                          value={dueDate ? format(dueDate, "dd/MM/yyyy") : "—"}
                          readOnly
                          disabled
                          className="mt-1 h-9 bg-muted/50 text-muted-foreground"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Invoice Items Card - Compact Table */}
                <Card>
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Items</CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLibraryOpen(true)}
                          disabled={isIssued}
                          className="h-7 px-2 text-xs"
                        >
                          <Library className="h-3.5 w-3.5 mr-1" />
                          Library
                        </Button>
                        <Button 
                          type="button" 
                          onClick={addItem} 
                          size="sm"
                          disabled={isIssued}
                          className="h-7 px-2 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 pb-2 pt-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-xs font-medium h-8 pl-4">Description</TableHead>
                            <TableHead className="text-xs font-medium h-8 w-16 text-center">Qty</TableHead>
                            <TableHead className="text-xs font-medium h-8 w-24 text-right">Price (€)</TableHead>
                            <TableHead className="text-xs font-medium h-8 w-20 text-center">VAT</TableHead>
                            <TableHead className="text-xs font-medium h-8 w-24 text-right">Total</TableHead>
                            <TableHead className="h-8 w-10 pr-4"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item, index) => (
                            <TableRow key={index} className="hover:bg-muted/30">
                              <TableCell className="py-1.5 pl-4">
                                <Input
                                  value={item.description}
                                  onChange={(e) => updateItem(index, "description", e.target.value)}
                                  placeholder="Item description"
                                  disabled={isIssued}
                                  className="h-8 text-sm border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                              </TableCell>
                              <TableCell className="py-1.5 px-1">
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                  disabled={isIssued}
                                  className="h-8 text-sm text-center w-14 mx-auto"
                                  min={0}
                                  step={0.01}
                                />
                              </TableCell>
                              <TableCell className="py-1.5 px-1">
                                <Input
                                  type="number"
                                  value={item.unit_price}
                                  onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                                  disabled={isIssued}
                                  className="h-8 text-sm text-right w-20 ml-auto"
                                  min={0}
                                  step={0.01}
                                />
                              </TableCell>
                              <TableCell className="py-1.5 px-1">
                                <Select
                                  value={String(item.vat_rate)}
                                  onValueChange={(v) => updateItem(index, "vat_rate", parseFloat(v))}
                                  disabled={isIssued}
                                >
                                  <SelectTrigger className="h-8 text-sm w-16 mx-auto text-center">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover z-50">
                                    <SelectItem value="0">0%</SelectItem>
                                    <SelectItem value="0.05">5%</SelectItem>
                                    <SelectItem value="0.18">18%</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-1.5 px-1 text-right font-medium text-sm tabular-nums">
                                €{formatNumber(getLineTotal(item), 2)}
                              </TableCell>
                              <TableCell className="py-1.5 pr-4">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItem(index)}
                                  disabled={items.length === 1 || isIssued}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {/* VAT Info - only in detailed mode */}
                    {!isQuickMode && (
                      <div className="mx-4 mt-3 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                        <span className="font-medium">Malta VAT:</span> 18% standard, 5% reduced, 0% exempt
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT SIDEBAR: Summary + Actions */}
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-16 space-y-4">
                  {/* Summary Card */}
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-medium">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                      {/* Compact Discount Row */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Discount</Label>
                          <ToggleGroup
                            type="single"
                            value={discountType}
                            onValueChange={(v) => {
                              if (v) {
                                setDiscountType(v as 'none' | 'amount' | 'percent');
                                if (v === 'none') {
                                  setDiscountValue(0);
                                  setShowDiscountReason(false);
                                }
                              }
                            }}
                            disabled={isIssued}
                            className="h-7"
                          >
                            <ToggleGroupItem value="none" aria-label="None" className="text-xs px-2 h-7">
                              —
                            </ToggleGroupItem>
                            <ToggleGroupItem value="amount" aria-label="Amount" className="text-xs px-2 h-7">
                              €
                            </ToggleGroupItem>
                            <ToggleGroupItem value="percent" aria-label="Percent" className="text-xs px-2 h-7">
                              %
                            </ToggleGroupItem>
                          </ToggleGroup>
                          {discountType !== 'none' && (
                            <Input
                              ref={discountInputRef}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min={0}
                              max={discountType === 'percent' ? 100 : totals.netTotal}
                              value={discountValue || ''}
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
                              placeholder="0"
                              className="w-16 h-7 text-sm"
                            />
                          )}
                        </div>
                        
                        {/* Add reason link - hidden in quick mode */}
                        {!isQuickMode && discountType !== 'none' && discountValue > 0 && !showDiscountReason && (
                          <button
                            type="button"
                            onClick={() => setShowDiscountReason(true)}
                            className="text-xs text-primary hover:underline"
                          >
                            + Add reason
                          </button>
                        )}
                        
                        {/* Discount reason textarea - hidden in quick mode */}
                        {!isQuickMode && showDiscountReason && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-muted-foreground">Reason</Label>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowDiscountReason(false);
                                  setDiscountReason("");
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Remove
                              </button>
                            </div>
                            <Textarea
                              value={discountReason}
                              onChange={(e) => setDiscountReason(e.target.value)}
                              placeholder="Optional discount note"
                              disabled={isIssued}
                              className="h-14 text-sm resize-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Totals - Discount applied BEFORE VAT */}
                      <div className="space-y-1 pt-2 border-t border-border">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="tabular-nums">€{formatNumber(totals.netTotal, 2)}</span>
                        </div>
                        {totals.discountAmount > 0 && (
                          <>
                            <div className="flex justify-between text-xs text-destructive">
                              <span>Discount{discountType === 'percent' ? ` (${discountValue}%)` : ''}</span>
                              <span className="tabular-nums">−€{formatNumber(totals.discountAmount, 2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Taxable Amount</span>
                              <span className="tabular-nums">€{formatNumber(totals.taxable, 2)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">VAT</span>
                          <span className="tabular-nums">€{formatNumber(totals.vatTotal, 2)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-border mt-2">
                          <span className="font-semibold text-sm">Total</span>
                          <span className="text-lg font-bold tabular-nums">€{formatNumber(totals.grandTotal, 2)}</span>
                        </div>
                        {totals.discountAmount > 0 && (
                          <p className="text-[10px] text-muted-foreground pt-1">Discount applied before VAT</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Action Buttons - Compact */}
                  <div className="space-y-2">
                    {!isIssued && (
                      <>
                        <Button 
                          type="button"
                          onClick={(e) => handleSubmit(e as any, true)}
                          disabled={loading}
                          className="w-full h-9 bg-green-600 hover:bg-green-700"
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          {loading ? "Issuing..." : "Save & Issue"}
                        </Button>
                        <Button 
                          type="submit" 
                          variant="outline"
                          disabled={loading}
                          className="w-full h-9"
                        >
                          {loading ? "Saving..." : "Save as Draft"}
                        </Button>
                      </>
                    )}
                    {isEditMode && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleDownloadPDF}
                        disabled={loading}
                        className="w-full h-9"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                    )}
                    {isIssued && isEditMode && (
                      <Button 
                        type="button"
                        variant="destructive"
                        onClick={() => navigate(`/credit-notes/new?invoice=${id}`)}
                        className="w-full h-9"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Create Credit Note
                      </Button>
                    )}
                    <Button 
                      type="button" 
                      variant="ghost" 
                      asChild 
                      className="w-full h-8 text-sm text-muted-foreground"
                    >
                      <Link to="/invoices">Cancel</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </main>
      </div>

      {/* Item Library Drawer */}
      <ItemLibraryDrawer
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        serviceTemplates={serviceTemplates}
        recentItems={recentItems}
        onAddTemplate={addTemplateItem}
        onAddRecentItem={addRecentItem}
      />

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
                  address_line1: customers.find(c => c.id === selectedCustomer)?.address_line1 || undefined,
                  address_line2: customers.find(c => c.id === selectedCustomer)?.address_line2 || undefined,
                  locality: customers.find(c => c.id === selectedCustomer)?.locality || undefined,
                  post_code: customers.find(c => c.id === selectedCustomer)?.post_code || undefined,
                  vat_number: customers.find(c => c.id === selectedCustomer)?.vat_number || undefined,
                },
                items: items,
                totals: {
                  netTotal: totals.taxable,
                  vatTotal: totals.vatTotal,
                  grandTotal: totals.grandTotal,
                },
                discount: totals.discountAmount > 0 ? {
                  type: discountType === 'none' ? 'amount' : discountType,
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
                totalsStyle: templateForPreview?.totals_style || 'right',
                bankingVisibility: templateForPreview?.banking_visibility ?? true,
                bankingStyle: templateForPreview?.banking_style || 'compact',
                marginTop: templateForPreview?.margin_top ?? 1.2,
                marginRight: templateForPreview?.margin_right ?? 1.2,
                marginBottom: templateForPreview?.margin_bottom ?? 1.2,
                marginLeft: templateForPreview?.margin_left ?? 1.2,
              }}
              companySettings={companySettings ? {
                name: companySettings.company_name || '',
                address: companySettings.company_address || undefined,
                addressLine1: companySettings.company_address_line1 || undefined,
                addressLine2: companySettings.company_address_line2 || undefined,
                locality: companySettings.company_locality || undefined,
                postCode: companySettings.company_post_code || undefined,
                email: companySettings.company_email || undefined,
                phone: companySettings.company_phone || undefined,
                taxId: companySettings.company_vat_number || undefined,
                registrationNumber: companySettings.company_registration_number || undefined,
                logo: companySettings.company_logo || undefined,
              } : undefined}
              bankingSettings={bankingSettings ? {
                bankName: bankingSettings.bank_name || undefined,
                accountName: bankingSettings.bank_account_name || undefined,
                iban: bankingSettings.bank_iban || undefined,
                swiftCode: bankingSettings.bank_swift_code || undefined,
              } : undefined}
            />
          </InvoiceErrorBoundary>
        )}
      </div>
    </div>
  );
};

export default NewInvoice;
