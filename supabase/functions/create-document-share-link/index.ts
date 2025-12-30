import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateShareLinkRequest {
  html: string;
  filename: string;
  userId: string;
  documentType: 'invoice' | 'quotation' | 'statement' | 'credit_note';
  documentId: string;
  documentNumber: string;
  customerId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[create-document-share-link] Request received");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const html2pdfApiKey = Deno.env.get("HTML2PDF_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!html2pdfApiKey) {
      console.error("[create-document-share-link] HTML2PDF_API_KEY not configured");
      throw new Error("PDF service not configured");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[create-document-share-link] Supabase not configured");
      throw new Error("Storage service not configured");
    }

    const body: CreateShareLinkRequest = await req.json();
    const { html, filename, userId, documentType, documentId, documentNumber, customerId } = body;

    console.log(`[create-document-share-link] Creating share link for: ${filename}`);

    // Step 1: Generate PDF using html2pdf.app
    console.log("[create-document-share-link] Generating PDF...");
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
      console.error("[create-document-share-link] PDF generation failed:", errorText);
      throw new Error(`PDF generation failed: ${errorText}`);
    }

    const pdfBlob = await pdfResponse.arrayBuffer();
    console.log(`[create-document-share-link] PDF generated, size: ${pdfBlob.byteLength} bytes`);

    // Step 2: Upload to Supabase Storage
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const timestamp = Date.now();
    const filePath = `${userId}/${documentType}/${filename}_${timestamp}.pdf`;

    console.log(`[create-document-share-link] Uploading to: ${filePath}`);
    
    const { error: uploadError } = await supabase.storage
      .from("shared_documents")
      .upload(filePath, pdfBlob, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("[create-document-share-link] Upload failed:", uploadError);
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }

    // Step 3: Create signed URL valid for 7 days
    const expiresIn = 7 * 24 * 60 * 60; // 7 days in seconds
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("shared_documents")
      .createSignedUrl(filePath, expiresIn);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[create-document-share-link] Signed URL creation failed:", signedUrlError);
      throw new Error("Failed to create share link");
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    console.log(`[create-document-share-link] Share link created, expires: ${expiresAt}`);

    // Step 4: Log to document_send_logs
    try {
      await supabase.from("document_send_logs").insert({
        user_id: userId,
        document_type: documentType,
        document_id: documentId,
        document_number: documentNumber,
        customer_id: customerId || null,
        channel: "whatsapp",
        share_url: signedUrlData.signedUrl,
        share_url_expires_at: expiresAt,
        success: true,
      });
      console.log("[create-document-share-link] Send logged successfully");
    } catch (logError) {
      console.warn("[create-document-share-link] Failed to log send:", logError);
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: signedUrlData.signedUrl,
        expiresAt: expiresAt,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("[create-document-share-link] Error:", error);
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
