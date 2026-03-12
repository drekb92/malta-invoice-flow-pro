import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Validate share link token
    const { data: linkData, error: linkErr } = await supabase
      .from("invoice_share_links")
      .select("invoice_id, user_id, expires_at")
      .eq("token", token)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (linkErr || !linkData) {
      return new Response(
        JSON.stringify({ error: "This link is invalid, has expired, or has been revoked." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const { invoice_id, user_id } = linkData;

    // 2. Fetch all invoice data in parallel (service role bypasses RLS)
    const [invoiceRes, itemsRes, totalsRes, companyRes, bankingRes, paymentsRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, due_date, status, amount, vat_amount, total_amount, vat_rate, discount_type, discount_value, is_issued, customer_id")
        .eq("id", invoice_id)
        .eq("user_id", user_id)
        .single(),
      supabase
        .from("invoice_items")
        .select("description, quantity, unit, unit_price, vat_rate")
        .eq("invoice_id", invoice_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("invoice_totals")
        .select("net_amount, vat_amount, total_amount")
        .eq("invoice_id", invoice_id)
        .maybeSingle(),
      supabase
        .from("company_settings")
        .select("company_name, company_email, company_phone, company_address, company_locality, company_post_code, company_country, company_vat_number, company_registration_number, company_logo, company_website")
        .eq("user_id", user_id)
        .maybeSingle(),
      supabase
        .from("banking_details")
        .select("bank_name, bank_account_name, bank_iban, bank_swift_code, include_on_invoices")
        .eq("user_id", user_id)
        .maybeSingle(),
      supabase
        .from("payments")
        .select("amount, payment_date, method")
        .eq("invoice_id", invoice_id)
        .eq("user_id", user_id)
        .order("payment_date", { ascending: false }),
    ]);

    if (invoiceRes.error || !invoiceRes.data) {
      return new Response(
        JSON.stringify({ error: "Invoice data could not be loaded." }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // 3. Fetch customer if exists
    const customerId = invoiceRes.data.customer_id;
    let customerData = null;
    if (customerId) {
      const { data: cust } = await supabase
        .from("customers")
        .select("name, email, address, address_line1, address_line2, locality, post_code, vat_number")
        .eq("id", customerId)
        .maybeSingle();
      customerData = cust;
    }

    // 4. Return assembled data
    const result = {
      invoice: invoiceRes.data,
      customer: customerData,
      items: itemsRes.data || [],
      totals: totalsRes.data || null,
      company: companyRes.data || null,
      banking: bankingRes.data?.include_on_invoices ? bankingRes.data : null,
      payments: paymentsRes.data || [],
      shareLink: { expires_at: linkData.expires_at },
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("[get-public-invoice] Error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
