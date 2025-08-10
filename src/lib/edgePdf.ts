import { supabase } from "@/integrations/supabase/client";

/**
 * Build full HTML from the on-screen preview and request PDF from Edge Function.
 */
export async function downloadPdfFromFunction(filename: string, selectedFontFamily?: string) {
  const root = document.getElementById('invoice-preview-root');
  if (!root) throw new Error('Preview root not found (invoice-preview-root).');

  const family = selectedFontFamily || 'Inter';
  const encodedFamily = encodeURIComponent(family);

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${filename}</title>
    <style>@page { size: A4; margin: 0; } body{ margin:0; } #invoice-preview-root{ display:block !important; visibility:visible !important; }</style>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@400;600;700&display=swap" rel="stylesheet">
  </head>
  <body>${root.outerHTML}</body>
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
    throw new Error(`PDF service failed: ${text}`);
  }

  const blob = await res.blob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
