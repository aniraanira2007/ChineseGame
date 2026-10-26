import vocabulary from "./data/hsk1-vocabulary.json";

const STORAGE_KEY = "little-lantern-player-v1";
const DEFAULTS = { name: "Little learner", color: "#e878a1", country: "", preferredLanguage: "English", bio: "", interests: [], appearance: { characterId: "sakura-street", outfitId: "teal-traveler", hairColor: "espresso", skinTone: "warm", eyeColor: "green", accessoryId: "signature" }, xp: 0, coins: 0, lessons: 0, studyStreak: 0, currentStudyStreak: 0, bestStudyStreak: 0, lastStudyDate: null, restDayCredits: 1, restDayUsedWeek: null, restDayDate: null, streakRewards: [], achievements: [], wordCollection: [], dailyQuest: { date: null, studiedWords: [], orderComplete: false, claimed: false }, npcRewards: {}, weeklyClaimed: null };
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const weekKey = value => { const date = new Date(`${value}T12:00:00`); if (Number.isNaN(date.getTime())) return ""; date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return localDate(date); };
const DAILY_FOOD_WORDS = new Set(["包子", "茶", "鸡蛋", "米饭", "苹果"]);

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
  const lastStudy = saved.lastStudyDate ? new Date(`${saved.lastStudyDate}T12:00:00`) : null;
  const daysSinceStudy = lastStudy ? Math.floor((new Date(`${localDate()}T12:00:00`) - lastStudy) / 86400000) : Infinity;
  const currentStudyStreak = Number.isFinite(saved.currentStudyStreak) ? saved.currentStudyStreak : daysSinceStudy <= 1 && saved.lastStudyDate ? 1 : 0;
  return { ...DEFAULTS, ...saved, appearance, currentStudyStreak, interests: Array.isArray(saved.interests) ? saved.interests : [], wordCollection: Array.isArray(saved.wordCollection) ? saved.wordCollection : [], streakRewards: Array.isArray(saved.streakRewards) ? saved.streakRewards : [], dailyQuest: { ...DEFAULTS.dailyQuest, ...(saved.dailyQuest || {}), studiedWords: Array.isArray(saved.dailyQuest?.studiedWords) ? saved.dailyQuest.studiedWords : [] }, npcRewards: saved.npcRewards && typeof saved.npcRewards === "object" ? saved.npcRewards : {} };
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
  if (badge && profile.achievements.includes("first-answer")) badge.textContent = "You answered your first Chinese school question. Lovely work!";
  document.querySelectorAll("[data-food-cosmetic]").forEach(el => { el.hidden = !profile.achievements.includes("food-street-pin"); });
}

export function getProfile() { return { ...profile, level: levelFor(profile.xp), title: titleFor(levelFor(profile.xp)) }; }

export function rewardStudyAnswer(correct) {
  const today = localDate();
  if (profile.lastStudyDate !== today) {
    let current = Number(profile.currentStudyStreak) || 0;
    if (!profile.lastStudyDate) current = 0;
    else {
      const last = new Date(`${profile.lastStudyDate}T12:00:00`);
      const todayDate = new Date(`${today}T12:00:00`);
      const gap = Math.round((todayDate - last) / 86400000);
      const protectedMiss = gap === 2 && profile.restDayDate === localDate(new Date(last.getTime() + 86400000));
      current = gap === 1 || protectedMiss ? current : 0;
    }
    profile.currentStudyStreak = current + 1;
    profile.bestStudyStreak = Math.max(Number(profile.bestStudyStreak) || 0, profile.currentStudyStreak);
    profile.studyStreak = (Number(profile.studyStreak) || 0) + 1;
    profile.lastStudyDate = today;
    profile.restDayDate = null;
    if (profile.studyStreak % 7 === 0) profile.restDayCredits = Math.min(3, (Number(profile.restDayCredits) || 0) + 1);
  }
  profile.xp += correct ? 10 : 3;
  if (correct) profile.coins += 2;
  profile.lessons += 1;
  if (!profile.achievements.includes("first-answer")) profile.achievements.push("first-answer");
  const rewardMilestones = { 3: [10, 3], 7: [25, 8], 14: [50, 15], 30: [100, 30] };
  const rewardMilestone = rewardMilestones[profile.currentStudyStreak];
  if (rewardMilestone && !profile.streakRewards.includes(profile.currentStudyStreak)) {
    profile.streakRewards.push(profile.currentStudyStreak);
    profile.xp += rewardMilestone[0];
    profile.coins += rewardMilestone[1];
  }
  save();
}

