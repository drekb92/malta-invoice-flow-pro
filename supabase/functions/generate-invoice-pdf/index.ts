import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PdfRequest {
  html: string;
  filename: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const { html, filename }: PdfRequest = await req.json();

    if (!html || !filename) {
      return new Response(
        JSON.stringify({ error: 'HTML content and filename are required' }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    const apiKey = Deno.env.get('HTML2PDF_API_KEY');
    if (!apiKey) {
      console.error('HTML2PDF_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'PDF service not configured' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`Generating PDF for invoice: ${filename}`);
    console.log('HTML content length:', html.length);

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice ${filename}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 20px;
              color: #000;
              background: white;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .text-right {
              text-align: right;
            }
            .font-bold {
              font-weight: bold;
            }
            .text-2xl {
              font-size: 1.5rem;
            }
            .text-xl {
              font-size: 1.25rem;
            }
            .mb-4 {
              margin-bottom: 1rem;
            }
            .mb-6 {
              margin-bottom: 1.5rem;
            }
            .mt-6 {
              margin-top: 1.5rem;
            }
            .max-h-20 {
              max-height: 5rem;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    // Call HTML2PDF.app API to generate PDF
    const html2pdfResponse = await fetch('https://api.html2pdf.app/v1/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: fullHtml,
        options: {
          format: 'A4',
          margin: '1cm',
          printBackground: true,
        }
      }),
    });

    if (!html2pdfResponse.ok) {
      const errorText = await html2pdfResponse.text();
      console.error('HTML2PDF API error:', html2pdfResponse.status, errorText);
      console.error('HTML2PDF Response headers:', Object.fromEntries(html2pdfResponse.headers.entries()));
      return new Response(
        JSON.stringify({ error: `HTML2PDF API failed: ${html2pdfResponse.status} - ${errorText}` }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const pdfBuffer = await html2pdfResponse.arrayBuffer();
    console.log(`PDF generation completed for: ${filename}, size: ${pdfBuffer.byteLength} bytes`);
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in generate-invoice-pdf function:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate PDF: ' + error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);