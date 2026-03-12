import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function advanceDate(current: string, frequency: string): string {
  const d = new Date(current);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "annually":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().split("T")[0];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];

    // Fetch all due recurring schedules
    const { data: schedules, error: schedErr } = await supabase
      .from("recurring_invoices")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_date", today);

    if (schedErr) {
      console.error("[process-recurring] Error fetching schedules:", schedErr);
      return new Response(JSON.stringify({ error: schedErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let processed = 0;
    const errors: string[] = [];

    for (const schedule of schedules) {
      try {
        // Fetch source invoice
        const { data: sourceInvoice, error: invErr } = await supabase
          .from("invoices")
          .select("*")
          .eq("id", schedule.source_invoice_id)
          .single();

        if (invErr || !sourceInvoice) {
          errors.push(`Schedule ${schedule.id}: source invoice not found`);
          continue;
        }

        // Fetch source items
        const { data: sourceItems } = await supabase
          .from("invoice_items")
          .select("description, quantity, unit, unit_price, vat_rate")
          .eq("invoice_id", schedule.source_invoice_id);

        // Fetch customer payment terms for due date calculation
        const { data: customer } = await supabase
          .from("customers")
          .select("payment_terms")
          .eq("id", schedule.customer_id)
          .single();

        const paymentTerms = customer?.payment_terms || "Net 30";
        const daysMatch = paymentTerms.match(/\d+/);
        const paymentDays = daysMatch ? parseInt(daysMatch[0]) : 30;

        const invoiceDate = today;
        const dueDateObj = new Date(invoiceDate);
        dueDateObj.setDate(dueDateObj.getDate() + paymentDays);
        const dueDate = dueDateObj.toISOString().split("T")[0];

        // Create new draft invoice (no invoice number yet - it's a draft)
        const { data: newInvoice, error: createErr } = await supabase
          .from("invoices")
          .insert({
            user_id: schedule.user_id,
            customer_id: schedule.customer_id,
            invoice_date: invoiceDate,
            due_date: dueDate,
            status: "draft",
            is_issued: false,
            amount: sourceInvoice.amount,
            vat_rate: sourceInvoice.vat_rate,
            vat_amount: sourceInvoice.vat_amount,
            total_amount: sourceInvoice.total_amount,
            discount_type: sourceInvoice.discount_type,
            discount_value: sourceInvoice.discount_value,
            discount_reason: sourceInvoice.discount_reason,
          })
          .select("id")
          .single();

        if (createErr || !newInvoice) {
          errors.push(`Schedule ${schedule.id}: failed to create invoice - ${createErr?.message}`);
          continue;
        }

        // Copy items
        if (sourceItems && sourceItems.length > 0) {
          const newItems = sourceItems.map((item) => ({
            invoice_id: newInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            vat_rate: item.vat_rate,
          }));

          const { error: itemsErr } = await supabase
            .from("invoice_items")
            .insert(newItems);

          if (itemsErr) {
            console.error(`[process-recurring] Items error for schedule ${schedule.id}:`, itemsErr);
          }
        }

        // Advance the schedule
        const nextRunDate = advanceDate(schedule.next_run_date, schedule.frequency);
        await supabase
          .from("recurring_invoices")
          .update({
            next_run_date: nextRunDate,
            last_generated_at: new Date().toISOString(),
            total_generated: (schedule.total_generated || 0) + 1,
          })
          .eq("id", schedule.id);

        processed++;
      } catch (err: any) {
        errors.push(`Schedule ${schedule.id}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ processed, errors: errors.length > 0 ? errors : undefined }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (err: any) {
    console.error("[process-recurring] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
