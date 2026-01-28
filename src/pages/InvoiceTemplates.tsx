import { useState, useEffect, useCallback, useMemo } from "react";
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
  Save,
  Star,
  Palette,
  Type,
  Settings2,
  Layout,
  AlertCircle,
  RotateCcw,
  FileDown,
  Loader2,
} from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { UnifiedInvoiceLayout } from "@/components/UnifiedInvoiceLayout";
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import { useInvoiceTemplate } from "@/hooks/useInvoiceTemplate";
import { useInvoicePreview, SAMPLE_INVOICE_DATA } from "@/hooks/useInvoicePreview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TemplateControlSection } from "@/components/templates/TemplateControlSection";
import { TemplateManagementPanel } from "@/components/templates/TemplateManagementPanel";
import { PreviewModeSelector, PreviewMode } from "@/components/templates/PreviewModeSelector";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  margin_top?: number;
  margin_right?: number;
  margin_bottom?: number;
  margin_left?: number;
  created_at?: string;
}

const designPresets = [
  {
    id: "malta-professional",
    name: "Malta Professional",
    description:
      "Optimized for Malta business standards. Features clean layout with proper VAT display and local compliance requirements. Best for registered businesses in Malta.",
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
    name: "Service Business",
    description:
      "Perfect for consultants, contractors, and professional services. Emphasizes detailed service descriptions with clean minimal layout. Ideal for hourly work and project-based billing.",
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
    name: "Retail/Products",
    description:
      "Designed for product sales and retail businesses. Features striped tables for easy scanning of multiple items, quantities, and prices. Best for shops and e-commerce.",
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
    name: "Minimal Clean",
    description:
      "Ultra-simple design for businesses wanting straightforward invoices. Removes visual clutter while maintaining professionalism. Great for freelancers and small businesses.",
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
    description:
      "Formal and structured design for established companies and B2B relationships. Features traditional layout with prominent branding and detailed breakdowns. Ideal for large contracts.",
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

  // Use hooks to load company and banking settings
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

  // Load templates from Supabase
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
          margin_top: t.margin_top || 20,
          margin_right: t.margin_right || 20,
          margin_bottom: t.margin_bottom || 20,
          margin_left: t.margin_left || 20,
        }));
        setTemplates(typedData);
        const defaultTemplate = typedData.find((t) => t.is_default) || typedData[0];
        setSelectedTemplate(defaultTemplate);
        setCurrentSettings(defaultTemplate);
      } else {
        await createDefaultTemplate();
      }
    } catch (error) {
      console.error("Error loading templates:", error);
      toast({
        title: "Error loading templates",
        description: "Failed to load invoice templates from database.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Create default template
  const createDefaultTemplate = async () => {
    try {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const defaultTemplate = {
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
        margin_top: 20,
        margin_right: 20,
        margin_bottom: 20,
        margin_left: 20,
        user_id: user.id,
      };

      const { data, error } = await supabase.from("invoice_templates").insert([defaultTemplate]).select().single();

      if (error) throw error;

      const typedData = {
        ...data,
        layout: "default" as const,
        header_layout: "default" as const,
        table_style: "default" as const,
        totals_style: "default" as const,
        banking_visibility: true,
        banking_style: "default" as const,
      };
      setTemplates([typedData]);
      setSelectedTemplate(typedData);
      setCurrentSettings(typedData);
    } catch (error) {
      console.error("Error creating default template:", error);
    }
  };

  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const updateSetting = (key: keyof InvoiceTemplate, value: any) => {
    setCurrentSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetToDefault = () => {
    if (!selectedTemplate) return;
    setCurrentSettings(selectedTemplate);
    toast({
      title: "Settings reset",
      description: "Changes have been reset to the saved template.",
    });
  };

  const applyPreset = (preset: (typeof designPresets)[0]) => {
    setCurrentSettings((prev) => ({
      ...prev,
      ...preset.settings,
    }));
    toast({
      title: "Preset applied",
      description: `${preset.name} design preset has been applied.`,
    });
  };

  // Validation function for template data
  const validateTemplateData = () => {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Company validation
    if (!companySettings?.company_name) warnings.push("Company name not set");
    if (!companySettings?.company_logo) warnings.push("Company logo not uploaded");
    if (!companySettings?.company_address) warnings.push("Company address missing");
    if (!companySettings?.company_vat_number) warnings.push("VAT number not set");

    // Banking validation (only if banking visibility is enabled)
    if (currentSettings.banking_visibility !== false) {
      if (!bankingSettings?.bank_name) warnings.push("Bank name not set");
      if (!bankingSettings?.bank_account_name) warnings.push("Bank account name missing");
      if (!bankingSettings?.bank_iban) warnings.push("IBAN not provided");
    }

    // Template validation
    if (!currentSettings.primary_color) errors.push("Primary color required");
    if (!currentSettings.font_family) errors.push("Font family required");

    return { warnings, errors, isValid: errors.length === 0 };
  };

  // Save template
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

      await refreshTemplate();

      // Validate after save and show results
      const validation = validateTemplateData();

      if (validation.warnings.length > 0) {
        // Show warning toast with list of missing items
        toast({
          title: "Template saved with warnings",
          description: `Your template was saved, but some settings are incomplete: ${validation.warnings.join(", ")}. Complete these in Settings for best results.`,
          variant: "default", // Not destructive since it's just warnings
          duration: 6000, // Longer duration for more text
        });
      } else {
        // Show success toast
        toast({
          title: "Template saved successfully",
          description: "All template settings are complete and ready to use.",
        });
      }
    } catch (error) {
      console.error("Error saving template:", error);
      toast({
        title: "Save failed",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndTest = async () => {
    await handleSave();

    try {
      // Pass font_family to ensure proper font loading in PDF
      await downloadPdfFromFunction("invoice-template-test", currentSettings.font_family || "Inter");
      toast({
        title: "Test PDF generated",
        description: "Template PDF with sample data has been downloaded.",
      });
    } catch (error: any) {
      console.error("Test failed:", error);
      toast({
        title: "Test failed",
        description: error?.message || "Could not generate test PDF.",
        variant: "destructive",
      });
    }
  };

  // Set as default
  const handleSetDefault = async () => {
    if (!selectedTemplate) return;

    try {
      await supabase
        .from("invoice_templates")
        .update({ is_default: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      const { error } = await supabase
        .from("invoice_templates")
        .update({ is_default: true })
        .eq("id", selectedTemplate.id);

      if (error) throw error;

      setTemplates((prev) =>
        prev.map((t) => ({
          ...t,
          is_default: t.id === selectedTemplate.id,
        })),
      );

      toast({
        title: "Default template set",
        description: "This template has been set as the default.",
      });
    } catch (error) {
      console.error("Error setting default template:", error);
      toast({
        title: "Error",
        description: "Failed to set default template. Please try again.",
        variant: "destructive",
      });
    }
  };

  const fontFamilies = [
    { value: "Inter", label: "Inter" },
    { value: "Roboto", label: "Roboto" },
    { value: "Lato", label: "Lato" },
    { value: "Open Sans", label: "Open Sans" },
    { value: "Poppins", label: "Poppins" },
  ];


  const templateForPreview = {
    id: (currentSettings as any).id || "preview",
    name: selectedTemplate?.name || "Preview Template",
    is_default: !!selectedTemplate?.is_default,
    primary_color: currentSettings.primary_color || "#26A65B",
    accent_color: currentSettings.accent_color || "#1F2D3D",
    font_family: currentSettings.font_family || "Inter",
    font_size: currentSettings.font_size || "14px",
    layout: currentSettings.layout || "default",
    header_layout: currentSettings.header_layout || "default",
    table_style: currentSettings.table_style || "default",
    totals_style: currentSettings.totals_style || "default",
    banking_visibility: currentSettings.banking_visibility !== undefined ? currentSettings.banking_visibility : true,
    banking_style: currentSettings.banking_style || "default",
  };

  // Use the invoice preview hook for sample data and calculations
  const { data: sampleInvoiceData } = useInvoicePreview({ useSampleData: true });

  // Determine if preview is ready
  const isPreviewLoading = isLoading || loadingCompany || loadingBanking;

  const getGoogleFontHref = (family: string) => {
    const familyParam = encodeURIComponent(family.trim());
    return `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;600;700&display=swap`;
  };

  const getPreviewDimensions = () => {
    switch (previewMode) {
      case "mobile":
        return "max-w-sm mx-auto";
      case "print":
        return "w-[210mm] mx-auto"; // A4 width
      case "desktop":
      default:
        return "max-w-4xl mx-auto";
    }
  };

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
                <Button variant="outline" size="sm" onClick={resetToDefault} disabled={!selectedTemplate}>
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAndTest}
                  disabled={isSaving || !selectedTemplate}
                >
                  <FileDown className="h-4 w-4 mr-1.5" />
                  Save & Test PDF
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content: Two Column Editor Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT SIDEBAR: Controls (320px fixed) */}
          <aside className="w-[320px] flex-shrink-0 border-r border-border bg-card overflow-y-auto">
            <div className="p-4 space-y-1">
              {/* Validation Warnings */}
              {(!companyValid || !bankingValid) && (
                <Alert className="mb-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>Setup Required:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {companyErrors.slice(0, 2).map((error, i) => (
                        <li key={`company-${i}`}>{error}</li>
                      ))}
                      {bankingErrors.slice(0, 2).map((error, i) => (
                        <li key={`banking-${i}`}>{error}</li>
                      ))}
                    </ul>
                    <a href="/settings" className="underline text-primary mt-1 inline-block">
                      Go to Settings →
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              {isLoading ? (
                <div className="py-12 text-center">
                  <div className="text-muted-foreground text-sm">Loading templates...</div>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Section: Template Selection */}
                  <TemplateControlSection 
                    title="Template Selection" 
                    icon={<Layout className="h-4 w-4 text-muted-foreground" />}
                    defaultOpen={true}
                  >
                    {/* Template Management */}
                    {user && (
                      <TemplateManagementPanel
                        templates={templates}
                        selectedTemplate={selectedTemplate}
                        currentSettings={currentSettings}
                        userId={user.id}
                        onTemplateCreated={loadTemplates}
                        onTemplateDeleted={loadTemplates}
                        onTemplateSelected={(template) => {
                          setSelectedTemplate(template);
                          setCurrentSettings(template);
                        }}
                      />
                    )}

                    {/* Active Template Selector */}
                    {templates.length > 0 && selectedTemplate && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Active Template</Label>
                        <Select
                          value={selectedTemplate.id}
                          onValueChange={(value) => {
                            const template = templates.find((t) => t.id === value);
                            if (template) {
                              setSelectedTemplate(template);
                              setCurrentSettings(template);
                            }
                          }}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                <div className="flex items-center gap-2">
                                  {template.name}
                                  {template.is_default && (
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

                    {/* Set Default Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={handleSetDefault}
                      disabled={!selectedTemplate || selectedTemplate?.is_default}
                    >
                      <Star className="h-4 w-4 mr-2" />
                      {selectedTemplate?.is_default ? "Default Template" : "Set as Default"}
                    </Button>
                  </TemplateControlSection>

                  {/* Section: Brand Colors */}
                  <TemplateControlSection 
                    title="Brand Colors" 
                    icon={<Palette className="h-4 w-4 text-muted-foreground" />}
                    defaultOpen={true}
                  >
                    {/* Color Picker */}
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

                    {/* Professional Preset Colors */}
                    <div className="pt-3">
                      <Label className="text-xs text-muted-foreground mb-2 block">Professional Presets</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { name: "Navy", color: "#1e3a5f" },
                          { name: "Slate", color: "#475569" },
                          { name: "Emerald", color: "#065f46" },
                          { name: "Maroon", color: "#7f1d1d" },
                          { name: "Indigo", color: "#3730a3" },
                          { name: "Charcoal", color: "#1f2937" },
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            className={`flex items-center gap-2 p-2 rounded-md border transition-all hover:ring-2 hover:ring-primary/50 ${
                              currentSettings.primary_color === preset.color 
                                ? "ring-2 ring-primary border-primary" 
                                : "border-border"
                            }`}
                            onClick={() => updateSetting("primary_color", preset.color)}
                          >
                            <div
                              className="w-5 h-5 rounded-full border border-border/50 flex-shrink-0"
                              style={{ backgroundColor: preset.color }}
                            />
                            <span className="text-xs font-medium truncate">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Accent Color (Secondary) */}
                    <div className="pt-3">
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
                        <div className="flex-1">
                          <div className="text-xs font-mono text-muted-foreground">
                            {currentSettings.accent_color || "#1F2D3D"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TemplateControlSection>

                  {/* Section: Typography */}
                  <TemplateControlSection 
                    title="Typography" 
                    icon={<Type className="h-4 w-4 text-muted-foreground" />}
                    defaultOpen={false}
                  >
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Font Family</Label>
                        <Select
                          value={currentSettings.font_family || "Inter"}
                          onValueChange={(value) => updateSetting("font_family", value)}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            {fontFamilies.map((font) => (
                              <SelectItem key={font.value} value={font.value}>
                                <span style={{ fontFamily: font.value }}>{font.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                    </div>
                  </TemplateControlSection>

                  {/* Section: Layout Options */}
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
                          onValueChange={(value) => updateSetting("layout", value)}
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
                        <Label className="text-xs text-muted-foreground">Table Style</Label>
                        <Select
                          value={currentSettings.table_style || "default"}
                          onValueChange={(value) => updateSetting("table_style", value)}
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
                          onValueChange={(value) => updateSetting("totals_style", value)}
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
                          onCheckedChange={(checked) => updateSetting("banking_visibility", checked)}
                        />
                      </div>
                    </div>
                  </TemplateControlSection>


                  {/* Save Button */}
                  <div className="pt-4 space-y-2">
                    <Button className="w-full" onClick={handleSave} disabled={isSaving || !selectedTemplate}>
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? "Saving..." : "Save Template"}
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={async () => {
                        if (!selectedTemplate) return;
                        try {
                          const filename = `Template-Preview-${selectedTemplate.name.replace(/\s+/g, "-")}`;
                          await downloadPdfFromFunction(filename, templateForPreview?.font_family);
                          toast({
                            title: "Export opened",
                            description: 'Print dialog opened. Choose "Save as PDF" to download.',
                          });
                        } catch (error) {
                          console.error("[InvoiceTemplates] PDF preview error:", error);
                          toast({
                            title: "PDF error",
                            description: "Failed to generate PDF preview.",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={!selectedTemplate}
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Preview PDF
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT CANVAS: A4 Live Preview - Light gray background */}
          <main className="flex-1 overflow-auto bg-muted/50">
            <div className="flex items-center justify-center min-h-full py-12 px-8">
              {/* Loading State */}
              {isPreviewLoading ? (
                <div
                  className="bg-white shadow-2xl rounded-sm overflow-hidden p-6 border border-border/30"
                  style={{
                    width: previewMode === "mobile" ? "375px" : previewMode === "print" ? "210mm" : "794px",
                    minHeight: "600px",
                  }}
                >
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                      <div className="text-sm text-muted-foreground">Loading preview...</div>
                    </div>
                  </div>
                  {/* Skeleton layout */}
                  <div className="space-y-4 mt-8">
                    <div className="flex justify-between">
                      <Skeleton className="h-16 w-32" />
                      <div className="space-y-2 text-right">
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
                    <div className="space-y-2 mt-6">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  </div>
                </div>
              ) : (
                /* Paper Effect: White A4 with shadow - simulates physical paper */
                <div
                  className="bg-white shadow-2xl rounded-sm overflow-hidden transition-all duration-300 border border-border/20"
                  style={{
                    width: previewMode === "mobile" ? "375px" : previewMode === "print" ? "210mm" : "794px",
                    minHeight: previewMode === "print" ? "297mm" : "auto",
                    fontFamily: currentSettings.font_family || "Inter",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <link rel="stylesheet" href={getGoogleFontHref(currentSettings.font_family || "Inter")} />

                  <UnifiedInvoiceLayout
                    invoiceData={sampleInvoiceData}
                    companySettings={
                      companySettings
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
                        : undefined
                    }
                    bankingSettings={
                      bankingSettings
                        ? {
                            bankName: bankingSettings.bank_name || "",
                            accountName: bankingSettings.bank_account_name || "",
                            iban: bankingSettings.bank_iban || "",
                            swiftCode: bankingSettings.bank_swift_code || "",
                          }
                        : undefined
                    }
                    templateSettings={{
                      primaryColor: templateForPreview.primary_color,
                      accentColor: templateForPreview.accent_color,
                      fontFamily: templateForPreview.font_family,
                      fontSize: templateForPreview.font_size,
                      layout: currentSettings.layout || "default",
                      headerLayout: currentSettings.header_layout || "default",
                      tableStyle: currentSettings.table_style || "default",
                      totalsStyle: currentSettings.totals_style || "default",
                      bankingVisibility: currentSettings.banking_visibility !== false,
                      bankingStyle: currentSettings.banking_style || "default",
                      marginTop: currentSettings.margin_top || 20,
                      marginRight: currentSettings.margin_right || 20,
                      marginBottom: currentSettings.margin_bottom || 20,
                      marginLeft: currentSettings.margin_left || 20,
                    }}
                  />
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Hidden Font Injector for Google Font based on template */}
      <div style={{ display: "none" }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(currentSettings.font_family || "Inter")}:wght@400;600;700&display=swap`}
          rel="stylesheet"
        />
      </div>

      {/* PDF styles are embedded in UnifiedInvoiceLayout */}

      {/* Hidden A4 DOM used for 1:1 export for PDF testing */}
      <div style={{ display: "none" }}>
        <UnifiedInvoiceLayout
          id="invoice-preview-root"
          variant="pdf"
          invoiceData={sampleInvoiceData}
          companySettings={
            companySettings
              ? {
                  name: companySettings.company_name || "",
                  address: companySettings.company_address || "",
                  city: companySettings.company_city || "",
                  zipCode: companySettings.company_zip_code || "",
                  country: companySettings.company_country || "",
                  phone: companySettings.company_phone || "",
                  email: companySettings.company_email || "",
                  taxId: companySettings.company_vat_number || "",
                  registrationNumber: companySettings.company_registration_number || "",
                  logo: companySettings.company_logo || "",
                }
              : undefined
          }
          bankingSettings={
            bankingSettings
              ? {
                  bankName: bankingSettings.bank_name || "",
                  accountName: bankingSettings.bank_account_name || "",
                  iban: bankingSettings.bank_iban || "",
                  swiftCode: bankingSettings.bank_swift_code || "",
                }
              : undefined
          }
          templateSettings={{
            primaryColor: templateForPreview.primary_color,
            accentColor: templateForPreview.accent_color,
            fontFamily: templateForPreview.font_family,
            fontSize: templateForPreview.font_size,
            layout: currentSettings.layout || "default",
            headerLayout: currentSettings.header_layout || "default",
            tableStyle: currentSettings.table_style || "default",
            totalsStyle: currentSettings.totals_style || "default",
            bankingVisibility: currentSettings.banking_visibility !== false,
            bankingStyle: currentSettings.banking_style || "default",
            marginTop: currentSettings.margin_top || 20,
            marginRight: currentSettings.margin_right || 20,
            marginBottom: currentSettings.margin_bottom || 20,
            marginLeft: currentSettings.margin_left || 20,
          }}
        />
      </div>
    </div>
  );
};

export default InvoiceTemplates;
