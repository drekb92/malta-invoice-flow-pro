import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { InvoiceHTML } from "@/components/InvoiceHTML";
import { getDefaultTemplate, InvoiceTemplate } from "@/services/templateService";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const sampleInvoiceData = {
  invoiceNumber: "INV-2024-001",
  invoiceDate: "2024-01-15",
  dueDate: "2024-02-15",
  customer: {
    name: "John Smith",
    email: "john.smith@example.com",
    address: "456 Customer Ave\nLos Angeles, CA 90001",
    vat_number: "VAT123456789",
  },
  items: [
    {
      description: "Professional Services",
      quantity: 10,
      unit_price: 150,
      vat_rate: 0.21,
    },
    {
      description: "Consulting Hours",
      quantity: 5,
      unit_price: 200,
      vat_rate: 0.21,
    },
  ],
  totals: {
    netTotal: 2500,
    vatTotal: 525,
    grandTotal: 3025,
  },
};

const InvoiceTemplates = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDefaultTemplate();
  }, []);

  const loadDefaultTemplate = async () => {
    try {
      const template = await getDefaultTemplate();
      setSelectedTemplate(template);
    } catch (error) {
      console.error("Error loading template:", error);
      toast({
        title: "Error",
        description: "Could not load template",
        variant: "destructive",
      });
    }
  };

  const templateForPreview = selectedTemplate || {
    id: "default",
    name: "Default Template",
    is_default: true,
    primary_color: "#26A65B",
    accent_color: "#1F2D3D",
    font_family: "Inter",
    font_size: "14px",
    logo_x_offset: 0,
    logo_y_offset: 0,
  };

  const handleDownloadPDF = async () => {
    try {
      const element = document.getElementById("invoice-html-preview");
      if (!element) throw new Error("Preview not found");

      const html = element.outerHTML;
      
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `https://cmysusctooyobrlnwtgt.supabase.co/functions/v1/generate-invoice-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNteXN1c2N0b295b2JybG53dGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NTcyODMsImV4cCI6MjA2ODQzMzI4M30.n1-GUBd_JnFfXqdNk0ZNIuDxIFFn90mpcRjd-EliPIs",
            "Authorization": `Bearer ${session?.access_token || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNteXN1c2N0b295b2JybG53dGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NTcyODMsImV4cCI6MjA2ODQzMzI4M30.n1-GUBd_JnFfXqdNk0ZNIuDxIFFn90mpcRjd-EliPIs"}`,
          },
          body: JSON.stringify({
            html,
            filename: sampleInvoiceData.invoiceNumber
          })
        }
      );

      if (!response.ok) throw new Error("Failed to generate PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sampleInvoiceData.invoiceNumber}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "PDF generated successfully",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Export failed",
        description: "Could not generate PDF from preview.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Invoice Templates</h1>
            <p className="text-muted-foreground">Customize your invoice appearance</p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDownloadPDF}
          >
            <Eye className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>

        <div className="bg-card rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Preview</h2>
          <div className="bg-gray-100 p-8 rounded-lg flex justify-center">
            <div 
              className="bg-white shadow-lg"
              style={{
                width: "210mm",
                minHeight: "297mm",
                padding: "20mm",
              }}
            >
              <div id="invoice-html-preview">
                <InvoiceHTML 
                  invoiceData={sampleInvoiceData} 
                  template={templateForPreview}
                  variant="template"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceTemplates;
