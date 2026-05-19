import { useState, useEffect, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Star,
  Layout,
  AlertCircle,
  RotateCcw,
  FileDown,
  Loader2,
  Save,
  ChevronDown,
} from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { UnifiedInvoiceLayout } from "@/components/UnifiedInvoiceLayout";
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { useInvoicePreview } from "@/hooks/useInvoicePreview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TemplateControlSection } from "@/components/templates/TemplateControlSection";
import { TemplateManagementPanel } from "@/components/templates/TemplateManagementPanel";
import { PreviewModeSelector, PreviewMode } from "@/components/templates/PreviewModeSelector";
import { FontPreviewSelect } from "@/components/templates/FontPreviewSelect";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TemplateStyle = "modern" | "professional" | "minimalist";

interface InvoiceTemplate {
  id: string;
  name: string;
  is_default: boolean;
  primary_color: string;
  font_family: string;
  font_size: string;
  layout?: "default" | "cleanMinimal" | "compact";
  header_layout?: "default" | "logo-right";
  table_style?: "default" | "striped" | "bordered" | "minimal";
  totals_style?: "default" | "boxed" | "highlighted";
  banking_visibility?: boolean;
  banking_style?: "default" | "boxed" | "minimal";
  vat_summary_visibility?: boolean;
  notes_visibility?: boolean;
  margin_top?: number;
  margin_right?: number;
  margin_bottom?: number;
  margin_left?: number;
  created_at?: string;
  style?: TemplateStyle;
}

// ---------------------------------------------------------------------------
// Design presets
// ---------------------------------------------------------------------------
const designPresets = [
  {
    id: "malta-professional",
    name: "Malta Pro",
    description: "Bordered table, boxed totals",
    color: "#2563eb",
    settings: {
      primary_color: "#2563eb",
      font_family: "Archivo",
      font_size: "14px",
      layout: "default" as const,
      header_layout: "default" as const,
      table_style: "bordered" as const,
      totals_style: "boxed" as const,
      banking_visibility: true,
      banking_style: "boxed" as const,
    },
  },
  {
    id: "service-business",
    name: "Service",
    description: "Minimal lines, logo right",
    color: "#7c3aed",
    settings: {
      primary_color: "#7c3aed",
      font_family: "Barlow",
      font_size: "14px",
      layout: "cleanMinimal" as const,
      header_layout: "logo-right" as const,
      table_style: "minimal" as const,
      totals_style: "highlighted" as const,
      banking_visibility: true,
      banking_style: "minimal" as const,
    },
  },
  {
    id: "retail-products",
    name: "Retail",
    description: "Striped rows, boxed totals",
    color: "#059669",
    settings: {
      primary_color: "#059669",
      font_family: "Figtree",
      font_size: "14px",
      layout: "default" as const,
      header_layout: "default" as const,
      table_style: "striped" as const,
      totals_style: "boxed" as const,
      banking_visibility: true,
      banking_style: "default" as const,
    },
  },
  {
    id: "minimal-clean",
    name: "Minimal",
    description: "Clean layout, lines only",
    color: "#64748b",
    settings: {
      primary_color: "#64748b",
      font_family: "Barlow",
      font_size: "14px",
      layout: "cleanMinimal" as const,
      header_layout: "default" as const,
      table_style: "minimal" as const,
      totals_style: "default" as const,
      banking_visibility: true,
      banking_style: "minimal" as const,
    },
  },
  {
    id: "corporate",
    name: "Corporate",
    description: "Archivo, logo right",
    color: "#1e40af",
    settings: {
      primary_color: "#1e40af",
      font_family: "Archivo",
      font_size: "14px",
      layout: "default" as const,
      header_layout: "logo-right" as const,
      table_style: "bordered" as const,
      totals_style: "boxed" as const,
      banking_visibility: true,
      banking_style: "boxed" as const,
    },
  },
];

