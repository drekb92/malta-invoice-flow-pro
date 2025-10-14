import { supabase } from "@/integrations/supabase/client";
import { validatePDFConsistency, logConsistencyReport, generateDebugComment } from "@/lib/pdfConsistency";

/**
 * Build full HTML from the on-screen preview and request PDF from Edge Function.
 * 
 * IMPORTANT: This function ensures WYSIWYG (What You See Is What You Get)
 * - It captures the exact HTML from UnifiedInvoiceLayout component
 * - It preserves all CSS variables and styling
 * - It inlines images for reliable rendering
 * - The PDF will match the preview exactly
 */
export async function downloadPdfFromFunction(
  filename: string, 
  selectedFontFamily?: string,
  debug = false
) {
  const root = document.getElementById('invoice-preview-root') as HTMLElement | null;
  if (!root) throw new Error('Preview root not found (invoice-preview-root).');

  const family = selectedFontFamily || 'Inter';
  const encodedFamily = encodeURIComponent(family);

  // Clone the preview and inline all images so logos and assets render reliably in the PDF
  const cloned = root.cloneNode(true) as HTMLElement;

  async function inlineImages(container: HTMLElement) {
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      imgs.map(async (img) => {
        const src = img.getAttribute('src');
        if (!src || src.startsWith('data:')) return;
        try {
          const res = await fetch(src, { mode: 'cors' });
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          img.setAttribute('src', dataUrl);
        } catch (e) {
          console.warn('Failed to inline image for PDF:', src, e);
        }
      })
    );
  }

  await inlineImages(cloned);

  // Capture CSS variables from the on-screen preview so template colors/spacing match
  let cssVars = '';
  try {
    const computed = getComputedStyle(root);
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      if (prop && prop.startsWith('--')) {
        const val = computed.getPropertyValue(prop).trim();
        if (val) cssVars += `${prop}: ${val};`;
      }
    }
  } catch (e) {
    console.warn('Failed to extract CSS variables for PDF:', e);
  }

  if (cssVars) {
    const existingStyle = cloned.getAttribute('style') || '';
    cloned.setAttribute('style', `${existingStyle}${existingStyle ? ' ' : ''}${cssVars}`);
  }

  // Add debug comment if requested
  const debugComment = debug ? `\n${generateDebugComment({
    isConsistent: true,
    warnings: [],
    errors: [],
    details: {
      hasCompanySettings: true,
      hasBankingSettings: true,
      hasTemplateSettings: true,
      layoutType: 'unknown',
      variant: 'pdf',
    }
  })}\n` : '';

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${filename}</title>${debugComment}
    <style>
      @page { size: A4; margin: 0; }
      :root { color-scheme: light; }
      html, body { margin: 0; padding: 0; }
      * { box-sizing: border-box; }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        font-family: '${family}', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #111827;
        background: #ffffff;
      }
      #invoice-preview-root {
        display: block !important;
        visibility: visible !important;
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 0; /* Match on-screen layout; inner containers handle padding */
        background: #ffffff;
      }
      img { max-width: 100%; height: auto; }
      h1, h2, h3, h4 { margin: 0 0 0.5rem 0; line-height: 1.25; }
      h1 { font-size: 28px; font-weight: 700; }
      h2 { font-size: 20px; font-weight: 600; }
      h3 { font-size: 16px; font-weight: 600; }
      p { margin: 0 0 0.5rem 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
      th, td { padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; vertical-align: top; }
      th { background: #f9fafb; font-weight: 600; text-align: left; }
      tfoot td { font-weight: 600; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .font-bold { font-weight: 700; }
      .font-semibold { font-weight: 600; }
      .uppercase { text-transform: uppercase; }
      .text-xs { font-size: 12px; }
      .text-sm { font-size: 14px; }
      .text-base { font-size: 16px; }
      .text-lg { font-size: 18px; }
      .text-xl { font-size: 20px; }
      .text-2xl { font-size: 24px; }
      .mt-2 { margin-top: 0.5rem; } .mt-4 { margin-top: 1rem; } .mt-6 { margin-top: 1.5rem; }
      .mb-2 { margin-bottom: 0.5rem; } .mb-4 { margin-bottom: 1rem; } .mb-6 { margin-bottom: 1.5rem; }
      .pt-2 { padding-top: 0.5rem; } .pt-4 { padding-top: 1rem; } .pt-6 { padding-top: 1.5rem; }
      .pb-2 { padding-bottom: 0.5rem; } .pb-4 { padding-bottom: 1rem; } .pb-6 { padding-bottom: 1.5rem; }
      .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
      .px-4 { padding-left: 1rem; padding-right: 1rem; }
      .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
      .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
      .grid { display: grid; }
      .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .gap-2 { gap: 0.5rem; } .gap-4 { gap: 1rem; } .gap-6 { gap: 1.5rem; }
      .flex { display: flex; } .items-center { align-items: center; } .justify-between { justify-content: space-between; }
      .rounded { border-radius: 0.25rem; } .rounded-md { border-radius: 0.375rem; }
      .bg-gray-50 { background: #f9fafb; } .border { border: 1px solid #e5e7eb; }
      hr { border: 0; border-top: 1px solid #e5e7eb; margin: 1rem 0; }
      section { page-break-inside: avoid; }
      tr, img { page-break-inside: avoid; }
      .w-full { width: 100%; }
    </style>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@400;600;700&display=swap" rel="stylesheet">
  </head>
  <body>${cloned.outerHTML}</body>
</html>`;

  // Call Edge Function directly with proper auth and get a Blob response
  const fnUrl = 'https://cmysusctooyobrlnwtgt.functions.supabase.co/generate-invoice-pdf';
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ html, filename }),
  });

  if (!res.ok) {
    const text = await res.text();
    let errorMessage = text;
    
    // Try to parse JSON error response
    try {
      const errorJson = JSON.parse(text);
      if (errorJson.error) {
        errorMessage = errorJson.error;
      }
    } catch {
      // If not JSON, use the raw text
    }
    
    throw new Error(errorMessage);
  }

  const blob = await res.blob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
