import { useState, useEffect, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Star,
  Palette,
  Type,
  Settings2,
  Layout,
  AlertCircle,
  RotateCcw,
  FileDown,
  Loader2,
  Wand2,
  Save,
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
import { MarginControl } from "@/components/templates/MarginControl";
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
  accent_color: string;
  font_family: string;
  font_size: string;
  layout?: "default" | "cleanMinimal" | "compact";
  header_layout?: "default" | "centered" | "split";
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
    color: "#2563eb",
    settings: {
      primary_color: "#2563eb",
      accent_color: "#1e40af",
      font_family: "Inter",
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
    color: "#7c3aed",
    settings: {
      primary_color: "#7c3aed",
      accent_color: "#6d28d9",
      font_family: "Inter",
      font_size: "14px",
      layout: "cleanMinimal" as const,
      header_layout: "split" as const,
      table_style: "minimal" as const,
      totals_style: "highlighted" as const,
      banking_visibility: true,
      banking_style: "minimal" as const,
    },
  },
  {
    id: "retail-products",
    name: "Retail",
    color: "#059669",
    settings: {
      primary_color: "#059669",
      accent_color: "#047857",
      font_family: "Inter",
      font_size: "14px",
      layout: "default" as const,
      header_layout: "centered" as const,
      table_style: "striped" as const,
      totals_style: "boxed" as const,
      banking_visibility: true,
      banking_style: "default" as const,
    },
  },
  {
    id: "minimal-clean",
    name: "Minimal",
    color: "#64748b",
    settings: {
      primary_color: "#64748b",
      accent_color: "#475569",
      font_family: "Inter",
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
    color: "#1e40af",
    settings: {
      primary_color: "#1e40af",
      accent_color: "#1e3a8a",
      font_family: "Lato",
      font_size: "14px",
      layout: "default" as const,
      header_layout: "split" as const,
      table_style: "bordered" as const,
      totals_style: "boxed" as const,
      banking_visibility: true,
      banking_style: "boxed" as const,
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
          header_layout: (t.header_layout || "default") as "default" | "centered" | "split",
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
            accent_color: "#1F2D3D",
            font_family: "Inter",
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

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedTemplate || !currentSettings.id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("invoice_templates")
        .update({
          primary_color: currentSettings.primary_color,
          accent_color: currentSettings.accent_color,
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
          margin_top: currentSettings.margin_top,
          margin_right: currentSettings.margin_right,
          margin_bottom: currentSettings.margin_bottom,
          margin_left: currentSettings.margin_left,
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
    } catch {
      toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndTest = async () => {
    await handleSave();
    try {
      await downloadPdfFromFunction("invoice-template-test", currentSettings.font_family || "Inter");
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
    accent_color: currentSettings.accent_color || "#1F2D3D",
    font_family: currentSettings.font_family || "Inter",
    font_size: currentSettings.font_size || "14px",
  };

  const { data: sampleInvoiceData } = useInvoicePreview({ useSampleData: true });
  const isPreviewLoading = isLoading || loadingCompany || loadingBanking;
  const getGoogleFontHref = (family: string) =>
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family.trim())}:wght@400;600;700&display=swap`;
  const previewWidth = previewMode === "mobile" ? "375px" : previewMode === "print" ? "210mm" : "794px";

  const buildTemplateSettings = (overrides: Partial<InvoiceTemplate> = {}) => ({
    primaryColor: overrides.primary_color || currentSettings.primary_color || "#26A65B",
    accentColor: overrides.accent_color || currentSettings.accent_color || "#1F2D3D",
    fontFamily: overrides.font_family || currentSettings.font_family || "Inter",
    fontSize: overrides.font_size || currentSettings.font_size || "14px",
    layout: currentSettings.layout || "default",
    headerLayout: currentSettings.header_layout || "default",
    tableStyle: currentSettings.table_style || "default",
    totalsStyle: currentSettings.totals_style || "default",
    bankingVisibility: currentSettings.banking_visibility !== false,
    bankingStyle: currentSettings.banking_style || "default",
    vatSummaryVisibility: currentSettings.vat_summary_visibility === true,
    marginTop: currentSettings.margin_top || 20,
    marginRight: currentSettings.margin_right || 20,
    marginBottom: currentSettings.margin_bottom || 20,
    marginLeft: currentSettings.margin_left || 20,
    style: (overrides.style || currentSettings.style || "modern") as "modern" | "professional" | "minimalist",
  });

  const sharedLayoutBase = {
    invoiceData: sampleInvoiceData,
    companySettings: companySettings
      ? {
          name: companySettings.company_name || "",
          address: companySettings.company_address || "",
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
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="md:ml-64 flex flex-col min-h-screen">
        {/* Sticky Header */}
        <header className="bg-card border-b border-border sticky top-0 z-20">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-foreground">Invoice Template Designer</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Design and preview your invoice templates</p>
              </div>
              <div className="flex items-center gap-2">
                <PreviewModeSelector mode={previewMode} onModeChange={setPreviewMode} />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" onClick={resetToDefault} disabled={!selectedTemplate}>
                        <RotateCcw className="h-4 w-4" />
                        <span className="ml-1.5 hidden sm:inline">Reset</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset to last saved state</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving || !selectedTemplate}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span className="ml-1.5 hidden sm:inline">{isSaving ? "Saving…" : "Save"}</span>
                  {hasUnsavedChanges && !isSaving && (
                    <span className="ml-1.5 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes" />
                  )}
                </Button>
                <Button size="sm" onClick={handleSaveAndTest} disabled={isSaving || !selectedTemplate}>
                  <FileDown className="h-4 w-4 mr-1.5" />
                  Save & Test PDF
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* LEFT SIDEBAR */}
          <aside className="w-[320px] flex-shrink-0 border-r border-border bg-card overflow-y-auto">
            <div className="p-4 space-y-2">
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
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Template Selection */}
                  <TemplateControlSection
                    title="Template Selection"
                    icon={<Layout className="h-4 w-4 text-muted-foreground" />}
                    defaultOpen={true}
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
                    {templates.length > 0 && selectedTemplate && (
                      <div className="space-y-2 pt-1">
                        <Label className="text-xs text-muted-foreground">Active Template</Label>
                        <Select
                          value={selectedTemplate.id}
                          onValueChange={(value) => {
                            const t = templates.find((t) => t.id === value);
                            if (t) {
                              setSelectedTemplate(t);
                              setCurrentSettings(t);
                              setSavedSettings(t);
                            }
                          }}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {templates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                <div className="flex items-center gap-2">
                                  {t.name}
                                  {t.is_default && (
                                    <Badge variant="secondary" className="text-xs">
                                      Default
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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

                  {/* Design Presets */}
                  <TemplateControlSection
                    title="Design Presets"
                    icon={<Wand2 className="h-4 w-4 text-muted-foreground" />}
                    defaultOpen={false}
                  >
                    <p className="text-xs text-muted-foreground -mt-1">
                      Apply a complete design in one click. Adjust any setting after.
                    </p>
                    <div className="grid grid-cols-5 gap-2 pt-1">
                      {designPresets.map((preset) => (
                        <TooltipProvider key={preset.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => applyPreset(preset)}
                                className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all hover:ring-2 hover:ring-primary/40 hover:border-primary/40 ${
                                  currentSettings.primary_color === preset.color
                                    ? "ring-2 ring-primary border-primary bg-primary/5"
                                    : "border-border"
                                }`}
                              >
                                <div
                                  className="w-8 h-8 rounded-full border border-white/20 shadow-sm"
                                  style={{ backgroundColor: preset.color }}
                                />
                                <span className="text-[10px] font-medium text-center leading-tight">{preset.name}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p>{preset.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </TemplateControlSection>

                  {/* Template Style */}
                  <TemplateControlSection
                    title="Template Style"
                    icon={<Layout className="h-4 w-4 text-muted-foreground" />}
                    defaultOpen={true}
                  >
                    <div className="space-y-2">
                      {(["modern", "professional", "minimalist"] as TemplateStyle[]).map((styleValue) => {
                        const labels: Record<TemplateStyle, { label: string; desc: string }> = {
                          modern: { label: "Modern", desc: "Solid brand colour header with white text" },
                          professional: { label: "Professional", desc: "White header with coloured top border" },
                          minimalist: { label: "Minimalist", desc: "Clean design, colour only on totals" },
                        };
                        const isActive = (currentSettings.style || "modern") === styleValue;
                        const primaryColor = currentSettings.primary_color || "#26A65B";
                        return (
                          <button
                            key={styleValue}
                            onClick={() => updateSetting("style", styleValue)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                              isActive
                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                : "border-border hover:border-primary/40 hover:bg-muted/50"
                            }`}
                          >
                            {/* Live thumbnail */}
                            <div className="w-10 h-10 rounded overflow-hidden border border-border/50 flex-shrink-0 bg-muted flex flex-col">
                              {styleValue === "modern" && (
                                <>
                                  <div className="h-4 w-full" style={{ backgroundColor: primaryColor }} />
                                  <div className="flex-1 p-0.5 space-y-0.5">
                                    <div className="h-1 bg-muted-foreground/20 rounded-full w-3/4" />
                                    <div className="h-1 bg-muted-foreground/10 rounded-full w-1/2" />
                                  </div>
                                </>
                              )}
                              {styleValue === "professional" && (
                                <>
                                  <div className="h-0.5 w-full" style={{ backgroundColor: primaryColor }} />
                                  <div className="flex-1 p-0.5 space-y-0.5 pt-1">
                                    <div className="h-1 bg-muted-foreground/20 rounded-full w-3/4" />
                                    <div className="h-1 bg-muted-foreground/10 rounded-full w-1/2" />
                                  </div>
                                </>
                              )}
                              {styleValue === "minimalist" && (
                                <div className="flex-1 p-1 space-y-0.5 flex flex-col justify-center">
                                  <div className="h-1 bg-muted-foreground/30 rounded-full w-3/4" />
                                  <div className="h-1 bg-muted-foreground/15 rounded-full w-1/2" />
                                  <div
                                    className="h-1.5 rounded-full w-full mt-1"
                                    style={{ backgroundColor: `${primaryColor}40` }}
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{labels[styleValue].label}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{labels[styleValue].desc}</div>
                            </div>
                            {isActive && (
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: primaryColor }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </TemplateControlSection>

                  {/* Brand Colors */}
                  <TemplateControlSection
                    title="Brand Colors"
                    icon={<Palette className="h-4 w-4 text-muted-foreground" />}
                    defaultOpen={true}
                  >
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                      <div
                        className="w-12 h-12 rounded-lg border-2 border-border shadow-sm cursor-pointer relative overflow-hidden"
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
                        <div className="text-sm font-medium">Primary Brand Color</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {currentSettings.primary_color || "#1e3a5f"}
                        </div>
                      </div>
                    </div>
                    <div className="pt-1">
                      <Label className="text-xs text-muted-foreground mb-2 block">Professional Presets</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { name: "Navy", color: "#1e3a5f" },
                          { name: "Slate", color: "#475569" },
                          { name: "Emerald", color: "#065f46" },
                          { name: "Maroon", color: "#7f1d1d" },
                          { name: "Indigo", color: "#3730a3" },
                          { name: "Charcoal", color: "#1f2937" },
                        ].map((p) => (
                          <button
                            key={p.name}
                            onClick={() => updateSetting("primary_color", p.color)}
                            className={`flex items-center gap-2 p-2 rounded-md border transition-all hover:ring-2 hover:ring-primary/50 ${
                              currentSettings.primary_color === p.color
                                ? "ring-2 ring-primary border-primary"
                                : "border-border"
                            }`}
                          >
                            <div
                              className="w-5 h-5 rounded-full border border-border/50 flex-shrink-0"
                              style={{ backgroundColor: p.color }}
                            />
                            <span className="text-xs font-medium truncate">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="pt-1">
                      <Label className="text-xs text-muted-foreground mb-2 block">Accent Color</Label>
                      <div className="flex items-center gap-3 p-2 rounded-lg border border-border/50">
                        <div
                          className="w-8 h-8 rounded border border-border cursor-pointer relative overflow-hidden"
                          style={{ backgroundColor: currentSettings.accent_color || "#1F2D3D" }}
                        >
                          <Input
                            type="color"
                            value={currentSettings.accent_color || "#1F2D3D"}
                            onChange={(e) => updateSetting("accent_color", e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                        <div className="text-xs font-mono text-muted-foreground">
                          {currentSettings.accent_color || "#1F2D3D"}
                        </div>
                      </div>
                    </div>
                  </TemplateControlSection>

                  {/* Typography */}
                  <TemplateControlSection
                    title="Typography"
                    icon={<Type className="h-4 w-4 text-muted-foreground" />}
                    defaultOpen={false}
                  >
                    <FontPreviewSelect
                      value={currentSettings.font_family || "Inter"}
                      onChange={(v) => updateSetting("font_family", v)}
                    />
                  </TemplateControlSection>

                  {/* Layout Options */}
                  <TemplateControlSection
                    title="Layout Options"
                    icon={<Settings2 className="h-4 w-4 text-muted-foreground" />}
                    defaultOpen={false}
                  >
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Layout Style</Label>
                        <Select
                          value={currentSettings.layout || "default"}
                          onValueChange={(v) => updateSetting("layout", v)}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="cleanMinimal">Clean Minimal</SelectItem>
                            <SelectItem value="compact">Compact</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Header Layout</Label>
                        <Select
                          value={currentSettings.header_layout || "default"}
                          onValueChange={(v) => updateSetting("header_layout", v)}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            <SelectItem value="default">Default — logo left, invoice right</SelectItem>
                            <SelectItem value="centered">Centered — logo & title centered</SelectItem>
                            <SelectItem value="split">Split — company left, details right</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Table Style</Label>
                        <Select
                          value={currentSettings.table_style || "default"}
                          onValueChange={(v) => updateSetting("table_style", v)}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="striped">Striped Rows</SelectItem>
                            <SelectItem value="bordered">Bordered</SelectItem>
                            <SelectItem value="minimal">Minimal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Totals Style</Label>
                        <Select
                          value={currentSettings.totals_style || "default"}
                          onValueChange={(v) => updateSetting("totals_style", v)}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="boxed">Boxed</SelectItem>
                            <SelectItem value="highlighted">Highlighted</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between py-2 px-1">
                        <Label className="text-sm">Show Banking Details</Label>
                        <Switch
                          checked={currentSettings.banking_visibility !== false}
                          onCheckedChange={(v) => updateSetting("banking_visibility", v)}
                        />
                      </div>
                      {currentSettings.banking_visibility !== false && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Banking Style</Label>
                          <Select
                            value={currentSettings.banking_style || "default"}
                            onValueChange={(v) => updateSetting("banking_style", v)}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="default">Default</SelectItem>
                              <SelectItem value="boxed">Boxed</SelectItem>
                              <SelectItem value="minimal">Minimal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="flex items-center justify-between py-2 px-1">
                        <Label className="text-sm">Show VAT Summary</Label>
                        <Switch
                          checked={currentSettings.vat_summary_visibility === true}
                          onCheckedChange={(v) => updateSetting("vat_summary_visibility", v)}
                        />
                      </div>
                      <div className="flex items-center justify-between py-2 px-1">
                        <Label className="text-sm">Show Invoice Notes</Label>
                        <Switch
                          checked={currentSettings.notes_visibility !== false}
                          onCheckedChange={(v) => updateSetting("notes_visibility", v)}
                        />
                      </div>
                      <div className="pt-1">
                        <Label className="text-xs text-muted-foreground mb-2 block">Page Margins</Label>
                        <MarginControl
                          top={currentSettings.margin_top ?? 20}
                          right={currentSettings.margin_right ?? 20}
                          bottom={currentSettings.margin_bottom ?? 20}
                          left={currentSettings.margin_left ?? 20}
                          onChange={({ top, right, bottom, left }) =>
                            setCurrentSettings((prev) => ({
                              ...prev,
                              margin_top: top,
                              margin_right: right,
                              margin_bottom: bottom,
                              margin_left: left,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </TemplateControlSection>

                  {/* Preview PDF — Save is in the header */}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={!selectedTemplate}
                      onClick={async () => {
                        if (!selectedTemplate) return;
                        try {
                          await downloadPdfFromFunction(
                            `Template-Preview-${selectedTemplate.name.replace(/\s+/g, "-")}`,
                            templateForPreview.font_family,
                          );
                          toast({ title: "PDF preview opened" });
                        } catch {
                          toast({
                            title: "PDF error",
                            description: "Failed to generate preview.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Preview PDF
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT CANVAS */}
          <main className="flex-1 overflow-auto bg-muted/50">
            {isPreviewLoading ? (
              <div className="flex items-center justify-center min-h-full py-12 px-8">
                <div
                  className="bg-white shadow-2xl rounded-sm p-8 border border-border/30"
                  style={{ width: previewWidth, minHeight: "600px" }}
                >
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
              <div className="flex gap-6 items-start justify-center min-h-full py-12 px-6">
                {/* Saved */}
                <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saved</span>
                  </div>
                  <div
                    className="bg-white shadow-xl rounded-sm border border-border/20 overflow-hidden w-full"
                    style={{ maxWidth: "500px", fontFamily: selectedTemplate?.font_family || "Inter" }}
                  >
                    <link rel="stylesheet" href={getGoogleFontHref(selectedTemplate?.font_family || "Inter")} />
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
                      fontFamily: currentSettings.font_family || "Inter",
                      borderColor: currentSettings.primary_color || "#26A65B",
                      boxShadow: `0 10px 30px -8px ${currentSettings.primary_color || "#26A65B"}40`,
                    }}
                  >
                    <link rel="stylesheet" href={getGoogleFontHref(currentSettings.font_family || "Inter")} />
                    <UnifiedInvoiceLayout {...sharedLayoutBase} templateSettings={buildTemplateSettings()} />
                  </div>
                </div>
              </div>
            ) : (
              /* Single preview */
              <div className="flex items-center justify-center min-h-full py-12 px-8">
                <div
                  className="bg-white shadow-2xl rounded-sm overflow-hidden transition-all duration-300 border border-border/20"
                  style={{
                    width: previewWidth,
                    minHeight: previewMode === "print" ? "297mm" : "auto",
                    fontFamily: currentSettings.font_family || "Inter",
                    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)",
                  }}
                >
                  <link rel="stylesheet" href={getGoogleFontHref(currentSettings.font_family || "Inter")} />
                  <UnifiedInvoiceLayout {...sharedLayoutBase} templateSettings={buildTemplateSettings()} />
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
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(currentSettings.font_family || "Inter")}:wght@400;600;700&display=swap`}
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