// ---------------------------------------------------------------------------
// Style presets — each drives all structural settings at once
// ---------------------------------------------------------------------------
const stylePresets = [
  {
    id: "classic",
    name: "Classic",
    description: "White header, clean ruled table, right-aligned totals",
    settings: {
      style: "professional" as TemplateStyle,
      layout: "default" as const,
      table_style: "default" as const,
      totals_style: "default" as const,
      banking_style: "default" as const,
      font_family: "Archivo",
    },
  },
  {
    id: "bold",
    name: "Bold",
    description: "Full-colour header, striped rows, boxed totals",
    settings: {
      style: "modern" as TemplateStyle,
      layout: "default" as const,
      table_style: "striped" as const,
      totals_style: "boxed" as const,
      banking_style: "boxed" as const,
      font_family: "Sora",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "No background, lines only, understated",
    settings: {
      style: "minimalist" as TemplateStyle,
      layout: "cleanMinimal" as const,
      table_style: "minimal" as const,
      totals_style: "default" as const,
      banking_style: "minimal" as const,
      font_family: "Barlow",
    },
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const InvoiceTemplates = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { refreshTemplate } = useInvoiceTemplate();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
  const [currentSettings, setCurrentSettings] = useState<Partial<InvoiceTemplate>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Track whether current settings differ from last saved state
  const [savedSettings, setSavedSettings] = useState<Partial<InvoiceTemplate>>({});
  const hasUnsavedChanges =
    Object.keys(currentSettings).length > 0 && JSON.stringify(currentSettings) !== JSON.stringify(savedSettings);

  const {
    settings: companySettings,
    isLoading: loadingCompany,
    isValid: companyValid,
    validationErrors: companyErrors,
  } = useCompanySettings();
  const {
    settings: bankingSettings,
    isLoading: loadingBanking,
    isValid: bankingValid,
    validationErrors: bankingErrors,
  } = useBankingSettings();

  // ── Load templates ──────────────────────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("invoice_templates")
        .select("*")
        .order("is_default", { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        const typedData: InvoiceTemplate[] = data.map((t) => ({
          ...t,
          layout: (t.layout === "cleanMinimal" ? "cleanMinimal" : t.layout === "compact" ? "compact" : "default") as
            | "default"
            | "cleanMinimal"
            | "compact",
          header_layout: ((t.header_layout === "split"
            ? "logo-right"
            : t.header_layout === "centered"
              ? "default"
              : t.header_layout) || "default") as "default" | "logo-right",
          table_style: (t.table_style || "default") as "default" | "striped" | "bordered" | "minimal",
          totals_style: (t.totals_style || "default") as "default" | "boxed" | "highlighted",
          banking_visibility: t.banking_visibility !== undefined ? t.banking_visibility : true,
          banking_style: (t.banking_style || "default") as "default" | "boxed" | "minimal",
          vat_summary_visibility: (t as any).vat_summary_visibility ?? false,
          style: ((t as any).style || "modern") as TemplateStyle,
          margin_top: t.margin_top || 20,
          margin_right: t.margin_right || 20,
          margin_bottom: t.margin_bottom || 20,
          margin_left: t.margin_left || 20,
        }));
        setTemplates(typedData);
        const def = typedData.find((t) => t.is_default) || typedData[0];
        setSelectedTemplate(def);
        setCurrentSettings(def);
        setSavedSettings(def);
      } else {
        await createDefaultTemplate();
      }
    } catch (error) {
      toast({ title: "Error loading templates", description: "Failed to load from database.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createDefaultTemplate = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("invoice_templates")
        .insert([
          {
            name: "Default Template",
            is_default: true,
            primary_color: "#26A65B",
            font_family: "Figtree",
            font_size: "14px",
            layout: "default",
            header_layout: "default",
            table_style: "default",
            totals_style: "default",
            banking_visibility: true,
            banking_style: "default",
            style: "modern",
            margin_top: 20,
            margin_right: 20,
            margin_bottom: 20,
            margin_left: 20,
            user_id: user.id,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      const typedData: InvoiceTemplate = {
        ...data,
        layout: "default" as const,
        header_layout: "default" as const,
        table_style: "default" as const,
        totals_style: "default" as const,
        banking_visibility: true,
        banking_style: "default" as const,
        style: (data.style as TemplateStyle) || "modern",
      };
      setTemplates([typedData]);
      setSelectedTemplate(typedData);
      setCurrentSettings(typedData);
    } catch (error) {
      console.error("Error creating default template:", error);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const updateSetting = (key: keyof InvoiceTemplate, value: any) =>
    setCurrentSettings((prev) => ({ ...prev, [key]: value }));

  const resetToDefault = () => {
    if (!selectedTemplate) return;
    setCurrentSettings(selectedTemplate);
    toast({ title: "Settings reset", description: "Changes reset to saved template." });
  };

  const applyPreset = (preset: (typeof designPresets)[0]) => {
    setCurrentSettings((prev) => ({ ...prev, ...preset.settings }));
    toast({ title: `${preset.name} preset applied` });
  };

  const applyStylePreset = (preset: (typeof stylePresets)[0]) => {
    setCurrentSettings((prev) => ({ ...prev, ...preset.settings }));
  };

  // Maps currentSettings.style → style preset id
  const activeStyleId =
    currentSettings.style === "professional"
      ? "classic"
      : currentSettings.style === "minimalist"
      ? "minimal"
      : "bold";

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedTemplate || !currentSettings.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("invoice_templates")
        .update({
          primary_color: currentSettings.primary_color,
          font_family: currentSettings.font_family,
          font_size: currentSettings.font_size,
          layout: currentSettings.layout,
          header_layout: currentSettings.header_layout,
          table_style: currentSettings.table_style,
          totals_style: currentSettings.totals_style,
          banking_visibility: currentSettings.banking_visibility,
          banking_style: currentSettings.banking_style,
          style: currentSettings.style,
          notes_visibility: currentSettings.notes_visibility,
          vat_summary_visibility: currentSettings.vat_summary_visibility,
        })
        .eq("id", currentSettings.id);
      if (error) throw error;
      setTemplates((prev) =>
        prev.map((t) => (t.id === currentSettings.id ? ({ ...t, ...currentSettings } as InvoiceTemplate) : t)),
      );
      setSelectedTemplate({ ...selectedTemplate, ...currentSettings } as InvoiceTemplate);
      setSavedSettings({ ...currentSettings });
      await refreshTemplate();
      const warnings: string[] = [];
      if (!companySettings?.company_name) warnings.push("Company name");
      if (!companySettings?.company_logo) warnings.push("Company logo");
      if (!companySettings?.company_address) warnings.push("Company address");
      if (!companySettings?.company_vat_number) warnings.push("VAT number");
      if (warnings.length > 0) {
        toast({
          title: "Saved — some settings incomplete",
          description: `Complete in Settings: ${warnings.join(", ")}.`,
          duration: 6000,
        });
      } else {
        toast({ title: "Template saved", description: "All settings complete and ready." });
      }
    } catch (err) {
      console.error("Template save error:", err);
      toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndTest = async () => {
    await handleSave();
    try {
      await downloadPdfFromFunction("invoice-template-test", currentSettings.font_family || "Figtree");
      toast({ title: "Test PDF generated", description: "Sample PDF downloaded." });
    } catch (error: any) {
      toast({
        title: "Test failed",
        description: error?.message || "Could not generate test PDF.",
        variant: "destructive",
      });
    }
  };

  const handleSetDefault = async () => {
    if (!selectedTemplate || !user?.id) return;
    try {
      await supabase.from("invoice_templates").update({ is_default: false }).eq("user_id", user.id);
      const { error } = await supabase
        .from("invoice_templates")
        .update({ is_default: true })
        .eq("id", selectedTemplate.id);
      if (error) throw error;
      setTemplates((prev) => prev.map((t) => ({ ...t, is_default: t.id === selectedTemplate.id })));
      await refreshTemplate();
      toast({ title: "Default template set" });
    } catch {
      toast({ title: "Error", description: "Failed to set default.", variant: "destructive" });
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const templateForPreview = {
    primary_color: currentSettings.primary_color || "#26A65B",
    font_family: currentSettings.font_family || "Figtree",
    font_size: currentSettings.font_size || "14px",
  };

  const { data: sampleInvoiceData } = useInvoicePreview({ useSampleData: true });
  const isPreviewLoading = isLoading || loadingCompany || loadingBanking;
  const getGoogleFontHref = (family: string) =>
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family.trim())}:wght@300;400;500;600;700;800;900&display=swap`;
  const previewWidth = "794px";

  const buildTemplateSettings = (overrides: Partial<InvoiceTemplate> = {}) => ({
    primaryColor: overrides.primary_color || currentSettings.primary_color || "#26A65B",
    fontFamily: overrides.font_family || currentSettings.font_family || "Figtree",
    fontSize: overrides.font_size || currentSettings.font_size || "14px",
    layout: currentSettings.layout || "default",
    headerLayout: currentSettings.header_layout || "default",
    tableStyle: currentSettings.table_style || "default",
    totalsStyle: currentSettings.totals_style || "default",
    bankingVisibility: currentSettings.banking_visibility !== false,
    bankingStyle: currentSettings.banking_style || "default",
    vatSummaryVisibility: currentSettings.vat_summary_visibility === true,
    notesVisibility: currentSettings.notes_visibility !== false,

    style: (overrides.style || currentSettings.style || "modern") as "modern" | "professional" | "minimalist",
  });

  const sharedLayoutBase = {
    invoiceData: sampleInvoiceData,
    companySettings: companySettings
      ? {
          name: companySettings.company_name || "",
          address: companySettings.company_address || "",
          addressLine1: companySettings.company_address_line1 || undefined,
          addressLine2: companySettings.company_address_line2 || undefined,
          locality: companySettings.company_locality || undefined,
          postCode: companySettings.company_post_code || undefined,
          city: companySettings.company_city || "",
          zipCode: companySettings.company_zip_code || "",
          country: companySettings.company_country || "",
          phone: companySettings.company_phone || "",
          email: companySettings.company_email || "",
          taxId: companySettings.company_vat_number || "",
          logo: companySettings.company_logo || "",
        }
      : undefined,
    bankingSettings: bankingSettings
      ? {
          bankName: bankingSettings.bank_name || "",
          accountName: bankingSettings.bank_account_name || "",
          iban: bankingSettings.bank_iban || "",
          swiftCode: bankingSettings.bank_swift_code || "",
        }
      : undefined,
    notesText: "Payment due within 30 days. Please include the invoice number as a reference.",
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="md:ml-64 flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
        {/* Sticky Header */}
        <header className="bg-card border-b border-border sticky top-0 z-20">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground">Invoice Template Designer</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Design and preview your invoice templates</p>
              </div>
              <div className="flex items-center gap-3">
                <PreviewModeSelector mode={previewMode} onModeChange={setPreviewMode} />

                {/* Unsaved changes badge */}
                {hasUnsavedChanges && !isSaving && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs hidden sm:flex">
                    Unsaved changes
                  </Badge>
                )}

                {/* Discard + Save group */}
                <div className="flex items-center rounded-lg border border-border overflow-hidden divide-x divide-border">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={resetToDefault}
                          disabled={!selectedTemplate || !hasUnsavedChanges}
                          className="rounded-none h-8 px-3 text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span className="ml-1.5 hidden sm:inline text-xs">Discard</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Discard unsaved changes</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving || !selectedTemplate}
                    className="rounded-none h-8 px-3 hover:text-foreground"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    <span className="ml-1.5 hidden sm:inline text-xs">{isSaving ? "Saving…" : "Save"}</span>
                  </Button>
                </div>

                {/* Primary CTA */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" onClick={handleSaveAndTest} disabled={isSaving || !selectedTemplate}>
                        <FileDown className="h-4 w-4 mr-1.5" />
                        Download PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Saves then downloads a sample PDF</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* LEFT SIDEBAR */}
          <aside className="w-[300px] flex-shrink-0 border-r border-border bg-card overflow-y-auto h-full">
            <div className="p-4 space-y-5">
              {/* Validation warning */}
              {(!companyValid || !bankingValid) && (
                <Alert className="mb-1">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Setup Required:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {companyErrors.slice(0, 2).map((e, i) => (
                        <li key={`c-${i}`}>{e}</li>
                      ))}
                      {bankingErrors.slice(0, 2).map((e, i) => (
                        <li key={`b-${i}`}>{e}</li>
                      ))}
                    </ul>
                    <a href="/settings" className="underline text-primary mt-1 inline-block">
                      Go to Settings →
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              {isLoading ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Design Presets */}
                  {/* ── SECTION 1: Style picker ── */}
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Style</p>
                    <div className="space-y-2">
                      {stylePresets.map((preset) => {
                        const isActive = activeStyleId === preset.id;
                        const primaryColor = currentSettings.primary_color || "#1e3a5f";
                        return (
                          <button
                            key={preset.id}
                            onClick={() => applyStylePreset(preset)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                              isActive
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:border-primary/40 hover:bg-muted/50"
                            }`}
                          >
                            {/* Mini-invoice thumbnail */}
                            <div className="w-20 h-14 rounded overflow-hidden border border-border/50 flex-shrink-0 bg-white flex flex-col shadow-sm">
                              {preset.id === "classic" && (
                                <>
                                  <div className="h-1 w-full" style={{ backgroundColor: primaryColor }} />
                                  <div className="flex items-center px-1.5 py-1 gap-1">
                                    <div className="w-3 h-3 rounded-sm bg-muted" />
                                    <div className="flex-1 space-y-0.5">
                                      <div className="h-0.5 bg-muted-foreground/30 rounded-full w-full" />
                                      <div className="h-0.5 bg-muted-foreground/15 rounded-full w-2/3" />
                                    </div>
                                  </div>
                                  <div className="flex-1 px-1.5 pb-1 space-y-1">
                                    <div className="h-px bg-border w-full" />
                                    <div className="h-1 bg-muted-foreground/15 rounded-full w-3/4" />
                                    <div className="h-1 bg-muted-foreground/10 rounded-full w-1/2" />
                                    <div className="flex justify-end mt-1">
                                      <div className="h-1 rounded w-1/3 bg-muted-foreground/20" />
                                    </div>
                                  </div>
                                </>
                              )}
                              {preset.id === "bold" && (
                                <>
                                  <div className="h-5 w-full flex items-center px-1.5 gap-1" style={{ backgroundColor: primaryColor }}>
                                    <div className="w-3 h-3 rounded-sm bg-white/30" />
                                    <div className="flex-1 space-y-0.5">
                                      <div className="h-0.5 bg-white/60 rounded-full w-full" />
                                      <div className="h-0.5 bg-white/40 rounded-full w-2/3" />
                                    </div>
                                  </div>
                                  <div className="flex-1 px-1 pb-1 space-y-0.5 pt-0.5">
                                    <div className="h-1.5 bg-muted/60 rounded-sm w-full" />
                                    <div className="h-1.5 w-full" />
                                    <div className="h-1.5 bg-muted/40 rounded-sm w-full" />
                                    <div className="flex justify-end mt-0.5">
                                      <div className="h-2 rounded w-1/3 border" style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}15` }} />
                                    </div>
                                  </div>
                                </>
                              )}
                              {preset.id === "minimal" && (
                                <div className="flex-1 p-1.5 flex flex-col gap-1">
                                  <div className="flex items-baseline gap-1 mb-0.5">
                                    <div className="h-1.5 bg-muted-foreground/40 rounded-full w-2/5" />
                                    <div className="h-1 bg-muted-foreground/15 rounded-full w-1/4 ml-auto" />
                                  </div>
                                  <div className="h-px bg-border w-full" />
                                  <div className="h-1 bg-muted-foreground/15 rounded-full w-3/4" />
                                  <div className="h-1 bg-muted-foreground/10 rounded-full w-1/2" />
                                  <div className="h-px bg-border w-full mt-auto" />
                                  <div className="flex justify-end">
                                    <div className="h-1 rounded w-1/3" style={{ backgroundColor: `${primaryColor}50` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{preset.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{preset.description}</p>
                            </div>
                            {isActive && (
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: primaryColor }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-border" />

                  {/* ── SECTION 2: Customise ── */}
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Customise</p>

                    {/* Brand Colour */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Brand Colour</Label>
                      <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border">
                        <div
                          className="w-10 h-10 rounded-lg border-2 border-white shadow-sm cursor-pointer relative overflow-hidden shrink-0"
                          style={{ backgroundColor: currentSettings.primary_color || "#1e3a5f" }}
                        >
                          <Input
                            type="color"
                            value={currentSettings.primary_color || "#1e3a5f"}
                            onChange={(e) => updateSetting("primary_color", e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Primary</p>
                          <p className="text-xs text-muted-foreground font-mono">{currentSettings.primary_color || "#1e3a5f"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {[
                          { name: "Navy",     color: "#1e3a5f" },
                          { name: "Indigo",   color: "#3730a3" },
                          { name: "Slate",    color: "#475569" },
                          { name: "Charcoal", color: "#1f2937" },
                          { name: "Emerald",  color: "#065f46" },
                          { name: "Maroon",   color: "#7f1d1d" },
                        ].map((p) => (
                          <button
                            key={p.name}
                            title={p.name}
                            onClick={() => updateSetting("primary_color", p.color)}
                            className={`w-full aspect-square rounded-md border-2 transition-all hover:scale-110 ${
                              currentSettings.primary_color === p.color
                                ? "border-primary scale-110 shadow-sm ring-2 ring-primary/30"
                                : "border-transparent hover:border-muted-foreground/30"
                            }`}
                            style={{ backgroundColor: p.color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Font */}
                    <FontPreviewSelect
                      value={currentSettings.font_family || "Figtree"}
                      onChange={(v) => updateSetting("font_family", v)}
                    />

                    {/* Logo Position */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Logo Position</Label>
                      <div className="flex rounded-lg border border-border overflow-hidden divide-x divide-border">
                        {(["default", "logo-right"] as const).map((pos) => (
                          <button
                            key={pos}
                            onClick={() => updateSetting("header_layout", pos)}
                            className={`flex-1 py-2 text-xs font-medium transition-colors ${
                              (currentSettings.header_layout || "default") === pos
                                ? "bg-primary text-primary-foreground"
                                : "bg-background text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {pos === "default" ? "Left" : "Right"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border" />

                  {/* ── SECTION 3: Advanced ── */}
                  <div>
                    <button
                      onClick={() => setShowAdvanced((v) => !v)}
                      className="w-full flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      Advanced
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
                    </button>
                    {showAdvanced && (
                      <div className="mt-4 space-y-4">
                        {/* Visibility toggles */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Show Banking Details</Label>
                            <Switch
                              checked={currentSettings.banking_visibility !== false}
                              onCheckedChange={(v) => updateSetting("banking_visibility", v)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Label className="text-sm cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
                                    Show VAT Summary
                                  </Label>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-[220px] text-xs">
                                  Adds a VAT breakdown table showing net, VAT rate, and tax amount per rate. Required for most Malta VAT filings.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Switch
                              checked={currentSettings.vat_summary_visibility === true}
                              onCheckedChange={(v) => updateSetting("vat_summary_visibility", v)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Show Notes</Label>
                            <Switch
                              checked={currentSettings.notes_visibility !== false}
                              onCheckedChange={(v) => updateSetting("notes_visibility", v)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border" />

                  {/* ── SECTION 4: Template management ── */}
                  {/* ── SECTION 4: Template management ── */}
                  <TemplateControlSection
                    title="Templates"
                    icon={<Layout className="h-4 w-4" />}
                    iconBg="bg-emerald-100 text-emerald-600"
                    defaultOpen={false}
                  >
                    {user && (
                      <TemplateManagementPanel
                        templates={templates}
                        selectedTemplate={selectedTemplate}
                        currentSettings={currentSettings}
                        userId={user.id}
                        onTemplateCreated={loadTemplates}
                        onTemplateDeleted={(deletedId) => {
                          setTemplates((prev) => {
                            const remaining = prev.filter((t) => t.id !== deletedId);
                            const next = remaining.find((t) => t.is_default) || remaining[0] || null;
                            if (next) {
                              setSelectedTemplate(next);
                              setCurrentSettings(next);
                              setSavedSettings(next);
                            } else {
                              setSelectedTemplate(null);
                              setCurrentSettings({});
                              setSavedSettings({});
                            }
                            return remaining;
                          });
                        }}
                        onTemplateSelected={(t) => {
                          setSelectedTemplate(t);
                          setCurrentSettings(t);
                          setSavedSettings(t);
                        }}
                      />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-1"
                      onClick={handleSetDefault}
                      disabled={!selectedTemplate || selectedTemplate?.is_default}
                    >
                      <Star className="h-4 w-4 mr-2" />
                      {selectedTemplate?.is_default ? "Default Template" : "Set as Default"}
                    </Button>
                  </TemplateControlSection>

                </div>
              )}
            </div>
          </aside>

          {/* RIGHT CANVAS */}
          <main className="flex-1 overflow-y-scroll bg-muted/50 h-full">
            {isPreviewLoading ? (
              <div className="flex items-center justify-center py-12 px-8">
                <div className="bg-white shadow-2xl rounded-sm p-8" style={{ width: previewWidth, minHeight: "600px" }}>
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading preview…</p>
                  </div>
                  <div className="space-y-4 mt-4">
                    <div className="flex justify-between">
                      <Skeleton className="h-16 w-32" />
                      <div className="space-y-2">
                        <Skeleton className="h-8 w-40 ml-auto" />
                        <Skeleton className="h-4 w-24 ml-auto" />
                      </div>
                    </div>
                    <Skeleton className="h-px w-full" />
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-10 w-full mt-6" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </div>
              </div>
            ) : previewMode === "comparison" ? (
              /* Side-by-side: saved vs current */
              <div className="flex gap-6 items-start justify-center py-12 px-6">
                {/* Saved */}
                <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saved</span>
                  </div>
                  <div
                    className="bg-white shadow-xl rounded-sm overflow-hidden w-full"
                    style={{ maxWidth: "500px", fontFamily: selectedTemplate?.font_family || "Figtree" }}
                  >
                    <link rel="stylesheet" href={getGoogleFontHref(selectedTemplate?.font_family || "Figtree")} />
                    {selectedTemplate && (
                      <UnifiedInvoiceLayout
                        {...sharedLayoutBase}
                        templateSettings={buildTemplateSettings(selectedTemplate)}
                      />
                    )}
                  </div>
                </div>
                {/* Current */}
                <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: currentSettings.primary_color || "#26A65B" }}
                    />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Current (unsaved)
                    </span>
                  </div>
                  <div
                    className="bg-white shadow-xl rounded-sm border-2 overflow-hidden w-full"
                    style={{
                      maxWidth: "500px",
                      fontFamily: currentSettings.font_family || "Figtree",
                      borderColor: currentSettings.primary_color || "#26A65B",
                      boxShadow: `0 10px 30px -8px ${currentSettings.primary_color || "#26A65B"}40`,
                    }}
                  >
                    <link rel="stylesheet" href={getGoogleFontHref(currentSettings.font_family || "Figtree")} />
                    <UnifiedInvoiceLayout {...sharedLayoutBase} templateSettings={buildTemplateSettings()} />
                  </div>
                </div>
              </div>
            ) : (
              /* Single preview */
              <div className="flex items-center justify-center py-12 px-8">
                <div className="relative">
                  <div className="absolute -top-7 left-0 right-0 flex items-center justify-between px-1 z-10">
                    <span className="text-xs font-medium text-muted-foreground">
                      {selectedTemplate?.name}
                      {selectedTemplate?.is_default && (
                        <span className="ml-1.5 text-muted-foreground/60">· Default</span>
                      )}
                    </span>
                    <span className="text-[11px] text-muted-foreground/60 bg-muted/80 px-2 py-0.5 rounded-full border border-border/40">
                      Sample data
                    </span>
                  </div>
                  <div
                    className="bg-white shadow-2xl rounded-sm overflow-hidden transition-all duration-300"
                    style={{
                      width: previewWidth,
                      fontFamily: currentSettings.font_family || "Figtree",
                      boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)",
                    }}
                  >
                    <link rel="stylesheet" href={getGoogleFontHref(currentSettings.font_family || "Figtree")} />
                    <UnifiedInvoiceLayout {...sharedLayoutBase} templateSettings={buildTemplateSettings()} />
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Font preloader */}
      <div style={{ display: "none" }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(currentSettings.font_family || "Figtree")}:wght@300;400;500;600;700;800;900&display=swap`}
          rel="stylesheet"
        />
      </div>

      {/* Hidden A4 DOM for PDF export */}
      <div style={{ display: "none" }}>
        <UnifiedInvoiceLayout
          id="invoice-preview-root"
          variant="pdf"
          {...sharedLayoutBase}
          companySettings={
            companySettings
              ? {
                  ...sharedLayoutBase.companySettings!,
                  registrationNumber: companySettings.company_registration_number || "",
                }
              : undefined
          }
          templateSettings={buildTemplateSettings()}
        />
      </div>
    </div>
  );
};

export default InvoiceTemplates;
