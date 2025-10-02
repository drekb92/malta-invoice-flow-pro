import { supabase } from "@/integrations/supabase/client";

export interface ExportInvoicePdfInput {
  filename?: string;
  elementId?: string;
}

export interface ExportInvoicePdfOutput {
  ok: boolean;
  error?: string;
}

/**
 * Export Invoice PDF (Server)
 * Generates a PDF using the server-side edge function
 */
export async function exportInvoicePdfAction(
  input: ExportInvoicePdfInput = {}
): Promise<ExportInvoicePdfOutput> {
  const elementId = input.elementId || 'invoice-html-preview';
  const filename = input.filename || 'invoice';

  try {
    const el = document.getElementById(elementId);
    if (!el) {
      throw new Error(`Preview element #${elementId} not found`);
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <style>
            @page { size: A4; margin: 15mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .invoice-page { width:210mm; min-height:297mm; }
          </style>
        </head>
        <body>
          <div class="invoice-page">
            ${el.outerHTML}
          </div>
        </body>
      </html>
    `;

    const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
      body: { html, filename }
    });

    if (error) throw error;

    const blob = new Blob([data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.pdf`;
    a.click();
    URL.revokeObjectURL(url);

    return { ok: true };
  } catch (error) {
    console.error('Error exporting PDF:', error);
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
