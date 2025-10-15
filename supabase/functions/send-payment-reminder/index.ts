import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  invoice_id: string;
  reminder_level: 'friendly' | 'firm' | 'final';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { invoice_id, reminder_level }: ReminderRequest = await req.json();

    console.log(`Processing ${reminder_level} reminder for invoice ${invoice_id}`);

    // Fetch invoice with customer and company details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        customers (*),
        user_id
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error("Error fetching invoice:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch company settings
    const { data: companySettings, error: companyError } = await supabase
      .from("company_settings")
      .select("*")
      .eq("user_id", invoice.user_id)
      .single();

    if (companyError) {
      console.error("Error fetching company settings:", companyError);
    }

    // Fetch reminder template
    const { data: template, error: templateError } = await supabase
      .from("reminder_templates")
      .select("*")
      .eq("user_id", invoice.user_id)
      .eq("level", reminder_level)
      .single();

    if (templateError || !template) {
      console.error("Error fetching template:", templateError);
      return new Response(
        JSON.stringify({ error: "Reminder template not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const customer = invoice.customers;
    if (!customer?.email) {
      console.log("Customer has no email address");
      return new Response(
        JSON.stringify({ error: "Customer has no email address" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Calculate days overdue
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Format amount
    const amount = new Intl.NumberFormat('en-MT', {
      style: 'currency',
      currency: companySettings?.currency_code || 'EUR',
    }).format(Number(invoice.total_amount || 0));

    // Format due date
    const dueDateFormatted = new Intl.DateTimeFormat('en-MT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(dueDate);

    // Replace template variables
    const replacements: Record<string, string> = {
      '{customer_name}': customer.name || 'Valued Customer',
      '{invoice_number}': invoice.invoice_number || 'N/A',
      '{amount}': amount,
      '{due_date}': dueDateFormatted,
      '{days_overdue}': daysOverdue.toString(),
      '{company_name}': companySettings?.company_name || 'Your Company',
      '{company_phone}': companySettings?.company_phone || '',
      '{company_email}': companySettings?.company_email || '',
      '{payment_terms}': customer.payment_terms || 'Net 30',
    };

    let emailSubject = template.subject;
    let emailBody = template.body;

    Object.entries(replacements).forEach(([key, value]) => {
      emailSubject = emailSubject.replace(new RegExp(key, 'g'), value);
      emailBody = emailBody.replace(new RegExp(key, 'g'), value);
    });

    // Convert line breaks to HTML
    const emailBodyHtml = emailBody.replace(/\n/g, '<br>');

    // Send email via Resend
    let emailSent = false;
    let emailError = null;

    try {
      const emailResponse = await resend.emails.send({
        from: companySettings?.company_email 
          ? `${companySettings.company_name || 'Invoice Reminder'} <onboarding@resend.dev>`
          : "Invoice Reminder <onboarding@resend.dev>",
        to: [customer.email],
        subject: emailSubject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            ${emailBodyHtml}
          </div>
        `,
      });

      console.log("Email sent successfully:", emailResponse);
      emailSent = true;
    } catch (error: any) {
      console.error("Error sending email:", error);
      emailError = error.message;
    }

    // Log the reminder
    const { error: logError } = await supabase
      .from("reminder_logs")
      .insert({
        invoice_id: invoice.id,
        customer_id: customer.id,
        user_id: invoice.user_id,
        reminder_level,
        email_sent: emailSent,
        email_error: emailError,
        days_overdue: daysOverdue,
      });

    if (logError) {
      console.error("Error logging reminder:", logError);
    }

    return new Response(
      JSON.stringify({
        success: emailSent,
        message: emailSent 
          ? "Reminder sent successfully"
          : "Failed to send reminder",
        error: emailError,
      }),
      {
        status: emailSent ? 200 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-payment-reminder function:", error);
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
