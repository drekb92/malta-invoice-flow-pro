import { supabase } from "@/integrations/supabase/client";

/**
 * Build full HTML from the on-screen preview and request PDF from Edge Function.
 */
export async function downloadPdfFromFunction(filename: string, selectedFontFamily?: string) {
  const root = document.getElementById('invoice-preview-root');
  if (!root) throw new Error('Preview root not found.');

  const family = selectedFontFamily || 'Inter';
  const encodedFamily = encodeURIComponent(family);

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${filename}</title>
    <style>@page { size: A4; margin: 0; }</style>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@400;600;700&display=swap" rel="stylesheet">
  </head>
  <body>${root.outerHTML}</body>
</html>`;

  // Prefer calling via Supabase client; it handles auth and proper host.
  // Note: Some environments may not return a Blob here; handle common cases.
  const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
    body: { html, filename },
    headers: { 'Content-Type': 'application/json' },
  });

  if (error) {
    throw new Error(error.message || 'PDF service failed');
  }

  let blob: Blob;
  if (data instanceof Blob) {
    blob = data;
  } else if (data instanceof ArrayBuffer) {
    blob = new Blob([data], { type: 'application/pdf' });
  } else if (data && (data as any).byteLength) {
    blob = new Blob([data as any], { type: 'application/pdf' });
  } else if (typeof data === 'string') {
    // If server accidentally returned base64/text
    try {
      const byteChars = atob(data);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
    } catch {
      throw new Error('Unexpected PDF response format');
    }
  } else {
    // As a last resort, try direct fetch to the function endpoint (same-origin routing)
    const res = await fetch('/functions/v1/generate-invoice-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, filename }),
    });
    if (!res.ok) throw new Error(`PDF service failed: ${await res.text()}`);
    blob = await res.blob();
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
