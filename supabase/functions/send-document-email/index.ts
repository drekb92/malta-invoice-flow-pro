import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendDocumentEmailRequest {
  to: string;
  subject: string;
  messageHtml: string;
  filename: string;
  html: string;
  // For logging
  userId?: string;
  documentType?: 'invoice' | 'quotation' | 'statement' | 'credit_note';
  documentId?: string;
  documentNumber?: string;
  customerId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-document-email] Request received");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const html2pdfApiKey = Deno.env.get("HTML2PDF_API_KEY");

    if (!resendApiKey) {
      console.error("[send-document-email] RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    if (!html2pdfApiKey) {
      console.error("[send-document-email] HTML2PDF_API_KEY not configured");
      throw new Error("PDF service not configured");
    }

    const body: SendDocumentEmailRequest = await req.json();
    const { to, subject, messageHtml, filename, html, userId, documentType, documentId, documentNumber, customerId } = body;

    console.log(`[send-document-email] Sending to: ${to}, filename: ${filename}`);

    // Validate email
    if (!to || !to.includes("@")) {
      throw new Error("Invalid recipient email address");
    }

    // Step 1: Generate PDF using html2pdf.app
    console.log("[send-document-email] Generating PDF...");
    const pdfResponse = await fetch("https://api.html2pdf.app/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: html2pdfApiKey,
        html: html,
        format: "A4",
        marginTop: 0,
        marginRight: 0,
        marginBottom: 0,
        marginLeft: 0,
      }),
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error("[send-document-email] PDF generation failed:", errorText);
      throw new Error(`PDF generation failed: ${errorText}`);
    }

    const pdfBlob = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBlob)));
    console.log(`[send-document-email] PDF generated, size: ${pdfBlob.byteLength} bytes`);

    // Step 2: Send email with attachment via Resend
    const resend = new Resend(resendApiKey);

    const emailResponse = await resend.emails.send({
      from: "Invoices <onboarding@resend.dev>",
      to: [to],
      subject: subject,
      html: messageHtml,
      attachments: [
        {
          filename: `${filename}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    console.log("[send-document-email] Email sent:", emailResponse);

    // Step 3: Log to document_send_logs if we have the required data
    if (userId && documentType && documentId && documentNumber) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          
          await supabase.from("document_send_logs").insert({
            user_id: userId,
            document_type: documentType,
            document_id: documentId,
            document_number: documentNumber,
            customer_id: customerId || null,
            channel: "email",
            recipient_email: to,
            subject: subject,
            success: true,
          });
          console.log("[send-document-email] Send logged successfully");
        }
      } catch (logError) {
        console.warn("[send-document-email] Failed to log send:", logError);
        // Don't fail the request if logging fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, messageId: emailResponse.data?.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[send-document-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
