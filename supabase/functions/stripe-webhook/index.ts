import { createClient } from "npm:@supabase/supabase-js@2";

function hex(bytes: Uint8Array) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

async function validStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").map(part => part.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`)));
  const expected = hex(digest);
  return signatures.some(signature => constantTimeEqual(signature, expected));
}

function response(status: number, data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async request => {
  if (request.method !== "POST") return response(405, { error: "Use POST." });
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceKey) return response(503, { error: "Webhook service is not configured." });

  const rawBody = await request.text();
  const signature = request.headers.get("Stripe-Signature") || "";
  if (!await validStripeSignature(rawBody, signature, webhookSecret)) return response(400, { error: "Invalid Stripe signature." });

  let event: any;
  try { event = JSON.parse(rawBody); }
  catch { return response(400, { error: "Invalid event body." }); }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: seen, error: seenError } = await admin.from("store_stripe_events").select("event_id").eq("event_id", event.id).maybeSingle();
  if (seenError) return response(500, { error: "Payment event table is not ready." });
  if (seen) return response(200, { received: true, duplicate: true });

  try {
    if (event.type === "checkout.session.completed") {
      const checkout = event.data.object;
      const userId = checkout.metadata?.user_id || checkout.client_reference_id;
      const productKey = checkout.metadata?.product_key;
      if (checkout.mode === "subscription" && productKey === "club-monthly" && userId && checkout.subscription) {
        const subscriptionResponse = await fetch(`https://api.stripe.com/v1/subscriptions/${checkout.subscription}`, { headers: { Authorization: `Bearer ${stripeSecret}` } });
        if (!subscriptionResponse.ok) throw new Error("Could not fetch the new subscription.");
        const subscription = await subscriptionResponse.json();
        const isActive = ["active", "trialing"].includes(subscription.status);
        const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
        const { error } = await admin.from("store_subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: String(subscription.customer),
          stripe_subscription_id: subscription.id,
          product_key: productKey,
          status: subscription.status,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (error) throw error;
        const { error: entitlementError } = await admin.from("store_entitlements").upsert({
          user_id: userId, product_key: productKey, active: isActive, source: "stripe", expires_at: periodEnd,
          stripe_session_id: checkout.id, updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,product_key" });
        if (entitlementError) throw entitlementError;
      }
    } else if (["customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      const subscription = event.data.object;
      const userId = subscription.metadata?.user_id;
      const productKey = subscription.metadata?.product_key;
      if (userId && productKey === "club-monthly") {
        const status = event.type === "customer.subscription.deleted" ? "canceled" : subscription.status;
        const isActive = ["active", "trialing"].includes(status);
        const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
        const { error } = await admin.from("store_subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: String(subscription.customer),
          stripe_subscription_id: subscription.id,
          product_key: productKey,
          status,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (error) throw error;
        const { error: entitlementError } = await admin.from("store_entitlements").upsert({
          user_id: userId, product_key: productKey, active: isActive, source: "stripe", expires_at: periodEnd,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,product_key" });
        if (entitlementError) throw entitlementError;
      }
    }

    const { error: eventError } = await admin.from("store_stripe_events").insert({ event_id: event.id, event_type: event.type });
    if (eventError && eventError.code !== "23505") throw eventError;
    return response(200, { received: true });
  } catch (error) {
    console.error("Stripe event handling failed:", event.type, error?.message || error);
    return response(500, { error: "Could not safely update membership. Stripe may retry this event." });
  }
});
