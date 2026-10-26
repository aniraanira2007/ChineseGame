import { createClient } from "@supabase/supabase-js";
import { getProfile, replaceProfile, resetProfile, updateProfile } from "./profile.js";
import "./account.css";

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const OWNER_KEY = "worldmates-cloud-owner-v1";
const interestNames = ["music", "fashion", "anime", "programming", "sports", "travel", "languages"];
const escapeHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function mountAccount() {
  const form = document.querySelector("#account-form");
  const profileSave = document.querySelector("[data-profile-save]");
  if (!form || form.dataset.mounted) return;
  form.dataset.mounted = "true";

  const emailInput = document.querySelector("#account-email");
  const passwordInput = document.querySelector("#account-password");
  const submit = document.querySelector("#account-submit");
  const signOut = document.querySelector("#account-signout");
  const accountStatus = document.querySelector("#account-status");
  const profileStatus = document.querySelector("#profile-save-status");
  const statePill = document.querySelector("#account-state-pill");
  const privacyNote = document.querySelector("#profile-privacy-note");
  const directory = document.querySelector("#student-directory");
  const directoryResults = document.querySelector("#student-directory-results");
  const directorySearch = document.querySelector("#student-search");
  const directoryButton = document.querySelector("#student-directory-open");
  const country = document.querySelector("#public-country");
  const language = document.querySelector("#public-language");
  const username = document.querySelector("#public-username");
  const bio = document.querySelector("#public-bio");
  const interests = [...document.querySelectorAll(".interest-picker input[type=checkbox]")];

  let mode = "login";
  let user = null;
  let activeUserId = null;
  let suppressSync = false;
  let syncTimer = 0;
  let client = null;
  let directoryRows = [];
  const readOwner = () => { try { return localStorage.getItem(OWNER_KEY); } catch { return null; } };
  const writeOwner = userId => { try { localStorage.setItem(OWNER_KEY, userId); } catch { /* Account sessions can still work if browser storage is restricted. */ } };

  function say(element, message, kind = "") {
    if (!element) return;
    element.textContent = message;
    element.dataset.kind = kind;
  }

  function fillProfileForm(profile = getProfile()) {
    if (username && !username.matches(":focus")) username.value = profile.name || "";
    if (country && !country.matches(":focus")) country.value = profile.country || "";
    if (language && !language.matches(":focus")) language.value = profile.preferredLanguage || "English";
    if (bio && !bio.matches(":focus")) bio.value = profile.bio || "";
    const selected = new Set(profile.interests || []);
    interests.forEach(input => { input.checked = selected.has(input.value); });
  }

  function setSessionUi(sessionUser) {
    user = sessionUser || null;
    const signedIn = Boolean(user);
    form.hidden = signedIn;
    signOut.hidden = !signedIn;
    statePill.textContent = signedIn ? "Signed in" : "Device only";
    statePill.dataset.connected = signedIn ? "true" : "false";
    document.querySelectorAll("[data-save-status]").forEach(element => { element.textContent = signedIn ? "Account sync enabled" : "Saved on this device"; });
    if (!signedIn) {
      if (directory) directory.hidden = true;
      directoryRows = [];
      privacyNote.textContent = "Your progress is saved on this device. Sign in to sync it across devices.";
      if (client) say(accountStatus, "Signed out. Your saved game is still available on this device.");
    }
  }

  function collectPublicProfile() {
    return {
      name: (username.value.trim() || "Little learner").slice(0, 18),
      country: country.value,
      preferredLanguage: language.value,
      bio: bio.value.trim().slice(0, 160),
      interests: interests.filter(input => input.checked).map(input => input.value).filter(value => interestNames.includes(value)),
    };
  }

  function profileRow(snapshot, userId) {
    return {
      user_id: userId,
      username: snapshot.name,
      country: snapshot.country || null,
      preferred_language: snapshot.preferredLanguage || "English",
      bio: snapshot.bio || "",
      interests: snapshot.interests || [],
      avatar: snapshot.appearance || {},
      updated_at: new Date().toISOString(),
    };
  }

  async function syncToCloud() {
    if (!client || !user || suppressSync) return;
    const snapshot = getProfile();
    const [{ error: saveError }, { error: publicError }] = await Promise.all([
      client.from("player_saves").upsert({ user_id: user.id, profile: snapshot, updated_at: new Date().toISOString() }, { onConflict: "user_id" }),
      client.from("player_profiles").upsert(profileRow(snapshot, user.id), { onConflict: "user_id" }),
    ]);
    if (saveError || publicError) {
      console.warn("Worldmates account sync failed.", saveError || publicError);
      say(accountStatus, "Your game is saved on this device, but cloud sync failed. Check the profile table setup and connection.", "error");
      privacyNote.textContent = "Saved on this device. Cloud sync needs attention.";
      return;
    }
    say(accountStatus, "Your student card and game progress are synced to your account.", "success");
    privacyNote.textContent = "Your progress syncs to your account. Your email stays private.";
    writeOwner(user.id);
  }

  async function connectUser(sessionUser) {
    if (!client || !sessionUser || activeUserId === sessionUser.id) return;
    activeUserId = sessionUser.id;
    setSessionUi(sessionUser);
    say(accountStatus, "Loading your saved Worldmates profile…");
    const [{ data: publicRow, error: publicError }, { data: saveRow, error: saveError }] = await Promise.all([
      client.from("player_profiles").select("username,country,preferred_language,bio,interests,avatar,level").eq("user_id", sessionUser.id).maybeSingle(),
      client.from("player_saves").select("profile").eq("user_id", sessionUser.id).maybeSingle(),
    ]);
    if (publicError || saveError) {
      console.warn("Worldmates profile tables are not available.", publicError || saveError);
      say(accountStatus, "You’re signed in, but cloud profile tables are not set up yet. Run the Worldmates profile SQL in Supabase.", "error");
      return;
    }

    const previousOwner = readOwner();
    suppressSync = true;
    if (saveRow?.profile && typeof saveRow.profile === "object") {
      const savedProfile = saveRow.profile;
      replaceProfile({ ...savedProfile,
        name: publicRow?.username || savedProfile.name,
        country: publicRow ? publicRow.country || "" : savedProfile.country || "",
        preferredLanguage: publicRow ? publicRow.preferred_language || "English" : savedProfile.preferredLanguage || "English",
        bio: publicRow ? publicRow.bio || "" : savedProfile.bio || "",
        interests: publicRow ? publicRow.interests || [] : savedProfile.interests || [],
        appearance: publicRow?.avatar || savedProfile.appearance,
      });
    } else if (previousOwner && previousOwner !== sessionUser.id) {
      resetProfile();
      const metadata = sessionUser.user_metadata || {};
      if (publicRow) replaceProfile({ ...getProfile(), name: publicRow.username, country: publicRow.country || "", preferredLanguage: publicRow.preferred_language || "English", bio: publicRow.bio || "", interests: publicRow.interests || [], appearance: publicRow.avatar || getProfile().appearance });
      else replaceProfile({ ...getProfile(), name: metadata.username || getProfile().name, country: metadata.country || "", preferredLanguage: metadata.preferred_language || "English", bio: metadata.bio || "", interests: Array.isArray(metadata.interests) ? metadata.interests : [] });
    } else if (publicRow) {
      replaceProfile({ ...getProfile(), name: publicRow.username, country: publicRow.country || "", preferredLanguage: publicRow.preferred_language || "English", bio: publicRow.bio || "", interests: publicRow.interests || [], appearance: publicRow.avatar || getProfile().appearance });
    }
    suppressSync = false;
    writeOwner(sessionUser.id);
    fillProfileForm();
    await syncToCloud();
  }

  profileSave?.addEventListener("click", () => {
    updateProfile(collectPublicProfile());
    fillProfileForm();
    say(profileStatus, user ? "Student card saved. Syncing it to your account…" : "Student card saved on this device.", "success");
  });

  document.querySelectorAll("[data-account-mode]").forEach(button => button.addEventListener("click", () => {
    mode = button.dataset.accountMode;
    document.querySelectorAll("[data-account-mode]").forEach(item => item.classList.toggle("selected", item === button));
    passwordInput.autocomplete = mode === "signup" ? "new-password" : "current-password";
    submit.textContent = mode === "signup" ? "Create account securely" : "Sign in securely";
    say(accountStatus, mode === "signup" ? "Use an email you can verify and a unique password." : "Sign in to load your saved profile.");
  }));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!client) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || password.length < 8) { say(accountStatus, "Enter a valid email and a password with at least 8 characters.", "error"); return; }
    submit.disabled = true;
    say(accountStatus, mode === "signup" ? "Creating your account…" : "Signing in…");
    try {
      const publicCard = collectPublicProfile();
      const result = mode === "signup"
        ? await client.auth.signUp({ email, password, options: { data: { username: publicCard.name, country: publicCard.country, preferred_language: publicCard.preferredLanguage, bio: publicCard.bio, interests: publicCard.interests } } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      passwordInput.value = "";
      if (result.data.session?.user) await connectUser(result.data.session.user);
      else if (mode === "signup") say(accountStatus, "Account created. Check your email for a verification link, then sign in here.", "success");
      else say(accountStatus, "Sign in was successful. Loading your saved profile…", "success");
    } catch (error) {
      console.warn("Worldmates account action failed.", error);
      say(accountStatus, error.message || "Account request failed. Check your connection and try again.", "error");
    } finally { submit.disabled = false; }
  });

  signOut.addEventListener("click", async () => {
    if (!client) return;
    signOut.disabled = true;
    const { error } = await client.auth.signOut();
    signOut.disabled = false;
    if (error) { say(accountStatus, "Could not sign out. Check your connection and try again.", "error"); return; }
    activeUserId = null;
    setSessionUi(null);
    fillProfileForm();
  });

  function renderDirectory() {
    if (!directoryResults) return;
    const query = (directorySearch?.value || "").trim().toLocaleLowerCase();
    const results = directoryRows.filter(row => String(row.username || "").toLocaleLowerCase().includes(query));
    directoryResults.innerHTML = results.length ? results.map(row => {
      const initial = [...(row.username || "小")][0] || "小";
      const interestsText = Array.isArray(row.interests) ? row.interests.slice(0, 4).map(escapeHtml).join(" · ") : "";
      return '<article class="student-directory-card"><span class="student-directory-avatar">' + escapeHtml(initial) + '</span><div><b>' + escapeHtml(row.username || "Worldmate") + '</b><small>' + [row.country, row.preferred_language].filter(Boolean).map(escapeHtml).join(" · ") + '</small><p>' + escapeHtml(row.bio || "A Worldmates student.") + '</p>' + (interestsText ? '<small>Likes ' + interestsText + '</small>' : "") + '</div></article>';
    }).join("") : '<p class="account-feedback">No student cards match that search yet.</p>';
  }

  directoryButton?.addEventListener("click", async () => {
    if (!client) { say(accountStatus, "Set up Supabase to browse signed-in student cards."); return; }
    if (!user) { say(accountStatus, "Sign in to browse student cards. Email addresses are never shown."); return; }
    directory.hidden = false;
    directoryResults.innerHTML = '<p class="account-feedback">Loading student cards…</p>';
    directoryButton.disabled = true;
    const { data, error } = await client.from("player_profiles").select("user_id,username,country,preferred_language,bio,interests").neq("user_id", user.id).order("updated_at", { ascending: false }).limit(50);
    directoryButton.disabled = false;
    if (error) {
      console.warn("Worldmates student directory could not load.", error);
      directoryResults.innerHTML = '<p class="account-feedback" data-kind="error">Student cards need the profile database setup.</p>';
      return;
    }
    directoryRows = Array.isArray(data) ? data : [];
    renderDirectory();
  });
  directorySearch?.addEventListener("input", renderDirectory);

  window.addEventListener("lantern:profile", () => {
    fillProfileForm();
    if (!client || !user || suppressSync) return;
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => { syncToCloud().catch(error => { console.warn("Worldmates cloud sync could not complete.", error); say(accountStatus, "Your local save is safe, but cloud sync couldn’t finish.", "error"); }); }, 500);
  });

  fillProfileForm();
  if (!projectUrl || !publicKey) {
    form.querySelectorAll("input,button[type=submit]").forEach(control => { control.disabled = true; });
    if (directoryButton) directoryButton.disabled = true;
    say(accountStatus, "Account sync is not configured. Your game and student card still save on this device.");
    return;
  }

  client = createClient(projectUrl, publicKey);
  client.auth.onAuthStateChange((event, session) => {
    if (session?.user) { connectUser(session.user).catch(error => { console.warn("Worldmates profile could not load.", error); say(accountStatus, "Signed in, but your saved profile could not load. Check the database setup.", "error"); }); }
    else if (event === "SIGNED_OUT") { activeUserId = null; setSessionUi(null); }
  });
  client.auth.getSession().then(({ data, error }) => {
    if (error) { say(accountStatus, "Could not check your account session. Your local save is still available.", "error"); return; }
    if (data.session?.user) connectUser(data.session.user).catch(err => { console.warn("Worldmates profile could not load.", err); say(accountStatus, "Signed in, but your saved profile could not load. Check the database setup.", "error"); });
    else say(accountStatus, "No account is signed in. Your game is saved on this device.");
  }).catch(error => { console.warn("Worldmates account status could not load.", error); say(accountStatus, "Account service is unavailable right now. Your local save is safe.", "error"); });
}
