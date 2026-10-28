import { supabaseClient, paymentsEnabled } from "./supabaseClient.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const outfitIdeas = [
  { key: "lantern-festival-outfit", icon: "🏮", name: "Lantern Festival", palette: "festival", detail: "A bright evening look for plaza celebrations." },
  { key: "shanghai-night-outfit", icon: "🌃", name: "Shanghai Night Walk", palette: "night", detail: "A modern city outfit inspired by the Bund at dusk." },
  { key: "cloud-campus-outfit", icon: "☁️", name: "Cloud Campus", palette: "cloud", detail: "A soft, sporty campus set for your next class." },
];

export function mountClubStore(root) {
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted = "true";
  let session = null;
  let membership = null;
  let purchasedOutfits = new Set();
  let status = "";
  let statusKind = "";

  const speak = text => {
    if (!("speechSynthesis" in window)) {
      status = "Speech audio is not available in this browser.";
      statusKind = "error";
      render();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.86;
    window.speechSynthesis.speak(utterance);
  };

  function render() {
    const isMember = membership?.status === "active" || membership?.status === "trialing";
    const outfitCards = outfitIdeas.map(item => `<article class="club-outfit-card ${item.palette}"><div class="club-outfit-art" aria-hidden="true"><span>${item.icon}</span><i></i><b>WORLD<br/>MATES</b></div><div class="club-outfit-copy"><h3>${h(item.name)}</h3><p>${h(item.detail)}</p><small>${purchasedOutfits.has(item.key) ? "Owned by your account" : "Cosmetic design preview"}</small><button class="club-button club-button-soft" type="button" disabled>${purchasedOutfits.has(item.key) ? "Asset not added yet" : "Coming soon"}</button></div></article>`).join("");
    root.innerHTML = `
      <header class="club-heading"><p class="eyebrow"><span class="eyebrow-dot"></span> OPTIONAL EXTRAS · CORE GAME STAYS FREE</p><h1 id="club-title">Worldmates <em>Club</em></h1><p>More Chinese mini-lessons, culture quests, and outfits as the world grows.</p></header>
      ${status ? `<p class="store-message ${statusKind === "error" ? "is-error" : ""}" role="status">${h(status)}</p>` : ""}
      <section class="club-plan-card" aria-labelledby="club-plan-title"><div class="club-plan-main"><span class="club-plan-mark">✦</span><div class="club-plan-intro"><p class="club-kicker">WORLD BUILDING MEMBERSHIP</p><h2 id="club-plan-title">Worldmates Club</h2><p>Planned member extras: monthly Chinese mini-lessons, themed culture quests, and a new cosmetic drop. The school, plaza, and basic learning stay free.</p></div><div class="club-price"><b>US$5</b><span>per month</span></div></div><ul class="club-perks"><li>✧ New cultural mini-lessons</li><li>✧ Member quest themes</li><li>✧ Monthly outfit drops after the outfits are built</li></ul>
        ${isMember ? `<div class="club-member-state" role="status">✦ Your membership is ${h(membership.status)}${membership.current_period_end ? ` through ${h(new Date(membership.current_period_end).toLocaleDateString())}` : ""}.</div>` : `<button class="club-button club-button-primary" type="button" data-club-checkout ${!paymentsEnabled || !session ? "disabled" : ""}>${session ? "Join Worldmates Club · US$5/month" : "Sign in to join · US$5/month"}</button><p class="club-small-print">${!session ? "Sign in through your profile first." : !paymentsEnabled ? "Checkout is not configured yet. This button will not charge you." : "Secure checkout opens on Stripe."}</p>`}
      </section>
      <section class="club-preview" aria-labelledby="club-preview-title"><div class="club-section-heading"><div><p class="club-kicker">FREE SAMPLE · ORDERING COFFEE</p><h2 id="club-preview-title">Try a mini-lesson</h2><p>This sample is free for everyone. Paid lessons are not locked behind membership yet.</p></div><button class="club-listen" type="button" data-speak="我想要一杯咖啡。" aria-label="Listen to the Chinese sentence">🔊 Listen</button></div><div class="club-phrase"><b lang="zh">我想要一杯咖啡。</b><span>Wǒ xiǎng yào yì bēi kāfēi.</span><small>I’d like a cup of coffee.</small></div><div class="club-question"><b>You want to order coffee. Which sentence would you say?</b><div class="club-answers"><button type="button" data-club-answer="wrong">我喜欢学校。</button><button type="button" data-club-answer="right">我想要一杯咖啡。</button><button type="button" data-club-answer="wrong">你叫什么名字？</button></div><p class="club-answer-status" role="status" data-answer-status>Select a sentence to practise.</p></div></section>
      <section class="club-wardrobe" aria-labelledby="club-wardrobe-title"><div class="club-section-heading"><div><p class="club-kicker">COSMETIC SHOP · PREVIEW</p><h2 id="club-wardrobe-title">Outfit ideas</h2><p>These are planned designs, not purchasable clothes yet. We’ll add and test the actual avatar assets before enabling sales.</p></div></div><div class="club-outfit-grid">${outfitCards}</div></section>
      <p class="club-free-note">No purchase is active right now. Players can keep using the existing free game and free outfits.</p>`;
  }

  async function loadCloudState() {
    if (!supabaseClient) { status = "Account service is not configured, so membership can’t sync yet."; statusKind = "error"; render(); return; }
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) { status = "Could not check your account. The free game is still available."; statusKind = "error"; render(); return; }
    session = data.session;
    if (session?.user) {
      const [subResult, entResult] = await Promise.all([
        supabaseClient.from("store_subscriptions").select("status,current_period_end").eq("user_id", session.user.id).maybeSingle(),
        supabaseClient.from("store_entitlements").select("product_key").eq("user_id", session.user.id).eq("active", true),
      ]);
      if (subResult.error || entResult.error) {
        status = "The payment database has not been set up yet. No purchase can be made.";
        statusKind = "error";
      } else {
        membership = subResult.data;
        purchasedOutfits = new Set((entResult.data || []).map(row => row.product_key));
      }
    }
    render();
  }

  root.addEventListener("click", async event => {
    const listen = event.target.closest("[data-speak]");
    if (listen) { speak(listen.dataset.speak); return; }
    const answer = event.target.closest("[data-club-answer]");
    if (answer) {
      const feedback = root.querySelector("[data-answer-status]");
      const correct = answer.dataset.clubAnswer === "right";
      feedback.textContent = correct ? "Correct! Wǒ xiǎng yào yì bēi kāfēi. = I’d like a cup of coffee." : "Try again. Choose the sentence that asks for a cup of coffee.";
      feedback.dataset.kind = correct ? "success" : "error";
      if (correct) speak("我想要一杯咖啡。");
      return;
    }
    if (!event.target.closest("[data-club-checkout]")) return;
    if (!session) { status = "Open your player profile and sign in before joining."; statusKind = "error"; render(); return; }
    if (!paymentsEnabled) return;
    const button = root.querySelector("[data-club-checkout]");
    button.disabled = true;
    button.textContent = "Opening secure checkout…";
    status = "Creating a secure checkout. You won’t be charged unless you confirm on Stripe.";
    statusKind = "";
    render();
    try {
      const { data, error } = await supabaseClient.functions.invoke("create-checkout", { body: { product_key: "club-monthly" } });
      if (error) throw error;
      if (!data?.url || !data.url.startsWith("https://checkout.stripe.com/")) throw new Error("Checkout is not configured yet.");
      window.location.assign(data.url);
    } catch (error) {
      status = error.message?.includes("Failed to send") || error.message?.includes("fetch")
        ? "Secure checkout is not deployed yet. No payment was taken."
        : `Checkout isn’t ready yet. No payment was taken. ${error.message || ""}`;
      statusKind = "error";
      render();
    }
  });

  render();
  loadCloudState();
  supabaseClient?.auth.onAuthStateChange((_event, nextSession) => {
    session = nextSession;
    membership = null;
    purchasedOutfits = new Set();
    loadCloudState();
  });
}
