import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return respond(405, { error: "Use POST." });

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const priceId = Deno.env.get("STRIPE_PRICE_CLUB_MONTHLY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "https://aniraanira2007.github.io/ChineseGame/").replace(/\/$/, "");
  if (!stripeSecret || !priceId || !supabaseUrl || !supabaseAnonKey) {
    return respond(503, { error: "Secure checkout is not configured. No payment was created." });
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond(401, { error: "Sign in before opening checkout." });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: "Your session expired. Sign in again." });

  let payload: { product_key?: string };
  try { payload = await request.json(); }
  catch { return respond(400, { error: "A product selection is required." }); }
  if (payload.product_key !== "club-monthly") {
    return respond(400, { error: "That item is not available for checkout yet." });
  }

  const configuredPrice = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
    headers: { Authorization: `Bearer ${stripeSecret}` },
  });
  const price = await configuredPrice.json();
  if (!configuredPrice.ok || !price.active || price.unit_amount !== 500 || price.currency !== "usd" || price.recurring?.interval !== "month") {
    console.error("Club price must be an active US$5 monthly Stripe Price.");
    return respond(503, { error: "Club checkout needs an active US$5 monthly price in Stripe. No payment was created." });
  }

  const fields = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${appBaseUrl}/?checkout=success#club`,
    cancel_url: `${appBaseUrl}/?checkout=cancelled#club`,
    client_reference_id: user.id,
    customer_email: user.email || "",
    "metadata[user_id]": user.id,
    "metadata[product_key]": "club-monthly",
    "subscription_data[metadata][user_id]": user.id,
    "subscription_data[metadata][product_key]": "club-monthly",
  });
  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeSecret}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: fields,
    });
    const result = await response.json();
    if (!response.ok || typeof result.url !== "string") {
      console.error("Stripe checkout could not be created:", result.error?.type || response.status);
      return respond(502, { error: "Stripe could not start checkout. No payment was taken." });
    }
    return respond(200, { url: result.url });
  } catch (error) {
    console.error("Checkout request failed:", error);
    return respond(502, { error: "Secure checkout is temporarily unavailable. No payment was taken." });
  }
});
