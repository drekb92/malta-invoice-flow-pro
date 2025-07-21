import { useState } from "react";
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

interface Template {
  id: string;
  name: string;
  isDefault: boolean;
  settings: {
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
    fontSize: string;
    showVatNumber: boolean;
    showAddress: boolean;
    showPaymentTerms: boolean;
    logo?: string;
    companyName: string;
    notes: string;
  };
}

const InvoiceTemplates = () => {
  const [templates] = useState<Template[]>([
    {
      id: "default",
      name: "Default Template",
      isDefault: true,
      settings: {
        primaryColor: "#2563eb",
        accentColor: "#3b82f6",
        fontFamily: "Inter",
        fontSize: "14",
        showVatNumber: true,
        showAddress: true,
        showPaymentTerms: true,
        companyName: "InvoicePro Malta",
        notes: "Thank you for your business!",
      },
    },
    {
      id: "template-a",
      name: "Template A",
      isDefault: false,
      settings: {
        primaryColor: "#059669",
        accentColor: "#10b981",
        fontFamily: "Roboto",
        fontSize: "14",
        showVatNumber: true,
        showAddress: false,
        showPaymentTerms: true,
        companyName: "InvoicePro Malta",
        notes: "Payment due within 30 days.",
      },
    },
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [currentSettings, setCurrentSettings] = useState(selectedTemplate.settings);

  const updateSetting = (key: string, value: any) => {
    setCurrentSettings(prev => ({
      ...prev,
      [key]: value,
    }));
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
                  {/* Template Tabs */}
                  <Tabs value={selectedTemplate.id} onValueChange={(value) => {
                    const template = templates.find(t => t.id === value);
                    if (template) {
                      setSelectedTemplate(template);
                      setCurrentSettings(template.settings);
                    }
                  }}>
                    <TabsList className="grid w-full grid-cols-2">
                      {templates.map((template) => (
                        <TabsTrigger key={template.id} value={template.id} className="text-xs">
                          {template.name}
                          {template.isDefault && <Star className="h-3 w-3 ml-1 fill-current" />}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>

                  <Separator />

                  {/* Logo Upload */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Company Logo
                    </Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                    </div>
                  </div>

                  {/* Company Name */}
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={currentSettings.companyName}
                      onChange={(e) => updateSetting('companyName', e.target.value)}
                    />
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
                            style={{ backgroundColor: currentSettings.primaryColor }}
                          />
                          <Input
                            type="color"
                            value={currentSettings.primaryColor}
                            onChange={(e) => updateSetting('primaryColor', e.target.value)}
                            className="w-16 h-8 p-0 border-0"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm">Accent Color</Label>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded border border-border"
                            style={{ backgroundColor: currentSettings.accentColor }}
                          />
                          <Input
                            type="color"
                            value={currentSettings.accentColor}
                            onChange={(e) => updateSetting('accentColor', e.target.value)}
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
                        <Select value={currentSettings.fontFamily} onValueChange={(value) => updateSetting('fontFamily', value)}>
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
                        <Select value={currentSettings.fontSize} onValueChange={(value) => updateSetting('fontSize', value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fontSizes.map((size) => (
                              <SelectItem key={size.value} value={size.value}>
                                {size.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Field Toggles */}
                  <div className="space-y-4">
                    <Label>Show/Hide Fields</Label>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">VAT Number</Label>
                        <Switch
                          checked={currentSettings.showVatNumber}
                          onCheckedChange={(checked) => updateSetting('showVatNumber', checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Address</Label>
                        <Switch
                          checked={currentSettings.showAddress}
                          onCheckedChange={(checked) => updateSetting('showAddress', checked)}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Payment Terms</Label>
                        <Switch
                          checked={currentSettings.showPaymentTerms}
                          onCheckedChange={(checked) => updateSetting('showPaymentTerms', checked)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label>Default Notes</Label>
                    <Textarea
                      value={currentSettings.notes}
                      onChange={(e) => updateSetting('notes', e.target.value)}
                      placeholder="Add default notes for invoices..."
                      rows={3}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 pt-4">
                    <Button className="w-full">
                      <Save className="h-4 w-4 mr-2" />
                      Save Template
                    </Button>
                    <Button variant="outline" className="w-full">
                      <Star className="h-4 w-4 mr-2" />
                      Set as Default
                    </Button>
                  </div>
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
                      fontFamily: currentSettings.fontFamily,
                      fontSize: `${currentSettings.fontSize}px`,
                    }}
                  >
                    {/* Invoice Header */}
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <div className="w-20 h-20 bg-gray-200 rounded border-2 border-dashed border-gray-300 flex items-center justify-center mb-4">
                          <Image className="h-8 w-8 text-gray-400" />
                        </div>
                        <h1 
                          className="text-2xl font-bold"
                          style={{ color: currentSettings.primaryColor }}
                        >
                          {currentSettings.companyName}
                        </h1>
                        {currentSettings.showAddress && (
                          <div className="text-gray-600 mt-2">
                            <p>123 Business Street</p>
                            <p>Valletta, Malta VLT 1234</p>
                          </div>
                        )}
                        {currentSettings.showVatNumber && (
                          <p className="text-gray-600 mt-1">VAT: MT12345678</p>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <h2 
                          className="text-3xl font-bold mb-2"
                          style={{ color: currentSettings.primaryColor }}
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
                          style={{ color: currentSettings.accentColor }}
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
                          {currentSettings.showPaymentTerms && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Terms:</span>
                              <span>Net 30</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-8">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2" style={{ borderColor: currentSettings.primaryColor }}>
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
                          style={{ borderColor: currentSettings.primaryColor }}
                        >
                          <span>Total:</span>
                          <span>€767.00</span>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    {currentSettings.notes && (
                      <div>
                        <h3 
                          className="font-semibold mb-2"
                          style={{ color: currentSettings.accentColor }}
                        >
                          Notes:
                        </h3>
                        <p className="text-gray-600">{currentSettings.notes}</p>
                      </div>
                    )}
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