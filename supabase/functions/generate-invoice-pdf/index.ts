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

    console.log(`Generating PDF for invoice: ${filename}`);

    // For now, we'll use a simple HTML to PDF conversion using the browser's print functionality
    // In a production environment, you might want to use Puppeteer or a similar library
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

    // Since we can't use Puppeteer in this simple implementation,
    // we'll return the HTML with proper headers to trigger browser download
    // In a real implementation, you'd use a PDF generation library
    
    const response = new Response(fullHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${filename}.html"`,
        ...corsHeaders,
      },
    });

    console.log(`PDF generation completed for: ${filename}`);
    return response;

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