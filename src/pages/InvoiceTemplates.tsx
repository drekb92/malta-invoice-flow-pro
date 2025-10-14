import { useState, useEffect, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  Save,
  Eye,
  Star,
  Palette,
  Type,
  Settings2,
  Layout,
  Table,
  DollarSign,
  CreditCard,
  Sparkles,
  AlertCircle,
  RotateCcw,
  FileDown,
} from "lucide-react";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useBankingSettings } from "@/hooks/useBankingSettings";
import { UnifiedInvoiceLayout } from "@/components/UnifiedInvoiceLayout";
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import { generatePDF } from "@/lib/pdfGenerator";
import { useInvoiceTemplate, validateTemplateInvoiceData, normalizeInvoiceData } from "@/hooks/useInvoiceTemplate";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TemplateControlSection } from "@/components/templates/TemplateControlSection";
import { TemplateManagementPanel } from "@/components/templates/TemplateManagementPanel";
import { PreviewModeSelector, PreviewMode } from "@/components/templates/PreviewModeSelector";
import { FontPreviewSelect } from "@/components/templates/FontPreviewSelect";
import { MarginControl } from "@/components/templates/MarginControl";
import { Badge } from "@/components/ui/badge";

interface InvoiceTemplate {
  id: string;
  name: string;
  is_default: boolean;
  primary_color: string;
  accent_color: string;
  font_family: string;
  font_size: string;
  layout?: 'default' | 'cleanMinimal' | 'compact';
  header_layout?: 'default' | 'centered' | 'split';
  table_style?: 'default' | 'striped' | 'bordered' | 'minimal';
  totals_style?: 'default' | 'boxed' | 'highlighted';
  banking_visibility?: boolean;
  banking_style?: 'default' | 'boxed' | 'minimal';
  margin_top?: number;
  margin_right?: number;
  margin_bottom?: number;
  margin_left?: number;
  created_at?: string;
}

