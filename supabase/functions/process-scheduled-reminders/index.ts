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

interface ReminderSettings {
  user_id: string;
  reminder_mode: string;
  email_reminders_enabled: boolean;
  days_before_due: number;
  days_after_due_first: number;
  days_after_due_second: number;
  days_after_due_final: number;
  max_reminders: number;
  stop_after_payment: boolean;
}

interface Invoice {
  id: string;
  invoice_number: string;
  due_date: string;
  total_amount: number;
  status: string;
  user_id: string;
  customers: {
    id: string;
    name: string;
    email: string;
    payment_terms: string;
  };
}

interface ReminderTemplate {
  level: string;
  subject: string;
  body: string;
}

interface CompanySettings {
  company_name: string;
  company_email: string;
  company_phone: string;
  currency_code: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const results: { userId: string; invoiceId: string; level: string; success: boolean; error?: string }[] = [];

  try {
    console.log("Starting scheduled reminder processing...");

    // 1. Fetch all users with automatic mode enabled
    const { data: usersWithAutoMode, error: settingsError } = await supabase
      .from("reminder_settings")
      .select("*")
      .eq("reminder_mode", "automatic")
      .eq("email_reminders_enabled", true);

    if (settingsError) {
      console.error("Error fetching reminder settings:", settingsError);
      throw settingsError;
    }

    if (!usersWithAutoMode || usersWithAutoMode.length === 0) {
      console.log("No users with automatic reminder mode enabled");
      return new Response(
        JSON.stringify({ message: "No users with automatic mode", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${usersWithAutoMode.length} users with automatic mode enabled`);

    // 2. Process each user
    for (const settings of usersWithAutoMode as ReminderSettings[]) {
      console.log(`Processing user: ${settings.user_id}`);

      // Fetch overdue/due invoices for this user
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select(`
          *,
          customers (id, name, email, payment_terms)
        `)
        .eq("user_id", settings.user_id)
        .eq("is_issued", true)
        .neq("status", "paid")
        .neq("status", "draft");

      if (invoicesError) {
        console.error(`Error fetching invoices for user ${settings.user_id}:`, invoicesError);
        continue;
      }

      if (!invoices || invoices.length === 0) {
        console.log(`No pending invoices for user ${settings.user_id}`);
        continue;
      }

      // Fetch company settings for this user
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("company_name, company_email, company_phone, currency_code")
        .eq("user_id", settings.user_id)
        .single();

      // Fetch reminder templates for this user
      const { data: templates } = await supabase
        .from("reminder_templates")
        .select("level, subject, body")
        .eq("user_id", settings.user_id);

      const templateMap: Record<string, ReminderTemplate> = {};
      templates?.forEach((t: ReminderTemplate) => {
        templateMap[t.level] = t;
      });

      // Process each invoice
      for (const invoice of invoices as Invoice[]) {
        const customer = invoice.customers;
        if (!customer?.email) {
          console.log(`Invoice ${invoice.id} has no customer email, skipping`);
          continue;
        }

        // Calculate days overdue
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(invoice.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        // Fetch reminder logs for this invoice
        const { data: reminderLogs } = await supabase
          .from("reminder_logs")
          .select("id, reminder_level, sent_at, email_sent")
          .eq("invoice_id", invoice.id)
          .eq("user_id", settings.user_id)
          .order("sent_at", { ascending: false });

        const successfulReminders = (reminderLogs || []).filter((r: any) => r.email_sent);
        
        // Check if max reminders reached
        if (successfulReminders.length >= settings.max_reminders) {
          console.log(`Invoice ${invoice.id}: Max reminders reached (${settings.max_reminders})`);
          continue;
        }

        // Determine if we should send a reminder and at what level
        let shouldSend = false;
        let reminderLevel: 'friendly' | 'firm' | 'final' = 'friendly';

        if (daysOverdue >= settings.days_after_due_final) {
          reminderLevel = 'final';
          shouldSend = true;
        } else if (daysOverdue >= settings.days_after_due_second) {
          reminderLevel = 'firm';
          shouldSend = true;
        } else if (daysOverdue >= settings.days_after_due_first) {
          reminderLevel = 'firm';
          shouldSend = true;
        } else if (daysOverdue >= 0) {
          reminderLevel = 'friendly';
          shouldSend = true;
        } else if (daysOverdue >= -settings.days_before_due) {
          reminderLevel = 'friendly';
          shouldSend = true;
        }

        if (!shouldSend) {
          console.log(`Invoice ${invoice.id}: Not due for reminder yet (${daysOverdue} days)`);
          continue;
        }

        // Check last reminder to avoid sending too frequently
        const lastReminder = reminderLogs?.[0];
        if (lastReminder) {
          const daysSinceLastReminder = Math.floor(
            (today.getTime() - new Date(lastReminder.sent_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          // Don't send if we sent less than 3 days ago
          if (daysSinceLastReminder < 3) {
            console.log(`Invoice ${invoice.id}: Too soon since last reminder (${daysSinceLastReminder} days)`);
            continue;
          }

          // Escalate level if needed
          if (lastReminder.reminder_level === 'friendly' && daysOverdue >= settings.days_after_due_first) {
            reminderLevel = 'firm';
          } else if (lastReminder.reminder_level === 'firm' && daysOverdue >= settings.days_after_due_final) {
            reminderLevel = 'final';
          } else if (lastReminder.reminder_level === reminderLevel) {
            // Already sent at this level, check if we should escalate
            if (reminderLevel !== 'final') {
              const levelOrder = ['friendly', 'firm', 'final'];
              const currentIndex = levelOrder.indexOf(reminderLevel);
              if (currentIndex < levelOrder.length - 1) {
                reminderLevel = levelOrder[currentIndex + 1] as 'friendly' | 'firm' | 'final';
              }
            } else {
              console.log(`Invoice ${invoice.id}: Already sent final reminder`);
              continue;
            }
          }
        }

        // Get template for this level
        const template = templateMap[reminderLevel];
        if (!template) {
          console.error(`No template found for level ${reminderLevel} for user ${settings.user_id}`);
          continue;
        }

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
          '{days_overdue}': Math.max(0, daysOverdue).toString(),
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
        let emailError: string | null = null;

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

          console.log(`Email sent to ${customer.email} for invoice ${invoice.id}:`, emailResponse);
          emailSent = true;
        } catch (error: any) {
          console.error(`Error sending email for invoice ${invoice.id}:`, error);
          emailError = error.message;
        }

        // Log the reminder
        await supabase.from("reminder_logs").insert({
          invoice_id: invoice.id,
          customer_id: customer.id,
          user_id: settings.user_id,
          reminder_level: reminderLevel,
          email_sent: emailSent,
          email_error: emailError,
          days_overdue: Math.max(0, daysOverdue),
        });

        results.push({
          userId: settings.user_id,
          invoiceId: invoice.id,
          level: reminderLevel,
          success: emailSent,
          error: emailError || undefined,
        });
      }
    }

    console.log(`Scheduled reminder processing complete. Processed ${results.length} reminders`);

    return new Response(
      JSON.stringify({
        message: "Scheduled reminders processed",
        processed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in process-scheduled-reminders function:", error);
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
