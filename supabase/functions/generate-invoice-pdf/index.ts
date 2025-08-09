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

  // Add a GET endpoint for testing API key
  if (req.method === 'GET') {
    const apiKey = Deno.env.get('HTML2PDF_API_KEY');
    console.log('Testing API key availability and format...');
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          message: 'HTML2PDF_API_KEY not found in environment',
          hasKey: false
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Test the API key with a simple request
    try {
      const testResponse = await fetch('https://api.html2pdf.app/v1/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: '<h1>Test</h1>',
          options: { format: 'A4', margin: '1cm' }
        }),
      });

      return new Response(
        JSON.stringify({ 
          status: testResponse.ok ? 'success' : 'error',
          statusCode: testResponse.status,
          statusText: testResponse.statusText,
          hasKey: true,
          keyLength: apiKey.length,
          message: testResponse.ok ? 'API key is working' : `API returned ${testResponse.status}: ${testResponse.statusText}`
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          status: 'error', 
          message: `Failed to test API: ${error.message}`,
          hasKey: true,
          keyLength: apiKey.length
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let html: string | undefined;
    let filename: string | undefined;

    try {
      if (contentType.includes('application/json')) {
        const body = await req.json() as PdfRequest;
        html = body?.html;
        filename = body?.filename;
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const form = await req.formData();
        html = (form.get('html') || '') as string;
        filename = (form.get('filename') || '') as string;
      } else {
        // Fallback: try text then JSON.parse; if still not JSON, treat as raw HTML
        const raw = await req.text();
        try {
          const parsed = JSON.parse(raw) as PdfRequest;
          html = parsed?.html;
          filename = parsed?.filename;
        } catch {
          html = raw;
          filename = 'invoice-preview';
        }
      }
    } catch (parseErr) {
      console.error('Request body parse error:', parseErr);
    }

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
    console.log('HTML2PDF_API_KEY status:', apiKey ? `Found (length: ${apiKey.length})` : 'Not found');
    
    if (!apiKey) {
      console.error('HTML2PDF_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'PDF service not configured - HTML2PDF_API_KEY missing' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Validate API key format (basic check)
    if (apiKey.length < 10) {
      console.error('HTML2PDF_API_KEY appears to be invalid (too short)');
      return new Response(
        JSON.stringify({ error: 'PDF service misconfigured - Invalid API key format' }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`Generating PDF for invoice: ${filename}`);
    console.log('HTML content length:', html.length);

    const fullHtml = html;

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
          margin: '0',
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