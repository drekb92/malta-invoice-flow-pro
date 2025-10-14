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
  Plus,
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
} from "lucide-react";
import { UnifiedInvoiceLayout } from "@/components/UnifiedInvoiceLayout";
import { downloadPdfFromFunction } from "@/lib/edgePdf";
import { generatePDF } from "@/lib/pdfGenerator";
import { useInvoiceTemplate, validateTemplateInvoiceData, normalizeInvoiceData } from "@/hooks/useInvoiceTemplate";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [bankingSettings, setBankingSettings] = useState<any>(null);

  // Load company and banking settings for preview
  const loadSettingsForPreview = useCallback(async () => {
    try {
      const [companyRes, bankingRes] = await Promise.all([
        supabase.from('company_settings').select('*').eq('user_id', user?.id).single(),
        supabase.from('banking_details').select('*').eq('user_id', user?.id).single(),
      ]);

      if (companyRes.data) setCompanySettings(companyRes.data);
      if (bankingRes.data) setBankingSettings(bankingRes.data);
    } catch (error) {
      console.error('Error loading settings for preview:', error);
    }
  }, [user]);

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

  // Load templates and settings on component mount
  useEffect(() => {
    loadTemplates();
    loadSettingsForPreview();
  }, [loadTemplates, loadSettingsForPreview]);

  const updateSetting = (key: keyof InvoiceTemplate, value: any) => {
    setCurrentSettings(prev => ({
      ...prev,
      [key]: value,
    }));
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
    { value: "Inter", label: "Inter" },
    { value: "Roboto", label: "Roboto" },
    { value: "Open Sans", label: "Open Sans" },
    { value: "Montserrat", label: "Montserrat" },
    { value: "Lato", label: "Lato" },
    { value: "Poppins", label: "Poppins" },
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="md:ml-64">
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Invoice Templates</h1>
                <p className="text-muted-foreground">
                  Customize your invoice design and styling
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={async () => {
                    try {
                      await downloadPdfFromFunction("invoice-template-preview");
                      toast({ 
                        title: 'Downloaded', 
                        description: 'Template preview saved as PDF.' 
                      });
                    } catch (error: any) {
                      console.error("Export failed:", error);
                      const errorMsg = error?.message || '';
                      if (errorMsg.includes('Parallel conversions limit') || errorMsg.includes('403')) {
                        toast({
                          title: 'PDF service busy',
                          description: 'Please wait a moment and try again, or use the Legacy Download button.',
                          variant: 'destructive',
                        });
                      } else {
                        toast({
                          title: 'Export failed',
                          description: errorMsg || 'Could not generate PDF from preview.',
                          variant: 'destructive',
                        });
                      }
                    }
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={async () => {
                    try {
                      await generatePDF('invoice-preview-root', 'invoice-template-preview', {
                        format: 'A4',
                        orientation: 'portrait',
                        margin: 15,
                        quality: 0.95
                      });
                      toast({ 
                        title: 'Downloaded', 
                        description: 'Template preview saved as PDF (legacy).' 
                      });
                    } catch (error: any) {
                      console.error("Export failed:", error);
                      toast({
                        title: 'Export failed',
                        description: error?.message || 'Could not generate PDF from preview.',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  Legacy Download
                </Button>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Design Controls */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Design Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading ? (
                    <div className="text-center py-8">Loading templates...</div>
                  ) : (
                    <>
                      {/* Template Tabs */}
                      {templates.length > 0 && selectedTemplate && (
                        <Tabs value={selectedTemplate.id} onValueChange={(value) => {
                          const template = templates.find(t => t.id === value);
                          if (template) {
                            setSelectedTemplate(template);
                            setCurrentSettings(template);
                          }
                        }}>
                          <TabsList className="grid w-full grid-cols-2">
                            {templates.map((template) => (
                              <TabsTrigger key={template.id} value={template.id} className="text-xs">
                                {template.name}
                                {template.is_default && <Star className="h-3 w-3 ml-1 fill-current" />}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </Tabs>
                      )}

                      <Separator />

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
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Live Canvas Preview */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Live Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  {validationErrors.length > 0 && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>
                        <strong>Template Validation Issues:</strong>
                        <ul className="list-disc list-inside mt-2">
                          {validationErrors.map((error, idx) => (
                            <li key={idx}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div id="font-injector" style={{ display: 'none' }}>
                    <link rel="preconnect" href="https://fonts.googleapis.com" />
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                    <link href={getGoogleFontHref(templateForPreview.font_family || 'Inter')} rel="stylesheet" />
                  </div>

                  <style>{`
                    @page { size: A4; margin: 0; }
                    @media print {
                      tr, td, th { page-break-inside: avoid; }
                      .avoid-break { page-break-inside: avoid; }
                    }
                  `}</style>

                  <div style={{ margin: '0 auto' }}>
                    <div id="invoice-html-preview" className="invoice-page" style={{ width: '210mm', minHeight: '297mm', background: '#fff' }}>
                      <UnifiedInvoiceLayout
                        id="invoice-preview-root"
                        variant="pdf"
                        invoiceData={sampleInvoiceData as any}
                        companySettings={companySettings}
                        bankingSettings={bankingSettings}
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
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default InvoiceTemplates;