export function useRestDay() {
  const today = localDate();
  const currentWeek = weekKey(today);
  if (profile.lastStudyDate === today) return { ok: false, message: "You already studied today; save your rest day for another day." };
  if ((Number(profile.restDayCredits) || 0) < 1) return { ok: false, message: "You are out of rest-day credits. Earn one for every 7 study days." };
  if (profile.restDayUsedWeek === currentWeek) return { ok: false, message: "You have already used this week’s rest day." };
  profile.restDayCredits -= 1;
  profile.restDayUsedWeek = currentWeek;
  profile.restDayDate = today;
  save();
  return { ok: true, message: "Rest day saved. Your current study run is protected for tomorrow." };
}

export function recordDailyFoodWord(hanzi) {
  const today = localDate();
  const quest = profile.dailyQuest?.date === today ? { ...profile.dailyQuest } : { date: today, studiedWords: [], orderComplete: false, claimed: false };
  if (!DAILY_FOOD_WORDS.has(hanzi) || quest.studiedWords.includes(hanzi) || !vocabulary.words.some(word => word.hanzi === hanzi)) return false;
  quest.studiedWords = [...quest.studiedWords, hanzi].slice(0, 5);
  profile.dailyQuest = quest;
  save();
  return true;
}

export function completeDailyFoodOrder() {
  const today = localDate();
  const quest = profile.dailyQuest?.date === today ? { ...profile.dailyQuest } : null;
  if (!quest || quest.studiedWords.length < 5 || quest.orderComplete) return false;
  quest.orderComplete = true;
  quest.claimed = true;
  profile.dailyQuest = quest;
  profile.xp += 45;
  profile.coins += 18;
  if (!profile.achievements.includes("food-street-pin")) profile.achievements.push("food-street-pin");
  if (!profile.achievements.includes("daily-food-quest")) profile.achievements.push("daily-food-quest");
  save();
  return true;
}

export function addLearnedWord(word) {
  if (!word?.hanzi || profile.wordCollection.some(item => item.hanzi === word.hanzi)) return false;
  const savedWord = { hanzi: word.hanzi, pinyin: word.pinyin || "", meaning: word.meaning || "", learnedAt: localDate() };
  const wordCollection = [...profile.wordCollection, savedWord];
  const currentWeek = weekKey(savedWord.learnedAt);
  const weeklyCount = wordCollection.filter(item => weekKey(item.learnedAt) === currentWeek).length;
  const achievements = [...profile.achievements];
  if (wordCollection.length >= 5 && !achievements.includes("garden-unlocked")) achievements.push("garden-unlocked");
  if (wordCollection.length >= 10 && !achievements.includes("pavilion-unlocked")) achievements.push("pavilion-unlocked");
  const weeklyReward = weeklyCount >= 10 && profile.weeklyClaimed !== currentWeek;
  if (weeklyReward && !achievements.includes("weekly-word-goal")) achievements.push("weekly-word-goal");
  updateProfile({ wordCollection, achievements, weeklyClaimed: weeklyReward ? currentWeek : profile.weeklyClaimed, xp: profile.xp + (weeklyReward ? 30 : 0), coins: profile.coins + (weeklyReward ? 8 : 0) });
  return true;
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

export function replaceProfile(nextProfile = {}) {
  profile = { ...DEFAULTS, ...nextProfile, appearance: { ...DEFAULTS.appearance, ...(nextProfile.appearance || {}) }, interests: Array.isArray(nextProfile.interests) ? nextProfile.interests : [], wordCollection: Array.isArray(nextProfile.wordCollection) ? nextProfile.wordCollection : [], streakRewards: Array.isArray(nextProfile.streakRewards) ? nextProfile.streakRewards : [], dailyQuest: { ...DEFAULTS.dailyQuest, ...(nextProfile.dailyQuest || {}), studiedWords: Array.isArray(nextProfile.dailyQuest?.studiedWords) ? nextProfile.dailyQuest.studiedWords : [] }, npcRewards: nextProfile.npcRewards && typeof nextProfile.npcRewards === "object" ? nextProfile.npcRewards : {} };
  save();
}

export function resetProfile() { replaceProfile(DEFAULTS); }

render();
