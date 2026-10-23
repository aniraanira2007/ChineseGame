const STORAGE_KEY = "little-lantern-player-v1";
const DEFAULTS = { name: "Little learner", color: "#e878a1", appearance: { characterId: "sakura-street", outfitId: "teal-traveler", hairColor: "espresso", skinTone: "warm", eyeColor: "green", accessoryId: "signature" }, xp: 0, coins: 0, lessons: 0, studyStreak: 0, lastStudyDate: null, achievements: [] };

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  const saved = parsed && typeof parsed === "object" ? parsed : {};
  const appearance = { ...DEFAULTS.appearance, ...(saved.appearance || {}) };
  // Move the former default avatar to its new reference outfit while retaining
  // any player's other saved appearance choices.
  if (appearance.characterId === "sakura-street") {
    appearance.outfitId = "teal-traveler";
    if (appearance.hairColor === "rose") appearance.hairColor = "espresso";
    if (appearance.eyeColor === "ocean") appearance.eyeColor = "green";
    if (saved.appearance?.outfitId !== appearance.outfitId || saved.appearance?.hairColor !== appearance.hairColor || saved.appearance?.eyeColor !== appearance.eyeColor) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, appearance })); } catch { /* Continue with the in-memory migration. */ }
    }
  }
  return { ...DEFAULTS, ...saved, appearance };
  } catch { return { ...DEFAULTS }; }
}

let profile = read();
const levelFor = xp => Math.floor(xp / 100) + 1;
const titleFor = level => level >= 5 ? "Lantern guide" : level >= 3 ? "Curious explorer" : "Curious beginner";

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); }
  catch { /* Keep the in-memory profile usable when storage is disabled. */ }
  render();
  window.dispatchEvent(new CustomEvent("lantern:profile", { detail: getProfile() }));
}

function render() {
  const level = levelFor(profile.xp);
  document.querySelectorAll("[data-player-name]").forEach(el => { el.textContent = profile.name; });
  document.querySelectorAll("[data-player-level]").forEach(el => { el.textContent = level; });
  document.querySelectorAll("[data-player-title]").forEach(el => { el.textContent = titleFor(level); });
  document.querySelectorAll("[data-profile-xp]").forEach(el => { el.textContent = profile.xp; });
  document.querySelectorAll("[data-profile-coins]").forEach(el => { el.textContent = profile.coins; });
  document.querySelectorAll("[data-profile-lessons]").forEach(el => { el.textContent = profile.lessons; });
  const streakTier = profile.studyStreak >= 500 ? "diamond" : profile.studyStreak >= 300 ? "ruby" : "gold";
  document.querySelectorAll("[data-study-streak]").forEach(el => {
    el.textContent = profile.studyStreak;
    el.dataset.streakTier = streakTier;
    el.setAttribute("aria-label", `${profile.studyStreak} study day${profile.studyStreak === 1 ? "" : "s"}`);
  });
  document.querySelectorAll("[data-avatar-initial]").forEach(el => { el.textContent = [...profile.name][0] || "小"; el.style.backgroundColor = profile.color; });
  document.querySelectorAll(".top-avatar,.avatar").forEach(el => { el.textContent = [...profile.name][0] || "小"; el.style.backgroundColor = `${profile.color}33`; });
  document.querySelectorAll("[data-avatar-color]").forEach(el => el.classList.toggle("selected", el.dataset.avatarColor === profile.color));
  document.querySelectorAll(".preview-avatar").forEach(el => { el.textContent = [...profile.name][0] || "小"; el.style.backgroundColor = profile.color; });
  const input = document.querySelector("#player-name-input");
  if (input && !input.dataset.edited) input.value = profile.name;
  const badge = document.querySelector("[data-first-achievement]");
  if (badge && profile.achievements.includes("first-answer")) badge.textContent = "You answered your first Chinese picture question. Lovely work!";
}

export function getProfile() { return { ...profile, level: levelFor(profile.xp), title: titleFor(levelFor(profile.xp)) }; }

export function rewardStudyAnswer(correct) {
  // This is a saved cumulative study-day streak: breaks never erase progress.
  // Multiple answers on the same local calendar day count only once.
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (profile.lastStudyDate !== today) {
    profile.studyStreak = (Number(profile.studyStreak) || 0) + 1;
    profile.lastStudyDate = today;
  }
  profile.xp += correct ? 10 : 3;
  if (correct) profile.coins += 2;
  profile.lessons += 1;
  if (!profile.achievements.includes("first-answer")) profile.achievements.push("first-answer");
  save();
}

export function rewardWorldVisit(location) {
  const key = `visit:${location}`;
  if (profile.achievements.includes(key)) return false;
  profile.achievements.push(key);
  profile.xp += 5;
  profile.coins += 1;
  save();
  return true;
}

export function updateProfile(patch) {
  profile = { ...profile, ...patch };
  save();
}

render();
