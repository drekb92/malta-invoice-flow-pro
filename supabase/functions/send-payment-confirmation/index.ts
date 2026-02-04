import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PaymentConfirmationRequest {
  invoiceId: string;
  invoiceNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  customerEmail: string;
  customerName: string;
  remainingBalance: number;
  isFullyPaid: boolean;
  userId: string;
  customerId?: string;
  currencyCode?: string;
  companyName?: string;
}

const formatCurrency = (amount: number, currencyCode: string = "EUR"): string => {
  const symbols: Record<string, string> = {
    EUR: "€",
    USD: "$",
    GBP: "£",
  };
  const symbol = symbols[currencyCode] || currencyCode + " ";
  return `${symbol}${amount.toFixed(2)}`;
};

const getMethodLabel = (method: string): string => {
  const methods: Record<string, string> = {
    bank_transfer: "Bank Transfer",
    cash: "Cash",
    card: "Card",
    check: "Check",
    other: "Other",
  };
  return methods[method] || method || "—";
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PaymentConfirmationRequest = await req.json();
    
    const {
      invoiceId,
      invoiceNumber,
      paymentAmount,
      paymentMethod,
      paymentDate,
      customerEmail,
      customerName,
      remainingBalance,
      isFullyPaid,
      userId,
      customerId,
      currencyCode = "EUR",
      companyName = "Our Company",
    } = body;

    // Validate required fields
    if (!invoiceId || !invoiceNumber || !customerEmail || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format date
    const formattedDate = new Date(paymentDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Build email content
    const paymentStatus = isFullyPaid
      ? `<p style="color: #16a34a; font-weight: 600; margin: 16px 0;">Your invoice is now fully paid. Thank you for your prompt payment!</p>`
      : `<p style="margin: 16px 0;">Your remaining balance is <strong>${formatCurrency(remainingBalance, currencyCode)}</strong>.</p>`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Received</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Payment Received</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Dear ${customerName},</p>
            
            <p>We have received your payment for <strong>Invoice ${invoiceNumber}</strong>.</p>
            
            ${paymentStatus}
            
            <div style="background: white; padding: 16px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 20px 0;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Payment Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Amount</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600;">${formatCurrency(paymentAmount, currencyCode)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Method</td>
                  <td style="padding: 8px 0; text-align: right;">${getMethodLabel(paymentMethod)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Date</td>
                  <td style="padding: 8px 0; text-align: right;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Invoice</td>
                  <td style="padding: 8px 0; text-align: right;">${invoiceNumber}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #6b7280; font-size: 14px;">Thank you for your business.</p>
            
            <p style="margin-top: 24px; color: #374151;">
              Best regards,<br>
              <strong>${companyName}</strong>
            </p>
          </div>
          
          <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
            This is an automated payment confirmation. Please do not reply to this email.
          </p>
        </body>
      </html>
    `;

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: `${companyName} <noreply@resend.dev>`,
      to: [customerEmail],
      subject: `Payment Received - Invoice ${invoiceNumber}`,
      html: emailHtml,
    });

    console.log("[send-payment-confirmation] Email sent:", emailResponse);

    // Log to document_send_logs
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: logError } = await supabase.from("document_send_logs").insert({
      user_id: userId,
      document_type: "invoice",
      document_id: invoiceId,
      document_number: invoiceNumber,
      channel: "email",
      recipient_email: customerEmail,
      customer_id: customerId || null,
      subject: `Payment Received - Invoice ${invoiceNumber}`,
      success: true,
      sent_at: new Date().toISOString(),
    });

    if (logError) {
      console.warn("[send-payment-confirmation] Failed to log send:", logError);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse?.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[send-payment-confirmation] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
