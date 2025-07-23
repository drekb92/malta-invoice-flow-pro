import { useState, useEffect, useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Upload,
  Save,
  Eye,
  Star,
  Palette,
  Type,
  Image,
  Settings2,
} from "lucide-react";

interface InvoiceTemplate {
  id: string;
  name: string;
  is_default: boolean;
  logo_url?: string;
  primary_color: string;
  accent_color: string;
  font_family: string;
  font_size: string;
  logo_x_offset: number;
  logo_y_offset: number;
  created_at?: string;
}

const InvoiceTemplates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
  const [currentSettings, setCurrentSettings] = useState<Partial<InvoiceTemplate>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Load templates from Supabase
  const loadTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_templates')
        .select('*')
        .order('is_default', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setTemplates(data);
        const defaultTemplate = data.find(t => t.is_default) || data[0];
        setSelectedTemplate(defaultTemplate);
        setCurrentSettings(defaultTemplate);
      } else {
        // Create default template if none exists
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
      const defaultTemplate = {
        name: 'Default Template',
        is_default: true,
        primary_color: '#26A65B',
        accent_color: '#1F2D3D',
        font_family: 'Inter',
        font_size: '14px',
        logo_x_offset: 0,
        logo_y_offset: 0,
      };

      const { data, error } = await supabase
        .from('invoice_templates')
        .insert([defaultTemplate])
        .select()
        .single();

      if (error) throw error;

      setTemplates([data]);
      setSelectedTemplate(data);
      setCurrentSettings(data);
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

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!selectedTemplate) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedTemplate.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      updateSetting('logo_url', data.publicUrl);
      
      toast({
        title: "Logo uploaded",
        description: "Logo has been successfully uploaded.",
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
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
          logo_url: currentSettings.logo_url,
          logo_x_offset: currentSettings.logo_x_offset,
          logo_y_offset: currentSettings.logo_y_offset,
        })
        .eq('id', currentSettings.id);

      if (error) throw error;

      // Update local state
      setTemplates(prev => prev.map(t => 
        t.id === currentSettings.id ? { ...t, ...currentSettings } as InvoiceTemplate : t
      ));
      setSelectedTemplate({ ...selectedTemplate, ...currentSettings } as InvoiceTemplate);

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
      // First, unset all templates as default
      await supabase
        .from('invoice_templates')
        .update({ is_default: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // dummy condition to update all

      // Then set current template as default
      const { error } = await supabase
        .from('invoice_templates')
        .update({ is_default: true })
        .eq('id', selectedTemplate.id);

      if (error) throw error;

      // Update local state
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
  ];

  const fontSizes = [
    { value: "12", label: "12px" },
    { value: "14", label: "14px" },
    { value: "16", label: "16px" },
    { value: "18", label: "18px" },
  ];

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
                  Customize your invoice design and branding
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview PDF
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
            {/* Template Selection */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Template Settings
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

                       {/* Logo Upload */}
                       <div className="space-y-2">
                         <Label className="flex items-center gap-2">
                           <Image className="h-4 w-4" />
                           Company Logo
                         </Label>
                         <div 
                           className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                           onDrop={(e) => {
                             e.preventDefault();
                             const file = e.dataTransfer.files[0];
                             if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
                               handleFileUpload(file);
                             }
                           }}
                           onDragOver={(e) => e.preventDefault()}
                           onClick={() => {
                             const input = document.createElement('input');
                             input.type = 'file';
                             input.accept = 'image/png,image/jpeg';
                             input.onchange = (e) => {
                               const file = (e.target as HTMLInputElement).files?.[0];
                               if (file) handleFileUpload(file);
                             };
                             input.click();
                           }}
                         >
                           {isUploading ? (
                             <div className="text-center">
                               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                               <p className="text-sm text-muted-foreground">Uploading...</p>
                             </div>
                           ) : currentSettings.logo_url ? (
                             <div className="text-center">
                               <img 
                                 src={currentSettings.logo_url} 
                                 alt="Logo" 
                                 className="h-16 w-auto mx-auto mb-2 rounded"
                               />
                               <p className="text-sm text-muted-foreground">Click to change logo</p>
                             </div>
                           ) : (
                             <>
                               <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                               <p className="text-sm text-muted-foreground">
                                 Click to upload or drag and drop
                               </p>
                               <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                             </>
                           )}
                         </div>
                       </div>

                       {/* Logo Position */}
                       <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label className="text-sm">Logo X Offset (px)</Label>
                           <Input
                             type="number"
                             value={currentSettings.logo_x_offset || 0}
                             onChange={(e) => updateSetting('logo_x_offset', parseInt(e.target.value) || 0)}
                             placeholder="0"
                           />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-sm">Logo Y Offset (px)</Label>
                           <Input
                             type="number"
                             value={currentSettings.logo_y_offset || 0}
                             onChange={(e) => updateSetting('logo_y_offset', parseInt(e.target.value) || 0)}
                             placeholder="0"
                           />
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
                   <div 
                     className="bg-white border rounded-lg p-8 min-h-[600px] shadow-sm"
                     style={{ 
                       fontFamily: currentSettings.font_family || 'Inter',
                       fontSize: currentSettings.font_size || '14px',
                       '--primary': currentSettings.primary_color || '#26A65B',
                       '--accent': currentSettings.accent_color || '#1F2D3D',
                     } as React.CSSProperties}
                   >
                     {/* Invoice Header */}
                     <div className="flex justify-between items-start mb-8">
                       <div>
                         {/* Logo */}
                         <div 
                           className="w-20 h-20 mb-4"
                           style={{
                             transform: `translate(${currentSettings.logo_x_offset || 0}px, ${currentSettings.logo_y_offset || 0}px)`
                           }}
                         >
                           {currentSettings.logo_url ? (
                             <img 
                               src={currentSettings.logo_url} 
                               alt="Company Logo" 
                               className="w-full h-full object-contain"
                             />
                           ) : (
                             <div className="w-full h-full bg-gray-200 rounded border-2 border-dashed border-gray-300 flex items-center justify-center">
                               <Image className="h-8 w-8 text-gray-400" />
                             </div>
                           )}
                         </div>
                         
                         <h1 
                           className="text-2xl font-bold"
                           style={{ color: currentSettings.primary_color || '#26A65B' }}
                         >
                           InvoicePro Malta
                         </h1>
                         <div className="text-gray-600 mt-2">
                           <p>123 Business Street</p>
                           <p>Valletta, Malta VLT 1234</p>
                           <p>VAT: MT12345678</p>
                         </div>
                       </div>
                       
                       <div className="text-right">
                         <h2 
                           className="text-3xl font-bold mb-2"
                           style={{ color: currentSettings.primary_color || '#26A65B' }}
                         >
                           INVOICE
                         </h2>
                         <p className="text-gray-600"># INV-2024-001</p>
                       </div>
                     </div>

                     {/* Bill To Section */}
                     <div className="grid grid-cols-2 gap-8 mb-8">
                       <div>
                         <h3 
                           className="font-semibold mb-2"
                           style={{ color: currentSettings.accent_color || '#1F2D3D' }}
                         >
                           Bill To:
                         </h3>
                         <div className="text-gray-600">
                           <p className="font-medium">Sample Customer</p>
                           <p>456 Customer Ave</p>
                           <p>Sliema, Malta SLM 1234</p>
                         </div>
                       </div>
                       
                       <div>
                         <div className="space-y-1">
                           <div className="flex justify-between">
                             <span className="text-gray-600">Issue Date:</span>
                             <span>January 15, 2024</span>
                           </div>
                           <div className="flex justify-between">
                             <span className="text-gray-600">Due Date:</span>
                             <span>February 14, 2024</span>
                           </div>
                           <div className="flex justify-between">
                             <span className="text-gray-600">Terms:</span>
                             <span>Net 30</span>
                           </div>
                         </div>
                       </div>
                     </div>

                     {/* Items Table */}
                     <div className="mb-8">
                       <table className="w-full">
                         <thead>
                           <tr className="border-b-2" style={{ borderColor: currentSettings.primary_color || '#26A65B' }}>
                             <th className="text-left py-2">Description</th>
                             <th className="text-right py-2">Qty</th>
                             <th className="text-right py-2">Unit Price</th>
                             <th className="text-right py-2">Total</th>
                           </tr>
                         </thead>
                         <tbody>
                           <tr className="border-b">
                             <td className="py-3">Professional Services</td>
                             <td className="text-right py-3">10</td>
                             <td className="text-right py-3">€50.00</td>
                             <td className="text-right py-3">€500.00</td>
                           </tr>
                           <tr className="border-b">
                             <td className="py-3">Consultation Fee</td>
                             <td className="text-right py-3">1</td>
                             <td className="text-right py-3">€150.00</td>
                             <td className="text-right py-3">€150.00</td>
                           </tr>
                         </tbody>
                       </table>
                     </div>

                     {/* Totals */}
                     <div className="flex justify-end mb-8">
                       <div className="w-64">
                         <div className="flex justify-between py-1">
                           <span>Subtotal:</span>
                           <span>€650.00</span>
                         </div>
                         <div className="flex justify-between py-1">
                           <span>VAT (18%):</span>
                           <span>€117.00</span>
                         </div>
                         <div 
                           className="flex justify-between py-2 border-t-2 font-bold text-lg"
                           style={{ borderColor: currentSettings.primary_color || '#26A65B' }}
                         >
                           <span>Total:</span>
                           <span>€767.00</span>
                         </div>
                       </div>
                     </div>

                     {/* Notes */}
                     <div>
                       <h3 
                         className="font-semibold mb-2"
                         style={{ color: currentSettings.accent_color || '#1F2D3D' }}
                       >
                         Notes:
                       </h3>
                       <p className="text-gray-600">Thank you for your business!</p>
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