const designPresets = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Clean and minimal colors',
    settings: {
      primary_color: '#2563eb',
      accent_color: '#1e40af',
      font_family: 'Inter',
      font_size: '14px',
      layout: 'default' as const,
      header_layout: 'default' as const,
      table_style: 'minimal' as const,
      totals_style: 'boxed' as const,
    }
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Bold colors, sans-serif fonts',
    settings: {
      primary_color: '#7c3aed',
      accent_color: '#6d28d9',
      font_family: 'Poppins',
      font_size: '14px',
      layout: 'cleanMinimal' as const,
      header_layout: 'split' as const,
      table_style: 'striped' as const,
      totals_style: 'highlighted' as const,
    }
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional, serif fonts',
    settings: {
      primary_color: '#059669',
      accent_color: '#047857',
      font_family: 'Lato',
      font_size: '14px',
      layout: 'default' as const,
      header_layout: 'default' as const,
      table_style: 'bordered' as const,
      totals_style: 'default' as const,
    }
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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  
  // Use hooks to load company and banking settings
  const { settings: companySettings, isLoading: loadingCompany, isValid: companyValid, validationErrors: companyErrors } = useCompanySettings();
  const { settings: bankingSettings, isLoading: loadingBanking, isValid: bankingValid, validationErrors: bankingErrors } = useBankingSettings();

  // Load templates from Supabase
  const loadTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .order('is_default', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const typedData: InvoiceTemplate[] = data.map(t => ({
          ...t,
          layout: (t.layout === 'cleanMinimal' ? 'cleanMinimal' : t.layout === 'compact' ? 'compact' : 'default') as 'default' | 'cleanMinimal' | 'compact',
          header_layout: (t.header_layout || 'default') as 'default' | 'centered' | 'split',
          table_style: (t.table_style || 'default') as 'default' | 'striped' | 'bordered' | 'minimal',
          totals_style: (t.totals_style || 'default') as 'default' | 'boxed' | 'highlighted',
          banking_visibility: t.banking_visibility !== undefined ? t.banking_visibility : true,
          banking_style: (t.banking_style || 'default') as 'default' | 'boxed' | 'minimal',
          margin_top: t.margin_top || 20,
          margin_right: t.margin_right || 20,
          margin_bottom: t.margin_bottom || 20,
          margin_left: t.margin_left || 20,
        }));
        setTemplates(typedData);
        const defaultTemplate = typedData.find(t => t.is_default) || typedData[0];
        setSelectedTemplate(defaultTemplate);
        setCurrentSettings(defaultTemplate);
      } else {
        await createDefaultTemplate();
      }
    } catch (error) {
      console.error('Error loading templates:', error);
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
        name: 'Default Template',
        is_default: true,
        primary_color: '#26A65B',
        accent_color: '#1F2D3D',
        font_family: 'Inter',
        font_size: '14px',
        layout: 'default',
        header_layout: 'default',
        table_style: 'default',
        totals_style: 'default',
        banking_visibility: true,
        banking_style: 'default',
        margin_top: 20,
        margin_right: 20,
        margin_bottom: 20,
        margin_left: 20,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('invoice_templates')
        .insert([defaultTemplate])
        .select()
        .single();

      if (error) throw error;

      const typedData = {
        ...data,
        layout: 'default' as const,
        header_layout: 'default' as const,
        table_style: 'default' as const,
        totals_style: 'default' as const,
        banking_visibility: true,
        banking_style: 'default' as const,
      };
      setTemplates([typedData]);
      setSelectedTemplate(typedData);
      setCurrentSettings(typedData);
    } catch (error) {
      console.error('Error creating default template:', error);
    }
  };

  // Load templates on component mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const updateSetting = (key: keyof InvoiceTemplate, value: any) => {
    setCurrentSettings(prev => ({
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

  const applyPreset = (preset: typeof designPresets[0]) => {
    setCurrentSettings(prev => ({
      ...prev,
      ...preset.settings,
    }));
    toast({
      title: "Preset applied",
      description: `${preset.name} design preset has been applied.`,
    });
  };

  // Save template
  const handleSave = async () => {
    if (!selectedTemplate || !currentSettings.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('invoice_templates')
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
        .eq('id', currentSettings.id);

      if (error) throw error;

      setTemplates(prev => prev.map(t => 
        t.id === currentSettings.id ? { ...t, ...currentSettings } as InvoiceTemplate : t
      ));
      setSelectedTemplate({ ...selectedTemplate, ...currentSettings } as InvoiceTemplate);

      await refreshTemplate();

      toast({
        title: "Template saved",
        description: "Template settings have been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving template:', error);
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
      await downloadPdfFromFunction("invoice-template-test");
      toast({ 
        title: 'Test PDF generated', 
        description: 'Template PDF with sample data has been downloaded.' 
      });
    } catch (error: any) {
      console.error("Test failed:", error);
      toast({
        title: 'Test failed',
        description: error?.message || 'Could not generate test PDF.',
        variant: 'destructive',
      });
    }
  };

  // Set as default
  const handleSetDefault = async () => {
    if (!selectedTemplate) return;

    try {
      await supabase
        .from('invoice_templates')
        .update({ is_default: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      const { error } = await supabase
        .from('invoice_templates')
        .update({ is_default: true })
        .eq('id', selectedTemplate.id);

      if (error) throw error;

      setTemplates(prev => prev.map(t => ({
        ...t,
        is_default: t.id === selectedTemplate.id
      })));

      toast({
        title: "Default template set",
        description: "This template has been set as the default.",
      });
    } catch (error) {
      console.error('Error setting default template:', error);
      toast({
        title: "Error",
        description: "Failed to set default template. Please try again.",
        variant: "destructive",
      });
    }
  };

const fontFamilies = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Lato', label: 'Lato' },
    { value: 'Open Sans', label: 'Open Sans' },
    { value: 'Poppins', label: 'Poppins' },
  ];

  const fontSizes = [
    { value: "12", label: "12px" },
    { value: "14", label: "14px" },
    { value: "16", label: "16px" },
    { value: "18", label: "18px" },
  ];

  const templateForPreview = {
    id: (currentSettings as any).id || 'preview',
    name: (selectedTemplate?.name || 'Preview Template'),
    is_default: !!selectedTemplate?.is_default,
    primary_color: currentSettings.primary_color || '#26A65B',
    accent_color: currentSettings.accent_color || '#1F2D3D',
    font_family: currentSettings.font_family || 'Inter',
    font_size: currentSettings.font_size || '14px',
    layout: currentSettings.layout || 'default',
    header_layout: currentSettings.header_layout || 'default',
    table_style: currentSettings.table_style || 'default',
    totals_style: currentSettings.totals_style || 'default',
    banking_visibility: currentSettings.banking_visibility !== undefined ? currentSettings.banking_visibility : true,
    banking_style: currentSettings.banking_style || 'default',
  };

  const rawSampleData = {
    invoiceNumber: 'INV-2024-001',
    invoiceDate: '2024-01-15',
    dueDate: '2024-02-14',
    customer: {
      name: 'Sample Customer',
      email: 'customer@example.com',
      address: '456 Customer Ave\nSliema, Malta SLM 1234',
      vat_number: 'MT98765432',
    },
    items: [
      { description: 'Professional Services', quantity: 10, unit_price: 50, vat_rate: 0.18, unit: 'hours' },
      { description: 'Consultation Fee', quantity: 1, unit_price: 150, vat_rate: 0.18, unit: 'service' },
    ],
    totals: {
      netTotal: 650.00,
      vatTotal: 117.00,
      grandTotal: 767.00,
    },
  };

  const sampleInvoiceData = normalizeInvoiceData(rawSampleData);

  useEffect(() => {
    if (templateForPreview && sampleInvoiceData) {
      const validation = validateTemplateInvoiceData(templateForPreview as any, sampleInvoiceData);
      setValidationErrors(validation.errors);
    }
  }, [templateForPreview, currentSettings]);

  const getGoogleFontHref = (family: string) => {
    const familyParam = encodeURIComponent(family.trim());
    return `https://fonts.googleapis.com/css2?family=${familyParam}:wght@400;600;700&display=swap`;
  };

  const getPreviewDimensions = () => {
    switch (previewMode) {
      case 'mobile':
        return 'max-w-sm mx-auto';
      case 'print':
        return 'w-[210mm] mx-auto'; // A4 width
      case 'desktop':
      default:
        return 'max-w-4xl mx-auto';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Invoice Template Designer</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Design beautiful invoices with live preview
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PreviewModeSelector mode={previewMode} onModeChange={setPreviewMode} />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={resetToDefault}
                  disabled={!selectedTemplate}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSaveAndTest}
                  disabled={isSaving || !selectedTemplate}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Save & Test
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Validation Warnings */}
          {(!companyValid || !bankingValid) && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Action Required:</strong>
                <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                  {companyErrors.map((error, i) => (
                    <li key={`company-${i}`}>{error} - <a href="/settings" className="underline">Go to Settings</a></li>
                  ))}
                  {bankingErrors.map((error, i) => (
                    <li key={`banking-${i}`}>{error} - <a href="/settings" className="underline">Go to Settings</a></li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Design Controls */}
            <div className="lg:col-span-1 space-y-4">
              {isLoading ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="text-muted-foreground">Loading templates...</div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Template Management */}
                  {user && (
                    <Card>
                      <CardContent className="pt-6">
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
                      </CardContent>
                    </Card>
                  )}

                  {/* Template Selector */}
                  {templates.length > 0 && selectedTemplate && (
                    <Card>
                      <CardContent className="pt-6 space-y-3">
                        <Label className="text-sm font-medium">Active Template</Label>
                        <Select 
                          value={selectedTemplate.id} 
                          onValueChange={(value) => {
                            const template = templates.find(t => t.id === value);
                            if (template) {
                              setSelectedTemplate(template);
                              setCurrentSettings(template);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                <div className="flex items-center gap-2">
                                  {template.name}
                                  {template.is_default && (
                                    <Badge variant="secondary" className="text-xs">Default</Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  )}

                  {/* Design Controls Card */}
                  <Card>
                    <CardContent className="pt-6 space-y-6">
                      {/* Info Message */}
                      <Alert>
                        <Settings2 className="h-4 w-4" />
                        <AlertDescription>
                          Company logo and banking details are managed in{" "}
                          <a href="/settings" className="underline font-medium">Settings</a>.
                          Template controls below affect visual design only.
                        </AlertDescription>
                      </Alert>

                      {/* Design Presets */}
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Design Presets
                        </Label>
                        <div className="grid grid-cols-1 gap-2">
                          {designPresets.map((preset) => (
                            <Button
                              key={preset.id}
                              variant="outline"
                              size="sm"
                              className="justify-start h-auto py-3"
                              onClick={() => applyPreset(preset)}
                            >
                              <div className="text-left">
                                <div className="font-medium">{preset.name}</div>
                                <div className="text-xs text-muted-foreground">{preset.description}</div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Colors */}
                      <div className="space-y-4">
                        <Label className="flex items-center gap-2">
                          <Palette className="h-4 w-4" />
                          Colors
                        </Label>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm">Primary Color</Label>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded border border-border"
                                style={{ backgroundColor: currentSettings.primary_color }}
                              />
                              <Input
                                type="color"
                                value={currentSettings.primary_color || '#26A65B'}
                                onChange={(e) => updateSetting('primary_color', e.target.value)}
                                className="w-16 h-8 p-0 border-0"
                              />
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-sm">Accent Color</Label>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded border border-border"
                                style={{ backgroundColor: currentSettings.accent_color }}
                              />
                              <Input
                                type="color"
                                value={currentSettings.accent_color || '#1F2D3D'}
                                onChange={(e) => updateSetting('accent_color', e.target.value)}
                                className="w-16 h-8 p-0 border-0"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Typography */}
                      <div className="space-y-4">
                        <Label className="flex items-center gap-2">
                          <Type className="h-4 w-4" />
                          Typography
                        </Label>
                        
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm">Font Family</Label>
                            <Select value={currentSettings.font_family || 'Inter'} onValueChange={(value) => updateSetting('font_family', value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {fontFamilies.map((font) => (
                                  <SelectItem key={font.value} value={font.value}>
                                    {font.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label className="text-sm">Font Size</Label>
                            <Select value={currentSettings.font_size || '14px'} onValueChange={(value) => updateSetting('font_size', value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {fontSizes.map((size) => (
                                  <SelectItem key={size.value} value={`${size.value}px`}>
                                    {size.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Layout Style */}
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <Layout className="h-4 w-4" />
                          Layout Style
                        </Label>
                        <Select 
                          value={currentSettings.layout || 'default'} 
                          onValueChange={(value) => updateSetting('layout', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="cleanMinimal">Clean Minimal</SelectItem>
                            <SelectItem value="compact">Compact</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      {/* Header Layout */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Header Layout</Label>
                        <Select 
                          value={currentSettings.header_layout || 'default'} 
                          onValueChange={(value) => updateSetting('header_layout', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Logo Left + Details Right</SelectItem>
                            <SelectItem value="centered">Centered</SelectItem>
                            <SelectItem value="split">Split Layout</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      {/* Table Styling */}
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <Table className="h-4 w-4" />
                          Items Table Style
                        </Label>
                        <Select 
                          value={currentSettings.table_style || 'default'} 
                          onValueChange={(value) => updateSetting('table_style', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="striped">Striped Rows</SelectItem>
                            <SelectItem value="bordered">Bordered</SelectItem>
                            <SelectItem value="minimal">Minimal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      {/* Totals Styling */}
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Totals Section Style
                        </Label>
                        <Select 
                          value={currentSettings.totals_style || 'default'} 
                          onValueChange={(value) => updateSetting('totals_style', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default</SelectItem>
                            <SelectItem value="boxed">Boxed</SelectItem>
                            <SelectItem value="highlighted">Highlighted</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      {/* Banking Section */}
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Banking Section
                        </Label>
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Show Banking Details</Label>
                          <Switch
                            checked={currentSettings.banking_visibility !== false}
                            onCheckedChange={(checked) => updateSetting('banking_visibility', checked)}
                          />
                        </div>
                        {currentSettings.banking_visibility !== false && (
                          <Select 
                            value={currentSettings.banking_style || 'default'} 
                            onValueChange={(value) => updateSetting('banking_style', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Default</SelectItem>
                              <SelectItem value="boxed">Boxed</SelectItem>
                              <SelectItem value="minimal">Minimal</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <Separator />

                      {/* Margins */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Page Margins (mm)</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Top</Label>
                            <Input
                              type="number"
                              min="0"
                              max="50"
                              value={currentSettings.margin_top || 20}
                              onChange={(e) => updateSetting('margin_top', parseInt(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Right</Label>
                            <Input
                              type="number"
                              min="0"
                              max="50"
                              value={currentSettings.margin_right || 20}
                              onChange={(e) => updateSetting('margin_right', parseInt(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Bottom</Label>
                            <Input
                              type="number"
                              min="0"
                              max="50"
                              value={currentSettings.margin_bottom || 20}
                              onChange={(e) => updateSetting('margin_bottom', parseInt(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Left</Label>
                            <Input
                              type="number"
                              min="0"
                              max="50"
                              value={currentSettings.margin_left || 20}
                              onChange={(e) => updateSetting('margin_left', parseInt(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2 pt-4">
                        <Button 
                          className="w-full" 
                          onClick={handleSave}
                          disabled={isSaving || !selectedTemplate}
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {isSaving ? 'Saving...' : 'Save Template'}
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={handleSetDefault}
                          disabled={!selectedTemplate || selectedTemplate?.is_default}
                        >
                          <Star className="h-4 w-4 mr-2" />
                          {selectedTemplate?.is_default ? 'Default Template' : 'Set as Default'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {/* Live Preview */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Live Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {validationErrors.length > 0 && (
                    <Alert className="mb-4" variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside text-sm">
                          {validationErrors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className={`${getPreviewDimensions()} bg-white rounded-lg shadow-lg overflow-auto`}
                       style={{ 
                         maxHeight: previewMode === 'print' ? '297mm' : '800px',
                         fontFamily: currentSettings.font_family || 'Inter'
                       }}>
                    <link rel="stylesheet" href={getGoogleFontHref(currentSettings.font_family || 'Inter')} />
                    
                    <UnifiedInvoiceLayout
                      invoiceData={sampleInvoiceData}
                      companySettings={companySettings ? {
                        name: companySettings.company_name || '',
                        address: companySettings.company_address || '',
                        city: companySettings.company_city || '',
                        zipCode: companySettings.company_zip_code || '',
                        country: companySettings.company_country || '',
                        phone: companySettings.company_phone || '',
                        email: companySettings.company_email || '',
                        taxId: companySettings.company_vat_number || '',
                        logo: companySettings.company_logo || '',
                      } : undefined}
                      bankingSettings={bankingSettings ? {
                        bankName: bankingSettings.bank_name || '',
                        accountName: bankingSettings.bank_account_name || '',
                        iban: bankingSettings.bank_iban || '',
                        swiftCode: bankingSettings.bank_swift_code || '',
                      } : undefined}
                      templateSettings={{
                        primaryColor: templateForPreview.primary_color,
                        accentColor: templateForPreview.accent_color,
                        fontFamily: templateForPreview.font_family,
                        fontSize: templateForPreview.font_size,
                        layout: currentSettings.layout || 'default',
                        headerLayout: currentSettings.header_layout || 'default',
                        tableStyle: currentSettings.table_style || 'default',
                        totalsStyle: currentSettings.totals_style || 'default',
                        bankingVisibility: currentSettings.banking_visibility !== false,
                        bankingStyle: currentSettings.banking_style || 'default',
                        marginTop: currentSettings.margin_top || 20,
                        marginRight: currentSettings.margin_right || 20,
                        marginBottom: currentSettings.margin_bottom || 20,
                        marginLeft: currentSettings.margin_left || 20,
                      }}
                      debug={false}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Hidden Font Injector for Google Font based on template */}
      <div style={{ display: 'none' }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(currentSettings.font_family || 'Inter')}:wght@400;600;700&display=swap`}
          rel="stylesheet"
        />
      </div>

      {/* A4 canvas + template CSS variables */}
      <style>{`
        @page { size: A4; margin: 0; }
        #invoice-preview-root{
          --font: '${currentSettings.font_family || 'Inter'}', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          --color-primary: ${currentSettings.primary_color || '#111827'};
          --color-accent: ${currentSettings.accent_color || '#2563EB'};

          /* margins (mm) */
          --m-top: ${typeof currentSettings.margin_top === 'number' ? `${currentSettings.margin_top}mm` : '20mm'};
          --m-right: ${typeof currentSettings.margin_right === 'number' ? `${currentSettings.margin_right}mm` : '20mm'};
          --m-bottom: ${typeof currentSettings.margin_bottom === 'number' ? `${currentSettings.margin_bottom}mm` : '20mm'};
          --m-left: ${typeof currentSettings.margin_left === 'number' ? `${currentSettings.margin_left}mm` : '20mm'};

          width: 210mm; min-height: 297mm; background:#fff; color: var(--color-primary);
          font-family: var(--font);
          box-sizing: border-box; position: relative;
        }
        #invoice-inner{
          padding-top: var(--m-top);
          padding-right: var(--m-right);
          padding-bottom: var(--m-bottom);
          padding-left: var(--m-left);
        }
      `}</style>

      {/* Hidden A4 DOM used for 1:1 export for PDF testing */}
      <div style={{ display: 'none' }}>
        <UnifiedInvoiceLayout
          id="invoice-preview-root"
          variant="pdf"
          invoiceData={sampleInvoiceData}
          companySettings={companySettings ? {
            name: companySettings.company_name || '',
            address: companySettings.company_address || '',
            city: companySettings.company_city || '',
            zipCode: companySettings.company_zip_code || '',
            country: companySettings.company_country || '',
            phone: companySettings.company_phone || '',
            email: companySettings.company_email || '',
            taxId: companySettings.company_vat_number || '',
            registrationNumber: companySettings.company_registration_number || '',
            logo: companySettings.company_logo || '',
          } : undefined}
          bankingSettings={bankingSettings ? {
            bankName: bankingSettings.bank_name || '',
            accountName: bankingSettings.bank_account_name || '',
            iban: bankingSettings.bank_iban || '',
            swiftCode: bankingSettings.bank_swift_code || '',
          } : undefined}
          templateSettings={{
            primaryColor: templateForPreview.primary_color,
            accentColor: templateForPreview.accent_color,
            fontFamily: templateForPreview.font_family,
            fontSize: templateForPreview.font_size,
            layout: currentSettings.layout || 'default',
            headerLayout: currentSettings.header_layout || 'default',
            tableStyle: currentSettings.table_style || 'default',
            totalsStyle: currentSettings.totals_style || 'default',
            bankingVisibility: currentSettings.banking_visibility !== false,
            bankingStyle: currentSettings.banking_style || 'default',
            marginTop: currentSettings.margin_top || 20,
            marginRight: currentSettings.margin_right || 20,
            marginBottom: currentSettings.margin_bottom || 20,
            marginLeft: currentSettings.margin_left || 20,
          }}
          debug={false}
        />
      </div>
    </div>
  );
};

export default InvoiceTemplates;
