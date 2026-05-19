import { useState, useEffect, useRef, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Plus, Trash2, ArrowLeft, Download, Info, Shield, FileText, Library, Loader2, CheckCircle2, User, StickyNote } from "lucide-react";
import { Link, useNavigate, useSearchParams, useParams, useBlocker } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, addDays, formatDistanceToNow } from "date-fns";
import { formatNumber } from "@/lib/utils";
import { UnifiedInvoiceLayout, TemplateStyle } from "@/components/UnifiedInvoiceLayout";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { useInvoiceSettings } from "@/hooks/useInvoiceSettings";
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import { InvoiceErrorBoundary } from "@/components/InvoiceErrorBoundary";
import { invoiceService } from "@/services/invoiceService";
import type { TablesInsert } from '@/integrations/supabase/types';
import type { InvoiceWithCompliance } from '@/types/invoice-compliance';
import { validateDocumentItems } from "@/lib/documentItems";
import { ItemLibraryDrawer } from "@/components/invoice/ItemLibraryDrawer";
import { RecurringScheduleCard } from "@/components/RecurringScheduleCard";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";

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
  notes: string | null;
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
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isIssued, setIsIssued] = useState(false);
  const [issuedAt, setIssuedAt] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<'none' | 'amount' | 'percent'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>("");
  const discountInputRef = useRef<HTMLInputElement>(null);
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [downloadAfterIssue, setDownloadAfterIssue] = useState(true);
  const [setupRecurringAfterIssue, setSetupRecurringAfterIssue] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplate[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [nextNumberPreview, setNextNumberPreview] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  // Template style now comes directly from templateForPreview.style

  // Resume draft state
  interface ResumeDraft { id: string; customerName: string; totalAmount: number; savedAt: Date; }
  const [resumeDraft, setResumeDraft] = useState<ResumeDraft | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);

  // Autosave state
  const [autosaveDraftId, setAutosaveDraftId] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);
  const autosaveDraftIdRef = useRef<string | null>(null);
  const autosaveInitializedRef = useRef(false);

  // Unsaved changes guard
  const [isDirty, setIsDirty] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { template: templateForPreview, isLoading: templateLoading } = useInvoiceTemplate();
  const { settings: companySettings } = useCompanySettings();
  const { settings: bankingSettings } = useBankingSettings();
  const { settings: invoiceSettings } = useInvoiceSettings();

  const { blocker, confirmAndProceed, cancelNavigation } = useUnsavedChangesGuard(isDirty);

  const defaultVatRate = invoiceSettings?.vat_rate_standard
    ? invoiceSettings.vat_rate_standard / 100
    : 0.18;

  // Fetch next invoice number preview (read-only, no increment)
  useEffect(() => {
    if (isEditMode || invoiceNumber || !user?.id) return;
    const fetchPreview = async () => {
      const prefix = invoiceSettings?.numbering_prefix || 'INV-';
      const year = new Date().getFullYear();
      const { data } = await supabase
        .from('invoice_counters')
        .select('last_seq')
        .eq('business_id', user.id)
        .eq('year', year)
        .maybeSingle();
      const nextSeq = (data?.last_seq ?? 0) + 1;
      setNextNumberPreview(`${prefix}${year}-${String(nextSeq).padStart(3, '0')}`);
    };
    fetchPreview();
  }, [isEditMode, invoiceNumber, user?.id, invoiceSettings?.numbering_prefix]);

  // Auto-populate default notes for new invoices
  useEffect(() => {
    if (!isEditMode && invoiceSettings?.default_invoice_notes && !notes) {
      setNotes(invoiceSettings.default_invoice_notes);
    }
  }, [isEditMode, invoiceSettings?.default_invoice_notes]);

  // Initialize items with correct default VAT rate once settings load
  useEffect(() => {
    if (items.length === 0 && !isEditMode) {
      setItems([{ description: "", quantity: 1, unit_price: 0, vat_rate: defaultVatRate, unit: "service" }]);
    }
  }, [defaultVatRate, isEditMode]);

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, address, address_line1, address_line2, locality, post_code, vat_number, payment_terms, notes")
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

  // Generate invoice number using RPC - ONLY called when issuing, not on mount
  const generateInvoiceNumber = async (): Promise<string | null> => {
    try {
      const prefix = invoiceSettings?.numbering_prefix || 'INV-';
      const { data, error } = await callRpc('next_invoice_number', {
        p_business_id: user?.id,
        p_prefix: prefix
      });

      if (error) throw error;
      if (data) {
        setInvoiceNumber(data);
        return data;
      }
      return null;
    } catch (error) {
      console.error("Error generating invoice number:", error);
      toast({
        title: "Error",
        description: "Failed to generate invoice number. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };

  // Pre-select customer if coming from customer page or load invoice data for editing
  const clientId = searchParams.get("client");
  useEffect(() => {
    if (clientId && customers.length > 0) {
      setSelectedCustomer(clientId);
    }
  }, [clientId, customers]);

  // Auto-reveal customer info panel when the selected customer has notes
  useEffect(() => {
    if (selectedCustomer && customers.length > 0) {
      const customer = customers.find(c => c.id === selectedCustomer);
      if (customer?.notes) setShowCustomerInfo(true);
    }
  }, [selectedCustomer, customers]);

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
      setNotes((invoice as any).notes || '');
      
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

  // On mount for new invoices: check localStorage for an unfinished draft
  const DRAFT_KEY = 'malta-invoice-draft';
  useEffect(() => {
    if (id || !user?.id) return; // Edit mode — skip
    const stored = localStorage.getItem(DRAFT_KEY);
    if (!stored) return;
    try {
      const { id: draftId, savedAt } = JSON.parse(stored);
      const age = Date.now() - new Date(savedAt).getTime();
      if (age > 7 * 24 * 60 * 60 * 1000) { localStorage.removeItem(DRAFT_KEY); return; }
      // Verify still in DB and still a draft
      supabase
        .from('invoices')
        .select('id, total_amount, customers(name)')
        .eq('id', draftId)
        .eq('status', 'draft')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setResumeDraft({
              id: data.id,
              customerName: (data.customers as any)?.name || 'No customer selected',
              totalAmount: data.total_amount || 0,
              savedAt: new Date(savedAt),
            });
            setShowResumeModal(true);
          } else {
            localStorage.removeItem(DRAFT_KEY);
          }
        });
    } catch { localStorage.removeItem(DRAFT_KEY); }
  }, [id, user?.id]);

  const handleResumeDraft = () => {
    if (!resumeDraft) return;
    setShowResumeModal(false);
    navigate(`/invoices/edit/${resumeDraft.id}`);
  };

  const handleKeepAndStartNew = () => {
    // Draft stays in DB and visible in the invoice list — just clear the localStorage pointer
    localStorage.removeItem(DRAFT_KEY);
    setShowResumeModal(false);
    setResumeDraft(null);
  };

  const handleDiscardDraft = async () => {
    if (!resumeDraft) return;
    setShowResumeModal(false);
    localStorage.removeItem(DRAFT_KEY);
    await supabase.from('invoices').delete().eq('id', resumeDraft.id);
    setResumeDraft(null);
  };

  // Always-current snapshot of form data (prevents stale closures in autosave)
  const formDataRef = useRef({
    selectedCustomer, invoiceDate, items, discountType, discountValue,
    discountReason, notes, isIssued, isEditMode, id,
  });
  useEffect(() => {
    formDataRef.current = {
      selectedCustomer, invoiceDate, items, discountType, discountValue,
      discountReason, notes, isIssued, isEditMode, id,
    };
  });

  const performAutosave = useCallback(async () => {
    const {
      selectedCustomer, invoiceDate, items, discountType, discountValue,
      discountReason, notes, isIssued, isEditMode, id: formId,
    } = formDataRef.current;
    const currentDraftId = autosaveDraftIdRef.current;

    if (isIssued || isSavingRef.current || !user?.id) return;

    // Only autosave new invoices when there's meaningful content
    const hasContent = !!selectedCustomer || items.some(i => i.description.trim() !== '' || i.unit_price > 0);
    if (!isEditMode && !currentDraftId && !hasContent) return;

    isSavingRef.current = true;
    setAutosaveStatus('saving');

    try {
      // Inline totals calc (mirrors calculateTotals)
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
        discountAmount = round2(subtotal * (Math.min(Math.max(Number(discountValue) || 0, 0), 100) / 100));
      } else if (discountType === 'amount') {
        discountAmount = round2(Math.min(Math.max(Number(discountValue) || 0, 0), subtotal));
      }
      let taxable = 0;
      let vatTotal = 0;
      perRate.forEach((rateNet, rate) => {
        const share = subtotal > 0 ? rateNet / subtotal : 0;
        const rateTaxable = Math.max(rateNet - round2(discountAmount * share), 0);
        taxable += rateTaxable;
        vatTotal += round2(rateTaxable * rate);
      });
      taxable = round2(taxable);
      vatTotal = round2(vatTotal);
      const grandTotal = round2(taxable + vatTotal);

      const defaultDays = invoiceSettings?.default_payment_days || companySettings?.default_payment_terms || 30;
      const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
      let paymentDays = defaultDays;
      if (selectedCustomerData?.payment_terms) {
        const m = selectedCustomerData.payment_terms.match(/\d+/);
        if (m) paymentDays = parseInt(m[0]);
      }
      const dueDateStr = addDays(new Date(invoiceDate), paymentDays).toISOString().split('T')[0];

      const storeDiscountType = discountType === 'none' ? 'amount' : discountType;
      const storeDiscountValue = discountType === 'none' ? 0 : discountValue;

      const payload = {
        customer_id: selectedCustomer || null,
        amount: taxable,
        vat_amount: vatTotal,
        total_amount: grandTotal,
        invoice_date: invoiceDate,
        due_date: dueDateStr,
        status: 'draft' as const,
        is_issued: false,
        user_id: user.id,
        vat_rate: items[0]?.vat_rate || 0.18,
        discount_type: storeDiscountType,
        discount_value: storeDiscountValue,
        discount_reason: discountReason || null,
        notes: notes || null,
      };

      const effectiveId = isEditMode ? formId : currentDraftId;

      if (effectiveId) {
        await supabase.from('invoices').update(payload).eq('id', effectiveId);
        await supabase.from('invoice_items').delete().eq('invoice_id', effectiveId);
        if (items.length > 0) {
          await supabase.from('invoice_items').insert(
            items.map(item => ({
              invoice_id: effectiveId,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit || 'service',
              unit_price: item.unit_price,
              vat_rate: item.vat_rate,
            }))
          );
        }
      } else {
        // Create the first autosave draft
        const { data: newInvoice, error } = await supabase
          .from('invoices')
          .insert({ ...payload, invoice_number: null })
          .select('id')
          .single();

        if (error) throw error;
        if (newInvoice?.id) {
          setAutosaveDraftId(newInvoice.id);
          autosaveDraftIdRef.current = newInvoice.id;
          localStorage.setItem(DRAFT_KEY, JSON.stringify({ id: newInvoice.id, savedAt: new Date().toISOString() }));
          if (items.length > 0) {
            await supabase.from('invoice_items').insert(
              items.map(item => ({
                invoice_id: newInvoice.id,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit || 'service',
                unit_price: item.unit_price,
                vat_rate: item.vat_rate,
              }))
            );
          }
          // Update URL to edit path without re-rendering the component
          window.history.replaceState({}, '', `/invoices/edit/${newInvoice.id}`);
        }
      }

      // Refresh localStorage timestamp on every successful save
      const existingDraft = localStorage.getItem(DRAFT_KEY);
      if (existingDraft) {
        const parsed = JSON.parse(existingDraft);
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...parsed, savedAt: new Date().toISOString() }));
      }

      setLastSavedAt(new Date());
      setAutosaveStatus('saved');
    } catch (e) {
      console.error('Autosave error:', e);
      setAutosaveStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, [user?.id, invoiceSettings, companySettings, customers]);

  // Debounced autosave — fires 3 s after the last form change
  useEffect(() => {
    if (!autosaveInitializedRef.current) {
      autosaveInitializedRef.current = true;
      return;
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(performAutosave, 3000);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer, invoiceDate, items, discountType, discountValue, discountReason, notes]);

  // Save immediately when the user switches away (tab/window)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        performAutosave();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [performAutosave]);

  useEffect(() => {
    if (searchParams.get('focus') === 'discount') {
      setTimeout(() => discountInputRef.current?.focus(), 0);
    }
  }, [searchParams]);

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0, vat_rate: defaultVatRate, unit: "service" }]);
    setIsDirty(true);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
      setIsDirty(true);
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setIsDirty(true);
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

  const performSubmit = async (shouldIssue: boolean = false, skipNavigate: boolean = false): Promise<string | null> => {
    // Cancel any pending autosave to avoid conflicts
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    // If autosave already created a draft, treat this as an edit of that draft
    const effectiveId = id || autosaveDraftId;
    const effectiveEditMode = isEditMode || !!autosaveDraftId;

    if (isIssued && effectiveEditMode) {
      toast({
        title: "Invoice Already Issued",
        description: "This invoice has been issued and cannot be modified.",
      });
      return null;
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
      const customerTerms = selectedCustomerData?.payment_terms;
      const defaultDays = invoiceSettings?.default_payment_days || companySettings?.default_payment_terms || 30;
      
      let paymentDays = defaultDays;
      if (customerTerms) {
        const daysMatch = customerTerms.match(/\d+/);
        if (daysMatch) paymentDays = parseInt(daysMatch[0]);
      }
      
      const invoiceDateObj = new Date(invoiceDate);
      const calculatedDueDate = addDays(invoiceDateObj, paymentDays);

      const { taxable, vatTotal, grandTotal } = calculateTotals();

      let finalInvoiceNumber = invoiceNumber || null;
      if (shouldIssue && !finalInvoiceNumber) {
        const issuePrefix = invoiceSettings?.numbering_prefix || 'INV-';
        const { data: generatedNumber, error: numberError } = await callRpc('next_invoice_number', {
          p_business_id: user?.id,
          p_prefix: issuePrefix
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
        notes: notes || null,
      };

      if (effectiveEditMode && effectiveId) {
        const editCheckResult = await invoiceService.canEditInvoice(effectiveId);

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
          .eq("id", effectiveId);

        if (invoiceError) throw invoiceError;

        if (!isIssued) {
          try {
            const { error: deleteError } = await supabase
              .from("invoice_items")
              .delete()
              .eq("invoice_id", effectiveId);

            if (deleteError) throw deleteError;

            const itemsData: TablesInsert<'invoice_items'>[] = items.map(item => ({
              invoice_id: effectiveId,
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
          const issueResult = await invoiceService.issueInvoice(effectiveId);
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

        localStorage.removeItem(DRAFT_KEY);
        setIsDirty(false);
        navigate(shouldIssue
          ? `/invoices/${effectiveId}${setupRecurringAfterIssue ? "?recurring=1" : ""}`
          : "/invoices");
        return finalInvoiceNumber;
      } else {
        let finalInvoiceNumber = invoiceNumber || null;
        if (shouldIssue && !finalInvoiceNumber) {
          const newPrefix = invoiceSettings?.numbering_prefix || 'INV-';
          const { data, error } = await callRpc("next_invoice_number", {
            p_business_id: user?.id,
            p_prefix: newPrefix,
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

        localStorage.removeItem(DRAFT_KEY);
        setIsDirty(false);
        if (!skipNavigate) navigate(shouldIssue
          ? `/invoices/${invoice.id}${setupRecurringAfterIssue ? "?recurring=1" : ""}`
          : "/invoices");
        return finalInvoiceNumber;
      }

      localStorage.removeItem(DRAFT_KEY);
      if (!skipNavigate) navigate("/invoices");
      return null;
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
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent, shouldIssue: boolean = false) => {
    e.preventDefault();
    if (shouldIssue) {
      setShowIssueModal(true);
    } else {
      performSubmit(false);
    }
  };

  const handleIssueConfirm = async () => {
    setShowIssueModal(false);
    const issuedNumber = await performSubmit(true);
    if (downloadAfterIssue) {
      await handleDownloadPDF(issuedNumber ?? undefined);
    }
  };

  const handleDownloadPDF = async (numberOverride?: string) => {
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

      const filename = `Invoice-${numberOverride || invoiceNumber || 'DRAFT'}`;
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
                  {!isEditMode && !invoiceNumber && nextNumberPreview && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-xs shrink-0 whitespace-nowrap cursor-default">
                            Next: {nextNumberPreview}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>This number will be assigned when you issue the invoice</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {/* Autosave status */}
                  {autosaveStatus === 'saving' && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving…
                    </span>
                  )}
                  {autosaveStatus === 'saved' && lastSavedAt && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Draft saved {format(lastSavedAt, 'HH:mm')}
                    </span>
                  )}
                  {autosaveStatus === 'error' && (
                    <span className="text-xs text-destructive shrink-0">Autosave failed</span>
                  )}
                </div>
              </div>

              {/* Right: Customer Info Toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 shrink-0">
                      <User className={`h-4 w-4 ${showCustomerInfo ? 'text-primary' : 'text-muted-foreground'}`} />
                      <Label htmlFor="customer-info" className="text-sm font-medium cursor-pointer hidden sm:inline">
                        Client
                      </Label>
                      <Switch
                        id="customer-info"
                        checked={showCustomerInfo}
                        onCheckedChange={setShowCustomerInfo}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Show internal notes and payment terms for this client</p>
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
              <div className="lg:col-span-2 space-y-3">
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
                          onValueChange={(v) => { setSelectedCustomer(v); setIsDirty(true); }}
                          disabled={isIssued}
                        >
                          <SelectTrigger className="mt-1 h-9">
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {customers.length === 0 ? (
                              <div className="px-3 py-4 text-center">
                                <p className="text-xs text-muted-foreground mb-2">No customers yet.</p>
                                <Link
                                  to="/customers/new"
                                  className="text-xs text-primary underline underline-offset-2"
                                >
                                  Add your first customer →
                                </Link>
                              </div>
                            ) : (
                              customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.name}
                                </SelectItem>
                              ))
                            )}
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
                          onChange={(e) => { setInvoiceDate(e.target.value); setIsDirty(true); }}
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
                  {/* Customer context panel */}
                  {showCustomerInfo && selectedCustomer && (() => {
                    const cust = customers.find(c => c.id === selectedCustomer);
                    if (!cust) return null;
                    return (
                      <div className="mt-3 pt-3 border-t border-border space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                          <StickyNote className="h-3 w-3" />
                          Client notes
                        </div>
                        {cust.payment_terms && (
                          <p className="text-xs text-foreground">
                            <span className="text-muted-foreground">Terms: </span>{cust.payment_terms}
                          </p>
                        )}
                        {cust.notes ? (
                          <p className="text-xs text-foreground whitespace-pre-wrap">{cust.notes}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No internal notes for this client.</p>
                        )}
                      </div>
                    );
                  })()}
                  {showCustomerInfo && !selectedCustomer && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground italic">Select a customer to see their notes.</p>
                    </div>
                  )}
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
                            <TableHead className="text-xs font-medium h-8 w-28 text-right">Price (€)</TableHead>
                            <TableHead className="text-xs font-medium h-8 w-28 text-center">VAT</TableHead>
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
                                  placeholder="Enter item description..."
                                  disabled={isIssued}
                                  className="h-8 text-xs"
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
                                  className="h-9 text-base text-right w-24 ml-auto font-medium"
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
                                  <SelectTrigger className="h-8 text-xs w-24 mx-auto text-center">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-popover z-50">
                                    <SelectItem value="0">0% (Exempt)</SelectItem>
                                    <SelectItem value="0.05">5%</SelectItem>
                                    <SelectItem value="0.07">7% (Accommodation)</SelectItem>
                                    <SelectItem value="0.18">18% (Standard)</SelectItem>
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
                    
                    {/* Malta VAT reference - always visible */}
                    <div className="mx-4 mt-2 text-[10px] text-muted-foreground">
                      VAT rates: 18% standard · 5% reduced · 0% exempt
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT SIDEBAR: Summary + Actions */}
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-16 space-y-3">
                  {/* Summary Card */}
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm font-medium">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0 space-y-3">
                      {/* Compact Discount Row */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground shrink-0">Discount</Label>
                          <Select
                            value={discountType}
                            onValueChange={(v) => {
                              setDiscountType(v as 'none' | 'amount' | 'percent');
                              if (v === 'none') setDiscountValue(0);
                              setIsDirty(true);
                            }}
                            disabled={isIssued}
                          >
                            <SelectTrigger className="h-7 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="amount">Amount (€)</SelectItem>
                              <SelectItem value="percent">Percent (%)</SelectItem>
                            </SelectContent>
                          </Select>
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
                                setIsDirty(true);
                              }}
                              disabled={isIssued}
                              placeholder="0"
                              className="w-20 h-7 text-sm"
                            />
                          )}
                        </div>

                        {/* Reason — always visible when a discount type is selected */}
                        {discountType !== 'none' && (
                          <Textarea
                            value={discountReason}
                            onChange={(e) => { setDiscountReason(e.target.value); setIsDirty(true); }}
                            placeholder="Reason (optional)"
                            disabled={isIssued}
                            className="h-12 text-xs resize-none"
                          />
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
                        <div className="flex justify-between pt-3 mt-3 border-t-2 border-foreground/10">
                          <span className="font-semibold text-base">Total</span>
                          <span className="text-2xl font-bold tabular-nums">€{formatNumber(totals.grandTotal, 2)}</span>
                        </div>
                        {totals.discountAmount > 0 && (
                          <p className="text-[10px] text-muted-foreground pt-1">Discount applied before VAT</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Invoice Notes */}
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">Invoice Notes</CardTitle>
                        {invoiceSettings?.default_invoice_notes && notes === invoiceSettings.default_invoice_notes && (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            Company default
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <Textarea
                        value={notes}
                        onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
                        placeholder="Optional — leave blank to use the company default from Settings."
                        disabled={isIssued}
                        className="text-sm resize-none"
                        rows={2}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Appears on the PDF. Override per-invoice or{" "}
                        <Link to="/settings" className="underline underline-offset-2">edit the default in Settings</Link>.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Recurring Schedule */}
                  {user && (
                    <RecurringScheduleCard
                      invoiceId={isEditMode ? id : undefined}
                      userId={user.id}
                      customerId={selectedCustomer || ""}
                      isEditMode={true}
                    />
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2">
                    {!isIssued && (
                      <>
                        <Button
                          type="button"
                          onClick={() => setShowIssueModal(true)}
                          disabled={loading}
                          className="w-full h-9 bg-green-600 hover:bg-green-700"
                        >
                          <Shield className="h-4 w-4 mr-2" />
                          Issue Invoice
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
                    <p className="text-center text-[10px] text-muted-foreground pt-1">
                      Template:{" "}
                      <span className="capitalize">{templateForPreview?.style || 'modern'}</span>
                      {" · "}
                      <Link to="/invoice-templates" className="underline underline-offset-2 hover:text-foreground transition-colors">
                        Change
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </main>
      </div>

      {/* Resume Draft Modal */}
      <Dialog open={showResumeModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Continue your last invoice?</DialogTitle>
            <DialogDescription>
              You left an unfinished draft {resumeDraft ? formatDistanceToNow(resumeDraft.savedAt, { addSuffix: true }) : ''}.
            </DialogDescription>
          </DialogHeader>
          {resumeDraft && (
            <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{resumeDraft.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium tabular-nums">€{formatNumber(resumeDraft.totalAmount, 2)}</span>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2 pt-1">
            <Button onClick={handleResumeDraft} className="w-full">
              Continue editing
            </Button>
            <Button variant="outline" onClick={handleKeepAndStartNew} className="w-full">
              Keep draft & start new invoice
            </Button>
            <Button variant="ghost" onClick={handleDiscardDraft} className="w-full text-muted-foreground hover:text-destructive text-xs">
              Discard draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue Confirmation Modal */}
      <Dialog open={showIssueModal} onOpenChange={setShowIssueModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              Issue Invoice
            </DialogTitle>
            <DialogDescription>
              Issued invoices are locked and cannot be edited.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{customers.find(c => c.id === selectedCustomer)?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice No.</span>
                <span className="font-medium tabular-nums">{nextNumberPreview || 'Auto-assigned'}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                <span className="font-semibold">Total</span>
                <span className="font-bold tabular-nums">€{formatNumber(totals.grandTotal, 2)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="download-after"
                checked={downloadAfterIssue}
                onCheckedChange={(v) => setDownloadAfterIssue(!!v)}
              />
              <Label htmlFor="download-after" className="text-sm cursor-pointer">
                Download PDF after issuing
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="setup-recurring"
                checked={setupRecurringAfterIssue}
                onCheckedChange={(v) => setSetupRecurringAfterIssue(!!v)}
              />
              <Label htmlFor="setup-recurring" className="text-sm cursor-pointer">
                Set up recurring schedule after issuing
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowIssueModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleIssueConfirm}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              <Shield className="h-4 w-4 mr-2" />
              {loading ? "Issuing…" : "Confirm & Issue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Navigation Guard */}
      <UnsavedChangesDialog
        open={blocker.state === 'blocked'}
        variant={(autosaveDraftId || autosaveDraftIdRef.current) && !isEditMode ? 'draft-autosave' : 'draft-no-autosave'}
        onSaveDraft={async () => {
          setIsDirty(false);
          await performSubmit(false, true);
          confirmAndProceed();
        }}
        onDiscard={async () => {
          if (autosaveDraftIdRef.current && !isEditMode) {
            await supabase.from('invoices').delete().eq('id', autosaveDraftIdRef.current);
            localStorage.removeItem(DRAFT_KEY);
          }
          setIsDirty(false);
          confirmAndProceed();
        }}
        onCancel={cancelNavigation}
      />

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
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent((templateForPreview as any)?.font_family || 'Figtree')}:wght@300;400;500;600;700;800;900&display=swap`}
          rel="stylesheet"
        />
      </div>

      {/* PDF styles are embedded in UnifiedInvoiceLayout */}

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
                style: templateForPreview?.style || 'modern',
                notesVisibility: templateForPreview?.notes_visibility !== false,
                includeVatBreakdown: invoiceSettings?.include_vat_breakdown ?? true,
                includePaymentInstructions: invoiceSettings?.include_payment_instructions ?? true,
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
              footerText={invoiceSettings?.invoice_footer_text}
              notesText={notes}
            />
          </InvoiceErrorBoundary>
        )}
      </div>
    </div>
  );
};

export default NewInvoice;
