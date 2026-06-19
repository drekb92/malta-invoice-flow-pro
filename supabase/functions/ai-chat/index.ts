import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history: Message[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { message, history = [] }: ChatRequest = await req.json();

    // Fetch business context in parallel
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [
      { data: invoices },
      { data: customers },
      { data: companySettings },
      { data: overdueInvoices },
    ] = await Promise.all([
      supabase
        .from("invoices")
        .select("invoice_number, status, total_amount, due_date, issue_date, customers(name)")
        .eq("user_id", user.id)
        .gte("issue_date", thirtyDaysAgo)
        .order("issue_date", { ascending: false })
        .limit(50),
      supabase
        .from("customers")
        .select("name, email, phone, outstanding_balance")
        .eq("user_id", user.id)
        .limit(100),
      supabase
        .from("company_settings")
        .select("company_name, currency_code, vat_number")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("invoices")
        .select("invoice_number, total_amount, due_date, customers(name)")
        .eq("user_id", user.id)
        .eq("status", "overdue")
        .order("due_date", { ascending: true })
        .limit(20),
    ]);

    // Summarise totals
    const totalOutstanding = (invoices || [])
      .filter((inv) => ["sent", "overdue"].includes(inv.status))
      .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

    const totalPaidThisMonth = (invoices || [])
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

    const currency = companySettings?.currency_code || "EUR";

    const systemPrompt = `You are an AI assistant built into an invoice management application called Malta Invoice Flow Pro.
You help the user understand their business finances, invoices, customers, and outstanding payments.

Today's date: ${today}
Company: ${companySettings?.company_name || "Unknown"}
Currency: ${currency}

BUSINESS SUMMARY (last 30 days):
- Total outstanding (sent/overdue): ${currency} ${totalOutstanding.toFixed(2)}
- Total collected this month: ${currency} ${totalPaidThisMonth.toFixed(2)}
- Overdue invoices: ${(overdueInvoices || []).length}

RECENT INVOICES (last 30 days):
${(invoices || []).map((inv) =>
  `- #${inv.invoice_number} | ${(inv.customers as any)?.name || "Unknown"} | ${currency} ${Number(inv.total_amount || 0).toFixed(2)} | Status: ${inv.status} | Due: ${inv.due_date}`
).join("\n")}

OVERDUE INVOICES:
${(overdueInvoices || []).length === 0
  ? "None"
  : (overdueInvoices || []).map((inv) =>
      `- #${inv.invoice_number} | ${(inv.customers as any)?.name || "Unknown"} | ${currency} ${Number(inv.total_amount || 0).toFixed(2)} | Due: ${inv.due_date}`
    ).join("\n")}

CUSTOMERS (${(customers || []).length} total):
${(customers || []).slice(0, 20).map((c) =>
  `- ${c.name}${c.outstanding_balance ? ` | Outstanding: ${currency} ${Number(c.outstanding_balance).toFixed(2)}` : ""}`
).join("\n")}

Answer questions about invoices, payments, customers, and business trends.
Be concise and specific. Use the data above to give accurate answers.
If asked to draft a reminder or message, write it professionally.
If data you need is not in the summary, say so clearly.`;

    const messages = [
      ...history,
      { role: "user" as const, content: message },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const result = await response.json();
    const reply = result.content?.[0]?.text || "Sorry, I couldn't generate a response.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("ai-chat error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
