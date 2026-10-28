import { questions } from "./questions.js";
import vocabulary from "./data/hsk1-vocabulary.json";
import { addLearnedWord, completeDailyFoodOrder, getProfile, recordDailyFoodWord, rewardStudyAnswer, updateProfile, useRestDay } from "./profile.js";

const words = new Map(vocabulary.words.map(word => [word.hanzi, word]));
const dateKey = (date = new Date()) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
const today = () => dateKey();
const weekKey = value => { if (!value) return ""; const date = new Date(value + "T12:00:00"); if (Number.isNaN(date.getTime())) return ""; date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return dateKey(date); };
const safe = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const FOOD_QUEST = [
  { hanzi: "包子", emoji: "🥟", hint: "A soft steamed bun with a tasty filling.", color: "#f7e7d5", choices: ["包子", "饺子", "米饭"] },
  { hanzi: "茶", emoji: "🍵", hint: "A warm drink made from leaves.", color: "#e6eee4", choices: ["茶", "牛奶", "水"] },
  { hanzi: "鸡蛋", emoji: "🥚", hint: "A common breakfast food with a shell.", color: "#f5efd8", choices: ["鸡蛋", "苹果", "包子"] },
  { hanzi: "米饭", emoji: "🍚", hint: "A bowl of cooked rice, a Chinese meal staple.", color: "#f0e7d8", choices: ["米饭", "饺子", "牛奶"] },
  { hanzi: "苹果", emoji: "🍎", hint: "A crisp fruit that can be red or green.", color: "#f5e4df", choices: ["苹果", "鸡蛋", "茶"] }
];
const WORD_HUNT = [
  { id: "lantern", hanzi: "灯笼", pinyin: "dēnglong", meaning: "lantern", clue: "Find the glowing red decoration that hangs above the plaza.", object: "Lantern", emoji: "🏮", x: 8, z: -17 },
  { id: "book", hanzi: "书", pinyin: "shū", meaning: "book", clue: "Find something with pages that you can read at school.", object: "Book", emoji: "📕", x: -10, z: 18 },
  { id: "tea", hanzi: "茶", pinyin: "chá", meaning: "tea", clue: "Find the warm drink in a little cup.", object: "Tea", emoji: "🍵", x: 10, z: 18 },
  { id: "bun", hanzi: "包子", pinyin: "bāozi", meaning: "steamed bun", clue: "Find a soft steamed bun in a bamboo basket.", object: "Steamed bun", emoji: "🥟", x: -20, z: 18 },
  { id: "apple", hanzi: "苹果", pinyin: "píngguǒ", meaning: "apple", clue: "Find the round red fruit with a little green leaf.", object: "Apple", emoji: "🍎", x: 21, z: 18 }
];
const NPC_QUESTS = [
  { id: "greeting", npc: "Mei", avatar: "梅", role: "Classmate at the school gate", prompt: "同学：你好！你好吗？", translation: "Hi! How are you?", replies: [{ text: "我很好，谢谢。", pinyin: "Wǒ hěn hǎo, xièxie.", meaning: "I’m well, thank you.", correct: true, words: ["谢谢"] }, { text: "我想吃包子。", pinyin: "Wǒ xiǎng chī bāozi.", meaning: "I’d like a steamed bun.", correct: false, words: [] }, { text: "再见。", pinyin: "Zàijiàn.", meaning: "Goodbye.", correct: false, words: [] }], hint: "Mei greeted you. Reply with a friendly ‘I’m well, thank you.’" },
  { id: "directions", npc: "An", avatar: "安", role: "New student looking for class", prompt: "安：中文教室在哪里？", translation: "Where is the Chinese classroom?", replies: [{ text: "教室在前面。", pinyin: "Jiàoshì zài qiánmiàn.", meaning: "The classroom is ahead.", correct: true, words: ["教室", "在", "前面"] }, { text: "我喜欢苹果。", pinyin: "Wǒ xǐhuan píngguǒ.", meaning: "I like apples.", correct: false, words: ["苹果"] }, { text: "我很好。", pinyin: "Wǒ hěn hǎo.", meaning: "I’m well.", correct: false, words: [] }], hint: "An needs directions. Choose the reply that tells them the classroom is ahead." },
  { id: "order", npc: "Lin", avatar: "林", role: "Food Street shopkeeper", prompt: "老板：你想吃什么？", translation: "What would you like to eat?", replies: [{ text: "我想吃包子。", pinyin: "Wǒ xiǎng chī bāozi.", meaning: "I’d like a steamed bun.", correct: true, words: ["包子"] }, { text: "教室在前面。", pinyin: "Jiàoshì zài qiánmiàn.", meaning: "The classroom is ahead.", correct: false, words: ["教室", "在", "前面"] }, { text: "你好！", pinyin: "Nǐ hǎo.", meaning: "Hello!", correct: false, words: ["你好"] }], hint: "Lin is taking a food order. Choose the sentence that asks for a bun." }
];
const CULTURE_STOPS = [
  {
    id: "pho", name: "Hanoi · Phở", tag: "VIET NAM · STREET FOOD",
    fact: "Phở is a noodle soup made with flat rice noodles. Vietnam Tourism notes that Hanoi-style phở is often served with a clear broth, lemon, and bird’s-eye chili; recipes and toppings vary by region.",
    question: "Which noodle is traditionally used in phở?", choices: [["Flat rice noodles", true], ["Wheat ramen noodles", false], ["Potato noodles", false]],
    source: "https://vietnam.travel/node/195", sourceLabel: "Vietnam Tourism · 21 must-try Vietnamese dishes"
  },
  {
    id: "yatai", name: "Matsuri · Yatai", tag: "JAPAN · FESTIVAL FOOD",
    fact: "At many Japanese local festivals, yatai are food stalls. Festival foods differ by region and event; examples include takoyaki and yakitori.",
    question: "What does yatai refer to in this festival context?", choices: [["A food stall", true], ["A school uniform", false], ["A festival drum", false]],
    source: "https://www.japan.travel/en/guide/get-involved-in-local-festivals/", sourceLabel: "Japan National Tourism Organization · Local festivals"
  },
  {
    id: "xiaolongbao", name: "Shanghai · 小笼包", tag: "CHINA · SHANGHAI FOOD",
    fact: "Shanghai xiaolongbao are small soup dumplings, often served in bamboo steamers. The Shanghai municipal site recommends opening one carefully because the broth inside is hot.",
    question: "What should you remember when eating a soup dumpling?", choices: [["Let the hot soup cool before sipping", true], ["Eat it in one quick bite", false], ["Freeze it first", false]],
    source: "https://english.shanghai.gov.cn/en-GlobalTasteinShanghai2026-LocalFlavors/20260316/00b0c6d1698d406c8d532a6e169e1a1e.html", sourceLabel: "Shanghai Municipal Government · Xiaolongbao"
  }
];
const emptyQuest = () => ({ date: today(), studiedWords: [], orderComplete: false, claimed: false });
const CLASS_WORDS = ["你好", "谢谢", "再见", "老师", "学生", "学校", "朋友", "学习"];
const CLASS_EXAM = [
  { prompt: "How do you say “hello” in Chinese?", answer: "你好", choices: ["你好", "谢谢", "再见", "朋友"] },
  { prompt: "What does 谢谢 mean?", answer: "Thank you", choices: ["Goodbye", "Thank you", "Teacher", "Student"] },
  { prompt: "Choose the Chinese word for “teacher”.", answer: "老师", choices: ["学生", "朋友", "老师", "学校"] },
  { prompt: "What does 学生 mean?", answer: "Student", choices: ["School", "Study", "Student", "Friend"] },
  { prompt: "How do you say “school” in Chinese?", answer: "学校", choices: ["学习", "学校", "老师", "再见"] },
  { prompt: "What does 朋友 mean?", answer: "Friend", choices: ["Friend", "Teacher", "Hello", "Study"] },
  { prompt: "Choose the Chinese word for “study”.", answer: "学习", choices: ["谢谢", "学校", "学习", "你好"] },
  { prompt: "How do you say “goodbye” in Chinese?", answer: "再见", choices: ["再见", "你好", "学生", "朋友"] }
];
const CULTURE_GAME_WORDS = [
  { hanzi: "苹果", pinyin: "píngguǒ", meaning: "apple", emoji: "🍎" }, { hanzi: "香蕉", pinyin: "xiāngjiāo", meaning: "banana", emoji: "🍌" },
  { hanzi: "橙子", pinyin: "chéngzi", meaning: "orange", emoji: "🍊" }, { hanzi: "西瓜", pinyin: "xīguā", meaning: "watermelon", emoji: "🍉" },
  { hanzi: "桌子", pinyin: "zhuōzi", meaning: "table", emoji: "🪑" }, { hanzi: "椅子", pinyin: "yǐzi", meaning: "chair", emoji: "🪑" },
  { hanzi: "房子", pinyin: "fángzi", meaning: "house", emoji: "🏠" }, { hanzi: "书", pinyin: "shū", meaning: "book", emoji: "📕" },
  { hanzi: "猫", pinyin: "māo", meaning: "cat", emoji: "🐈" }, { hanzi: "狗", pinyin: "gǒu", meaning: "dog", emoji: "🐕" },
  { hanzi: "牛奶", pinyin: "niúnǎi", meaning: "milk", emoji: "🥛" }, { hanzi: "鸡蛋", pinyin: "jīdàn", meaning: "egg", emoji: "🥚" }
];
const GYM_MACHINES = [
  { id: "treadmill", name: "Treadmill", emoji: "🏃", move: "Easy walk", cue: "Start slowly, look forward, stay near the center, and use the safety stop. Hold the rails only while getting on or off." },
  { id: "bike", name: "Exercise bike", emoji: "🚲", move: "Easy pedal", cue: "Adjust the seat so your knee stays slightly bent at the bottom of the pedal stroke. Sit tall and pedal gently." },
  { id: "elliptical", name: "Elliptical", emoji: "🚶", move: "Smooth stride", cue: "Stand tall with both feet on the pedals. Move smoothly and keep your knees soft; hold the handles for balance." },
  { id: "rower", name: "Rowing machine", emoji: "🚣", move: "Gentle row", cue: "Push with your legs first, lean back only a little, then bring the handle toward your lower ribs. Return in reverse order." },
  { id: "chest-press", name: "Chest press", emoji: "💪", move: "Light press", cue: "Set a very light resistance. Keep wrists straight, shoulders relaxed, and elbows below shoulder height. Never lock your elbows." },
  { id: "leg-press", name: "Leg press", emoji: "🦵", move: "Short press", cue: "Use light resistance, keep your whole foot on the platform, and stop before your knees lock or fold toward your chest." },
  { id: "cable", name: "Cable station", emoji: "🏋️", move: "Standing pull", cue: "Choose the lightest setting. Stand balanced, keep your back neutral, and move slowly without twisting or jerking." },
  { id: "stretch", name: "Stretch mat", emoji: "🧘", move: "Gentle stretch", cue: "Breathe normally and move only to a comfortable stretch. Do not bounce or push through pain." }
];
const RESTAURANT_MENU = {
  breakfast: [{ hanzi: "豆浆", pinyin: "dòujiāng", meaning: "soy milk", emoji: "🥛" }, { hanzi: "包子", pinyin: "bāozi", meaning: "steamed bun", emoji: "🥟" }, { hanzi: "粥", pinyin: "zhōu", meaning: "rice porridge", emoji: "🥣" }, { hanzi: "鸡蛋", pinyin: "jīdàn", meaning: "egg", emoji: "🥚" }],
  lunch: [{ hanzi: "米饭", pinyin: "mǐfàn", meaning: "rice", emoji: "🍚" }, { hanzi: "面条", pinyin: "miàntiáo", meaning: "noodles", emoji: "🍜" }, { hanzi: "饺子", pinyin: "jiǎozi", meaning: "dumplings", emoji: "🥟" }, { hanzi: "青菜", pinyin: "qīngcài", meaning: "green vegetables", emoji: "🥬" }],
  dinner: [{ hanzi: "鱼", pinyin: "yú", meaning: "fish", emoji: "🐟" }, { hanzi: "鸡肉", pinyin: "jīròu", meaning: "chicken", emoji: "🍗" }, { hanzi: "汤", pinyin: "tāng", meaning: "soup", emoji: "🍲" }, { hanzi: "水果", pinyin: "shuǐguǒ", meaning: "fruit", emoji: "🍉" }]
};
const COFFEE_MENU = [{ hanzi: "咖啡", pinyin: "kāfēi", meaning: "coffee", emoji: "☕" }, { hanzi: "拿铁", pinyin: "nátiě", meaning: "latte", emoji: "🥛" }, { hanzi: "茶", pinyin: "chá", meaning: "tea", emoji: "🍵" }, { hanzi: "热水", pinyin: "rè shuǐ", meaning: "hot water", emoji: "🫖" }, { hanzi: "蛋糕", pinyin: "dàngāo", meaning: "cake", emoji: "🍰" }, { hanzi: "面包", pinyin: "miànbāo", meaning: "bread", emoji: "🍞" }];
const MATH_QUESTIONS = [
  { prompt: "一 + 一 = ?", pinyin: "yī jiā yī", meaning: "one plus one", choices: [["二", "èr · two"], ["三", "sān · three"], ["四", "sì · four"]], answer: "二", words: ["一", "二"] },
  { prompt: "二 + 一 = ?", pinyin: "èr jiā yī", meaning: "two plus one", choices: [["三", "sān · three"], ["二", "èr · two"], ["五", "wǔ · five"]], answer: "三", words: ["二", "三"] },
  { prompt: "五 − 二 = ?", pinyin: "wǔ jiǎn èr", meaning: "five minus two", choices: [["三", "sān · three"], ["四", "sì · four"], ["一", "yī · one"]], answer: "三", words: ["五", "二", "三"] },
  { prompt: "How do you say ‘four’?", pinyin: "sì", meaning: "four", choices: [["四", "sì · four"], ["十", "shí · ten"], ["三", "sān · three"]], answer: "四", words: ["四"] },
  { prompt: "三 + 二 = ?", pinyin: "sān jiā èr", meaning: "three plus two", choices: [["五", "wǔ · five"], ["六", "liù · six"], ["四", "sì · four"]], answer: "五", words: ["三", "二", "五"] }
];

export function mountSchool(root) {
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted = "true";
  let questionIndex = 0, selectedAnswer = null, foodNpcStep = 0, collectionFilter = "week", activeCultureSpot = "pho", activeNpcQuest = "greeting", huntStarted = false, foodTimerId = null, foodTimeLeft = 45, foodRoundIndex = 0, foodRoundScore = 0, foodRoundActive = false, classExamIndex = 0, classExamCorrect = 0, classExamAnswered = false, classExamActive = false;
  let cultureGameIndex = 0, cultureGameCorrect = 0, gymMachine = "treadmill", restaurantSeated = false, coffeeSeated = false, restaurantMeal = "breakfast", activeDish = "", mathIndex = 0, mathScore = 0, mathAnswered = false;

  function stopFoodClock() { if (foodTimerId) window.clearInterval(foodTimerId); foodTimerId = null; }
  function startFoodClock() {
    if (!foodRoundActive || foodTimerId) return;
    foodTimerId = window.setInterval(() => {
      foodTimeLeft = Math.max(0, foodTimeLeft - 1);
      const clock = root.querySelector("[data-food-clock]"); if (clock) clock.textContent = foodTimeLeft + "s";
      if (foodTimeLeft <= 0) { stopFoodClock(); foodRoundActive = false; const latest = getProfile(); updateProfile({ timedFoodBest: Math.max(latest.timedFoodBest || 0, foodRoundScore), timedFoodLastScore: foodRoundScore }); render("timedfood", { kind: "error", text: "Time’s up! You matched " + foodRoundScore + "/" + FOOD_QUEST.length + " orders. Your score is saved; review your words and try again." }); }
    }, 1000);
  }
  function close() { stopFoodClock(); root.hidden = true; }
  function open(tab) { root.hidden = false; render(tab || "hub"); }
  function render(tab, feedback) {
    tab = tab || "hub";
    if (tab !== "timedfood") stopFoodClock();
    const profile = getProfile();
    const quest = profile.dailyQuest && profile.dailyQuest.date === today() ? Object.assign(emptyQuest(), profile.dailyQuest) : emptyQuest();
    const current = questions[questionIndex % questions.length];
    const titles = { hub: "Welcome to school", classroom: "Chinese classroom", hunt: "Chinese Word Hunt", npcquests: "NPC Conversation Quests", timedfood: "Timed Food Street", foodquest: "Today’s food quest", lesson: "Picture lesson", words: "Weekly word book", talk: "Meet Mei", order: "Order at Food Street", circle: "Study circle", passport: "Discovery passport", culture: "Culture Street", hsk: "HSK 1 course", culturegame: "Culture Memory House", gym: "Worldmates Gym", restaurant: "Shanghai Family Restaurant", math: "Chinese Math House", coffeehouse: "Shanghai Coffee Lab" };
    let content;
    try {
      content = tab === "hub" ? hub(profile, quest, feedback) : tab === "classroom" ? classroom(profile, feedback, classExamActive ? classExamIndex : -1, classExamCorrect, classExamAnswered) : tab === "hunt" ? wordHunt(profile, huntStarted, feedback) : tab === "npcquests" ? npcQuestPanel(profile, activeNpcQuest, feedback) : tab === "timedfood" ? timedFood(profile, foodRoundActive, foodTimeLeft, foodRoundIndex, foodRoundScore, feedback) : tab === "foodquest" ? foodLesson(quest, feedback) : tab === "lesson" ? lesson(current, feedback) : tab === "words" ? collection(profile, collectionFilter) : tab === "talk" ? conversation(profile) : tab === "order" ? foodOrder(quest, feedback, foodNpcStep) : tab === "circle" ? circle() : tab === "passport" ? passport(profile) : tab === "culture" ? cultureActivity(profile, activeCultureSpot, feedback) : tab === "culturegame" ? cultureGame(cultureGameIndex, feedback) : tab === "gym" ? gymPanel(gymMachine, feedback) : tab === "restaurant" ? eateryPanel("restaurant", restaurantSeated, restaurantMeal, activeDish, feedback) : tab === "coffeehouse" ? eateryPanel("coffeehouse", coffeeSeated, restaurantMeal, activeDish, feedback) : tab === "math" ? mathPanel(mathIndex, mathScore, mathAnswered, feedback) : '<div class="school-course-host" id="school-course-host"><p class="school-loading">Opening your HSK course…</p></div>';
    } catch (error) {
      console.error("Unable to open school activity:", error);
      content = '<section class="school-empty" role="alert"><span>📚</span><b>This activity could not be opened</b><p>Please try another school activity, then reopen this one.</p></section>';
    }
    root.innerHTML = '<section class="school-panel" role="dialog" aria-modal="true" aria-labelledby="school-title"><header class="school-header"><div><p class="school-kicker">WORLDMATES SCHOOL · CAMPUS LIFE</p><h2 id="school-title">' + safe(titles[tab] || titles.hub) + '</h2><p>Meet classmates, practise languages, and explore cultures through everyday school life.</p></div><button type="button" class="school-close" data-school-close aria-label="Close school">×</button></header><nav class="school-tabs" aria-label="School activities"><button data-school-tab="hub" class="' + (tab === "hub" ? "selected" : "") + '">Campus</button><button data-school-tab="classroom" class="' + (tab === "classroom" ? "selected" : "") + '">Chinese class</button><button data-school-tab="hunt" class="' + (tab === "hunt" ? "selected" : "") + '">Word Hunt</button><button data-school-tab="npcquests" class="' + (tab === "npcquests" ? "selected" : "") + '">NPC Quests</button><button data-school-tab="timedfood" class="' + (tab === "timedfood" ? "selected" : "") + '">Timed Food</button><button data-school-tab="foodquest" class="' + (tab === "foodquest" ? "selected" : "") + '">Daily quest</button><button data-school-tab="lesson" class="' + (tab === "lesson" ? "selected" : "") + '">Quick lesson</button><button data-school-tab="words" class="' + (tab === "words" ? "selected" : "") + '">Word book</button><button data-school-tab="culture" class="' + (tab === "culture" ? "selected" : "") + '">Culture Street</button><button data-school-tab="passport" class="' + (tab === "passport" ? "selected" : "") + '">Passport</button><button data-school-tab="circle" class="' + (tab === "circle" ? "selected" : "") + '">Study circle</button><button data-school-tab="hsk" class="' + (tab === "hsk" ? "selected" : "") + '">Full HSK 1</button></nav><div class="school-content" id="school-content">' + content + '</div></section>';
    root.querySelector("[data-school-close]").addEventListener("click", close);
    if (tab === "hub") root.querySelector("#school-content")?.insertAdjacentHTML("beforeend", badgeCollection(profile) + '<section class="new-world-activities"><p class="school-kicker">FIVE NEW WALK-IN PLACES</p><div class="new-world-activity-grid"><button data-world-place="culture-house"><span>🍎</span><b>Culture Memory House</b><small>Walk there · picture guessing</small></button><button data-world-place="gym"><span>🏋️</span><b>Worldmates Gym</b><small>Walk there · eight machines</small></button><button data-world-place="restaurant"><span>🍜</span><b>Shanghai Restaurant</b><small>Walk there · meals in Chinese</small></button><button data-world-place="math-house"><span>➕</span><b>Chinese Math House</b><small>Walk there · Teacher Wang</small></button><button data-world-place="coffee-house"><span>☕</span><b>Shanghai Coffee Lab</b><small>Walk there · café Chinese</small></button></div></section>');
    root.querySelector("[data-class-register]")?.addEventListener("submit", event => {
      event.preventDefault();
      const studentName = String(new FormData(event.currentTarget).get("studentName") || "").trim().slice(0, 24);
      if (studentName.length < 2) { render("classroom", { kind: "error", text: "Please enter a student name with at least 2 characters." }); return; }
      const fresh = getProfile();
      updateProfile({ name: studentName, classroomEnrollment: { studentName, course: "Beginner Mandarin · Class 1", registeredAt: fresh.classroomEnrollment?.registeredAt || new Date().toISOString() } });
      render("classroom", { kind: "success", text: "You’re registered for Beginner Mandarin · Class 1. Your class card is saved with your player profile." });
    });
    root.querySelector("[data-class-lesson-complete]")?.addEventListener("click", () => {
      const fresh = getProfile(); if (!fresh.classroomEnrollment) return render("classroom", { kind: "error", text: "Register for class first to save this lesson." });
      if (fresh.classroomLessonComplete) return render("classroom", { kind: "success", text: "Lesson already completed. You can take the exam or review the list again." });
      CLASS_WORDS.forEach(addWord);
      updateProfile({ classroomLessonComplete: true, lessons: fresh.lessons + 1, xp: fresh.xp + 20, coins: fresh.coins + 5 });
      render("classroom", { kind: "success", text: "Lesson complete! The 8 words were added to your word book · +20 XP · +5 coins." });
    });
    root.querySelectorAll("[data-class-speak]").forEach(button => button.addEventListener("click", () => speak(button.dataset.classSpeak)));
    root.querySelector("[data-class-start-exam]")?.addEventListener("click", () => { classExamActive = true; classExamIndex = 0; classExamCorrect = 0; classExamAnswered = false; render("classroom"); });
    root.querySelector("[data-class-exam-answers]")?.addEventListener("click", event => {
      const answer = event.target.closest("[data-class-exam-answer]"); if (!answer || classExamAnswered) return;
      classExamAnswered = true;
      if (answer.dataset.classExamAnswer === CLASS_EXAM[classExamIndex].answer) classExamCorrect++;
      render("classroom", { kind: answer.dataset.classExamAnswer === CLASS_EXAM[classExamIndex].answer ? "success" : "error", text: answer.dataset.classExamAnswer === CLASS_EXAM[classExamIndex].answer ? "Correct — nice work!" : "Not quite. The correct answer is " + CLASS_EXAM[classExamIndex].answer + "." });
    });
    root.querySelector("[data-class-exam-next]")?.addEventListener("click", () => {
      if (!classExamAnswered) return;
      if (classExamIndex + 1 < CLASS_EXAM.length) { classExamIndex++; classExamAnswered = false; render("classroom"); return; }
      const fresh = getProfile(), score = Math.round(classExamCorrect / CLASS_EXAM.length * 100), exam = { date: today(), score, correct: classExamCorrect, total: CLASS_EXAM.length, passed: score >= 70 };
      const classroomExamHistory = [...(fresh.classroomExamHistory || []), exam].slice(-20);
      updateProfile({ classroomExamHistory, xp: fresh.xp + 10, coins: fresh.coins + 3, achievements: exam.passed && !fresh.achievements.includes("class-pass-1") ? [...fresh.achievements, "class-pass-1"] : fresh.achievements });
      classExamAnswered = false; classExamActive = false;
      render("classroom", { kind: score >= 70 ? "success" : "info", text: "Exam saved: " + classExamCorrect + "/" + CLASS_EXAM.length + " correct · " + score + "%. " + (score >= 70 ? "You passed this class exam!" : "Review the lesson list and try again.") + " · +10 XP · +3 coins." });
    });
    root.querySelector("[data-hunt-start]")?.addEventListener("click", () => { huntStarted = true; render("hunt"); const next = WORD_HUNT.find(item => !(getProfile().wordHuntFound || []).includes(item.id)); if (next) speak(next.hanzi); });
    root.querySelector("[data-hunt-speak]")?.addEventListener("click", event => speak(event.currentTarget.dataset.huntSpeak));
    root.querySelectorAll("[data-npc-quest]").forEach(button => button.addEventListener("click", () => { activeNpcQuest = button.dataset.npcQuest; render("npcquests"); }));
    root.querySelector("[data-npc-reply]")?.addEventListener("click", event => {
      const answer = event.target.closest("[data-npc-answer]"); if (!answer) return;
      const quest = NPC_QUESTS.find(item => item.id === activeNpcQuest); if (!quest) return;
      const reply = quest.replies[Number(answer.dataset.npcAnswer)]; if (!reply) return;
      if (!reply.correct) { render("npcquests", { kind: "error", text: quest.hint + " Try another Chinese reply." }); return; }
      const key = "npcquest:" + quest.id + ":" + today(), achievement = "npc-quest:" + quest.id;
      reply.words.forEach(addWord);
      const latest = getProfile(), already = Boolean(latest.npcRewards[key]);
      const npcRewards = { ...latest.npcRewards, [key]: true };
      updateProfile({ npcRewards, achievements: latest.achievements.includes(achievement) ? latest.achievements : [...latest.achievements, achievement], xp: latest.xp + (already ? 0 : 8), coins: latest.coins + (already ? 0 : 2) });
      render("npcquests", { kind: "success", text: reply.text + " · " + reply.pinyin + " means “" + reply.meaning + "”. " + (already ? "Quest complete; today’s reward was already collected." : "Quest complete · +8 XP · +2 coins. Words added to your book.") });
    });
    root.querySelector("[data-food-challenge-start]")?.addEventListener("click", () => {
      foodRoundIndex = 0; foodRoundScore = 0; foodTimeLeft = 45; foodRoundActive = true; render("timedfood");
      const first = FOOD_QUEST[0]; speak((first.hanzi === "茶" ? "我想喝" : "我想吃") + first.hanzi + "。");
    });
    root.querySelector("[data-food-challenge-speak]")?.addEventListener("click", event => speak(event.currentTarget.dataset.foodChallengeSpeak));
    root.querySelector("[data-timed-food-answer]")?.addEventListener("click", event => {
      const answer = event.target.closest("[data-timed-food-choice]"); if (!answer || !foodRoundActive) return;
      const item = FOOD_QUEST[foodRoundIndex]; if (!item) return;
      if (answer.dataset.timedFoodChoice !== item.hanzi) { render("timedfood", { kind: "error", text: "Not that order. Listen again and choose the matching dish. The clock is still running." }); return; }
      foodRoundScore++;
      addWord(item.hanzi); recordDailyFoodWord(item.hanzi);
      foodRoundIndex++;
      if (foodRoundIndex >= FOOD_QUEST.length) {
        stopFoodClock(); foodRoundActive = false;
        const latest = getProfile(), eligible = latest.timedFoodRewardDate !== today(), badge = "timed-food-street";
        updateProfile({ timedFoodBest: Math.max(latest.timedFoodBest || 0, foodRoundScore), timedFoodLastScore: foodRoundScore, timedFoodRewardDate: eligible ? today() : latest.timedFoodRewardDate, achievements: latest.achievements.includes(badge) ? latest.achievements : [...latest.achievements, badge], xp: latest.xp + (eligible ? 20 : 0), coins: latest.coins + (eligible ? 8 : 0) });
        render("timedfood", { kind: "success", text: "All 5 orders matched! " + (eligible ? "Daily reward: +20 XP · +8 coins · Timed Food badge." : "You already collected today’s timed-food reward. Best score saved.") });
        return;
      }
      const next = FOOD_QUEST[foodRoundIndex]; speak((next.hanzi === "茶" ? "我想喝" : "我想吃") + next.hanzi + "。");
      render("timedfood", { kind: "success", text: "Order served! " + foodRoundScore + "/" + FOOD_QUEST.length + " matched. Next order…" });
    });
    root.querySelector("[data-school-wordhunt-spot]")?.addEventListener("click", event => resolveWordHuntSpot(event.currentTarget.dataset.schoolWordhuntSpot));
    root.querySelector("[data-school-answer]")?.addEventListener("click", event => {
      const button = event.target.closest("[data-answer]"); if (!button || selectedAnswer !== null) return;
      selectedAnswer = button.dataset.answer;
      const correct = selectedAnswer === current.answer;
      rewardStudyAnswer(correct);
      if (correct) addWord(current.answer);
      const text = correct ? "Correct! " + current.answer + " means “" + current.meaning + "”. " + (words.get(current.answer)?.pinyin || "") + " has been added to your collection." : "Almost! The answer is " + current.answer + " (" + (words.get(current.answer)?.pinyin || "") + "), meaning “" + current.meaning + "”.";
      render("lesson", { kind: correct ? "success" : "error", text });
    });
    root.querySelector("[data-next-question]")?.addEventListener("click", () => { questionIndex++; selectedAnswer = null; render("lesson"); });
    root.querySelector("[data-culture-answer]")?.addEventListener("click", event => {
      const button = event.target.closest("[data-culture-choice]"); if (!button) return;
      const spot = CULTURE_STOPS.find(item => item.id === activeCultureSpot); if (!spot) return;
      if (button.dataset.cultureChoice !== "true") { render("culture", { kind: "error", text: "Not quite. Read the cultural note and try again." }); return; }
      const latest = getProfile(), achievement = "culture:" + spot.id;
      if (!latest.achievements.includes(achievement)) updateProfile({ xp: latest.xp + 12, coins: latest.coins + 4, achievements: [...latest.achievements, achievement] });
      render("culture", { kind: "success", text: latest.achievements.includes(achievement) ? "You already saved this culture card." : "Culture card saved to your Discovery Passport · +12 XP · +4 coins." });
    });
    root.querySelector("[data-food-answer]")?.addEventListener("click", event => {
      const button = event.target.closest("[data-food-choice]"); if (!button) return;
      const item = FOOD_QUEST.find(word => word.hanzi === button.dataset.foodQuestion); if (!item) return;
      const correct = button.dataset.foodChoice === item.hanzi;
      rewardStudyAnswer(correct);
      if (!correct) { render("foodquest", { kind: "error", text: "Almost! " + item.hanzi + " (" + words.get(item.hanzi).pinyin + ") means “" + words.get(item.hanzi).meaning + "”. Try again." }); return; }
      addWord(item.hanzi);
      recordDailyFoodWord(item.hanzi);
      render("foodquest", { kind: "success", text: "Lovely! " + item.hanzi + " · " + words.get(item.hanzi).pinyin + " means “" + words.get(item.hanzi).meaning + "”." });
    });
    root.querySelector("[data-food-continue]")?.addEventListener("click", () => render("foodquest"));
    root.querySelector("[data-food-speak]")?.addEventListener("click", event => speak(event.currentTarget.dataset.foodSpeak));
    root.querySelector("[data-find-food]")?.addEventListener("click", () => { close(); window.dispatchEvent(new CustomEvent("world:find-food")); });
    root.querySelector("[data-food-reply]")?.addEventListener("click", event => {
      const choice = event.target.closest("[data-food-choice-reply]"); if (!choice) return;
      const expected = foodNpcStep === 0 ? "meal" : "drink";
      if (choice.dataset.foodChoiceReply !== expected) {
        render("order", { kind: "error", text: foodNpcStep === 0 ? "Lin is asking what you want to eat. Try a food order." : "Lin is asking what you would like to drink. Try ordering tea." });
      } else if (foodNpcStep === 0) {
        foodNpcStep = 1;
        render("order", { kind: "success", text: "老板：好！包子马上来。还想喝点什么？ (Great! Your bun is coming. What would you like to drink?)" });
      } else {
        const rewarded = completeDailyFoodOrder();
        foodNpcStep = 0;
        render("order", { kind: "success", text: rewarded ? "太好了！Today’s quest is complete: +45 XP, +18 coins, and the 🍜 Food Street badge!" : "Your order is complete. Come back tomorrow for a new food quest!" });
      }
    });
    root.querySelector("[data-use-rest-day]")?.addEventListener("click", () => { const result = useRestDay(); render("hub", { kind: result.ok ? "success" : "info", text: result.message }); });
    root.querySelectorAll("[data-book-filter]").forEach(button => button.addEventListener("click", () => { collectionFilter = button.dataset.bookFilter; render("words"); }));
    root.querySelector("[data-mei-answer]")?.addEventListener("click", event => {
      const choice = event.target.closest("[data-mei-choice]"); if (!choice) return;
      const right = choice.dataset.meiChoice === "茶", id = "mei:" + today();
      const fresh = getProfile();
      if (right && !fresh.npcRewards[id]) { updateProfile({ xp: fresh.xp + 5, coins: fresh.coins + 1, npcRewards: Object.assign({}, fresh.npcRewards, { [id]: true }) }); addWord("茶"); }
      render("talk", { kind: right ? "success" : "info", text: right ? "Mei smiles: “好！茶很好喝。” You earned +5 XP and +1 coin today." : "Mei says: “我想喝茶。” means ‘I would like tea.’ Try that answer!" });
    });
    root.querySelector("[data-start-circle]")?.addEventListener("click", () => { questionIndex = 0; selectedAnswer = null; render("lesson"); });
    root.querySelector("[data-school-course-retry]")?.addEventListener("click", () => window.dispatchEvent(new CustomEvent("lantern:school-course")));
    root.querySelector("[data-culture-game-answer]")?.addEventListener("click", event => {
      const choice = event.target.closest("[data-culture-word]"); if (!choice) return;
      const word = CULTURE_GAME_WORDS[cultureGameIndex % CULTURE_GAME_WORDS.length];
      if (choice.dataset.cultureWord !== word.hanzi) { render("culturegame", { kind: "error", text: "Not quite. Look at the picture and clue, then try another word." }); return; }
      cultureGameCorrect++;
      const fresh = getProfile(), found = fresh.cultureMemoryFound || [], firstTime = !found.includes(word.hanzi);
      addLearnedWord({ hanzi: word.hanzi, pinyin: word.pinyin, meaning: word.meaning, learnedAt: today() });
      updateProfile({ cultureMemoryFound: firstTime ? [...found, word.hanzi] : found, xp: fresh.xp + (firstTime ? 4 : 0), coins: fresh.coins + (firstTime ? 1 : 0) });
      const nextIndex = (cultureGameIndex + 1) % CULTURE_GAME_WORDS.length; cultureGameIndex = nextIndex;
      speak(word.hanzi);
      render("culturegame", { kind: "success", text: `Correct! ${word.hanzi} · ${word.pinyin} means “${word.meaning}”. ${firstTime ? "+4 XP · +1 coin; saved to your word book." : "Already in your word book."}` });
    });
    root.querySelector("[data-culture-game-speak]")?.addEventListener("click", () => speak(CULTURE_GAME_WORDS[cultureGameIndex % CULTURE_GAME_WORDS.length].hanzi));
    root.querySelectorAll("[data-gym-machine]").forEach(button => button.addEventListener("click", () => { gymMachine = button.dataset.gymMachine; render("gym"); }));
    root.querySelector("[data-gym-demo]")?.addEventListener("click", () => window.dispatchEvent(new CustomEvent("world:avatar-emote", { detail: { animation: "Exercise" } })));
    root.querySelector("[data-restaurant-seat]")?.addEventListener("click", () => { restaurantSeated = true; window.dispatchEvent(new CustomEvent("world:sit-seat")); render("restaurant", { kind: "success", text: "You’re seated. The waitress is ready with the menu." }); });
    root.querySelector("[data-coffee-seat]")?.addEventListener("click", () => { coffeeSeated = true; window.dispatchEvent(new CustomEvent("world:sit-seat")); render("coffeehouse", { kind: "success", text: "Take a seat. The barista has the café menu." }); });
    root.querySelectorAll("[data-meal]").forEach(button => button.addEventListener("click", () => { restaurantMeal = button.dataset.meal; activeDish = ""; render(tab); }));
    root.querySelectorAll("[data-menu-dish]").forEach(button => button.addEventListener("click", () => { activeDish = button.dataset.menuDish; const dish = [...RESTAURANT_MENU.breakfast, ...RESTAURANT_MENU.lunch, ...RESTAURANT_MENU.dinner, ...COFFEE_MENU].find(item => item.hanzi === activeDish); if (dish) speak(dish.hanzi); render(tab); }));
    root.querySelector("[data-menu-pronounce]")?.addEventListener("click", () => { const dish = [...RESTAURANT_MENU.breakfast, ...RESTAURANT_MENU.lunch, ...RESTAURANT_MENU.dinner, ...COFFEE_MENU].find(item => item.hanzi === activeDish); if (dish) speak(dish.hanzi); });
    root.querySelector("[data-menu-order]")?.addEventListener("click", () => {
      const isCoffee = tab === "coffeehouse", roomId = isCoffee ? "coffee-house" : "restaurant", dish = [...RESTAURANT_MENU.breakfast, ...RESTAURANT_MENU.lunch, ...RESTAURANT_MENU.dinner, ...COFFEE_MENU].find(item => item.hanzi === activeDish);
      if (!dish) return;
      const fresh = getProfile(), claimed = fresh.socialMealRewards || {}, key = roomId + ":" + today(), firstOrderToday = !claimed[key];
      addLearnedWord({ hanzi: dish.hanzi, pinyin: dish.pinyin, meaning: dish.meaning, learnedAt: today() });
      updateProfile({ socialMealRewards: { ...claimed, [key]: true }, xp: fresh.xp + (firstOrderToday ? 5 : 0), coins: fresh.coins + (firstOrderToday ? 2 : 0) });
      window.dispatchEvent(new CustomEvent("world:serve-order", { detail: { roomId, dish: dish.hanzi } }));
      render(tab, { kind: "success", text: `你点了${dish.hanzi}！ ${dish.pinyin} means “${dish.meaning}”. ${isCoffee ? "The barista is preparing it." : "The waitress is walking over with your order."} ${firstOrderToday ? "+5 XP · +2 coins." : "Daily order reward already collected."}` });
    });
    root.querySelector("[data-math-answers]")?.addEventListener("click", event => {
      const button = event.target.closest("[data-math-answer]"); if (!button || mathAnswered) return;
      const question = MATH_QUESTIONS[mathIndex], correct = button.dataset.mathAnswer === question.answer;
      mathAnswered = true; if (correct) mathScore++;
      render("math", { kind: correct ? "success" : "error", text: correct ? "Correct! " + question.answer + " · " + question.pinyin + "." : `The answer is ${question.answer} · ${question.pinyin}. Keep going!` });
    });
    root.querySelector("[data-math-speak]")?.addEventListener("click", event => speak(event.currentTarget.dataset.mathSpeak));
    root.querySelector("[data-math-next]")?.addEventListener("click", () => {
      if (mathIndex + 1 < MATH_QUESTIONS.length) { mathIndex++; mathAnswered = false; render("math"); return; }
      const fresh = getProfile(), score = Math.round(mathScore / MATH_QUESTIONS.length * 100), reward = fresh.mathHouseRewardDate !== today();
      MATH_QUESTIONS.flatMap(item => item.words).forEach(addWord);
      updateProfile({ mathHouseRewardDate: today(), mathHouseBest: Math.max(fresh.mathHouseBest || 0, score), mathHouseLastScore: score, xp: fresh.xp + (reward ? 12 : 0), coins: fresh.coins + (reward ? 4 : 0) });
      mathIndex = 0; mathScore = 0; mathAnswered = false;
      render("math", { kind: "success", text: `Lesson complete: ${score}% · ${reward ? "+12 XP · +4 coins." : "Daily lesson reward already collected."} Number words were added to your word book.` });
    });
    if (tab === "timedfood" && foodRoundActive) startFoodClock();
  }

  function addWord(hanzi) {
    const bundled = words.get(hanzi) || WORD_HUNT.find(item => item.hanzi === hanzi) || CULTURE_GAME_WORDS.find(item => item.hanzi === hanzi) || [...RESTAURANT_MENU.breakfast, ...RESTAURANT_MENU.lunch, ...RESTAURANT_MENU.dinner, ...COFFEE_MENU].find(item => item.hanzi === hanzi);
    const numberWords = { "一": ["yī", "one"], "二": ["èr", "two"], "三": ["sān", "three"], "四": ["sì", "four"], "五": ["wǔ", "five"], "六": ["liù", "six"], "七": ["qī", "seven"], "八": ["bā", "eight"], "九": ["jiǔ", "nine"], "十": ["shí", "ten"] };
    const entry = bundled || (numberWords[hanzi] ? { hanzi, pinyin: numberWords[hanzi][0], meaning: numberWords[hanzi][1] } : null);
    if (entry) addLearnedWord({ hanzi: entry.hanzi, pinyin: entry.pinyin, meaning: entry.meaning, learnedAt: today() });
  }
  function resolveWordHuntSpot(spotId) {
    if (!huntStarted) { render("hunt", { kind: "info", text: "Start the Word Hunt first to receive your clue." }); return; }
    const profile = getProfile(), found = profile.wordHuntFound || [], target = WORD_HUNT.find(item => !found.includes(item.id));
    if (!target) { render("hunt", { kind: "success", text: "You found every plaza object! Your Word Hunt badge is saved." }); return; }
    if (spotId !== target.id) { render("hunt", { kind: "error", text: "Not this object. " + target.clue + " Listen to the word and look around the plaza, then try another glowing object." }); return; }
    const nextFound = [...found, target.id], achievements = [...profile.achievements, "word-hunt:" + target.id];
    const complete = nextFound.length === WORD_HUNT.length;
    if (complete && !achievements.includes("word-hunt-complete")) achievements.push("word-hunt-complete");
    addWord(target.hanzi);
    const latest = getProfile();
    updateProfile({ wordHuntFound: nextFound, achievements: [...new Set([...latest.achievements, ...achievements])], xp: latest.xp + 12, coins: latest.coins + 3 });
    if (complete) { huntStarted = false; render("hunt", { kind: "success", text: "All five objects found! You earned the Word Hunt badge · +12 XP · +3 coins. Great exploring!" }); }
    else { const next = WORD_HUNT.find(item => !nextFound.includes(item.id)); render("hunt", { kind: "success", text: "Found " + target.object + "! “" + target.hanzi + "” is now in your word book · +12 XP · +3 coins. Next clue: " + next.clue }); }
  }
  root.addEventListener("click", event => {
    const worldPlace = event.target.closest("[data-world-place]");
    if (worldPlace && root.contains(worldPlace)) { const id = worldPlace.dataset.worldPlace; close(); window.dispatchEvent(new CustomEvent("world:map-place", { detail: { id } })); return; }
    const cultureButton = event.target.closest("[data-culture-spot]");
    if (cultureButton && root.contains(cultureButton)) { activeCultureSpot = cultureButton.dataset.cultureSpot; render("culture"); return; }
    const tabButton = event.target.closest("[data-school-tab]");
    if (tabButton && root.contains(tabButton)) {
      const next = tabButton.dataset.schoolTab;
      render(next);
      if (next === "hsk") window.dispatchEvent(new CustomEvent("lantern:school-course"));
      return;
    }
    if (event.target === root) close();
  });
  window.addEventListener("lantern:open-school", event => { foodNpcStep = 0; activeCultureSpot = event.detail?.cultureSpot || activeCultureSpot; gymMachine = event.detail?.machineId || gymMachine; open(event.detail?.tab || "hub"); if (event.detail?.huntSpot) resolveWordHuntSpot(event.detail.huntSpot); });
  window.addEventListener("lantern:school-course-ready", () => {
    const host = root.querySelector("#school-course-host"); if (!host) return;
    const course = document.querySelector("#hsk-course"), practice = document.querySelector("#picture-practice");
    if (course && !host.contains(course)) host.append(course);
    if (practice && !host.contains(practice)) host.append(practice);
  });
  render("hub");
}

function activityFeedback(feedback) { return feedback ? '<p class="school-feedback" role="status">' + safe(feedback.text) + '</p>' : ""; }
function cultureGame(index, feedback) {
  const target = CULTURE_GAME_WORDS[index % CULTURE_GAME_WORDS.length], options = [target, CULTURE_GAME_WORDS[(index + 3) % CULTURE_GAME_WORDS.length], CULTURE_GAME_WORDS[(index + 6) % CULTURE_GAME_WORDS.length], CULTURE_GAME_WORDS[(index + 9) % CULTURE_GAME_WORDS.length]];
  return '<section class="house-activity culture-memory"><p class="school-kicker">PICTURE GUESS · FRUIT & EVERYDAY OBJECTS</p><div class="picture-clue"><span>' + target.emoji + '</span><div><b>What is in the picture?</b><small>Choose the Chinese word for “' + safe(target.meaning) + '”. Listen, then check its pinyin.</small></div><button data-culture-game-speak aria-label="Hear Chinese word">🔊</button></div><div class="house-choice-grid" data-culture-game-answer>' + options.map(item => '<button data-culture-word="' + item.hanzi + '"><span>' + item.emoji + '</span><b lang="zh">' + item.hanzi + '</b></button>').join("") + '</div><p class="house-progress">' + ((getProfile().cultureMemoryFound || []).length) + '/12 words saved · Correct answers add words to your shared profile.</p>' + activityFeedback(feedback) + '</section>';
}
function gymPanel(machineId, feedback) {
  const selected = GYM_MACHINES.find(item => item.id === machineId) || GYM_MACHINES[0];
  return '<section class="house-activity"><p class="school-kicker">BEGINNER GYM · EIGHT STATIONS</p><p class="house-safety">Start gently. The tips are beginner guidance, not medical advice. Stop if something hurts and ask a qualified adult or trainer for help.</p><div class="gym-machine-grid">' + GYM_MACHINES.map(item => '<button data-gym-machine="' + item.id + '" class="' + (item.id === selected.id ? "selected" : "") + '"><span>' + item.emoji + '</span><b>' + safe(item.name) + '</b></button>').join("") + '</div><article class="gym-guide"><span>' + selected.emoji + '</span><div><h3>' + safe(selected.name) + ' · ' + safe(selected.move) + '</h3><p>' + safe(selected.cue) + '</p><button class="primary-btn" data-gym-demo>▶ Watch my avatar demonstrate</button></div></article><p class="house-note">Your avatar plays a short exercise motion. Machine-specific animation clips are not included in the current character asset; follow the written form cue.</p>' + activityFeedback(feedback) + '</section>';
}
function eateryPanel(tab, seated, meal, selectedHanzi, feedback) {
  const coffee = tab === "coffeehouse", menu = coffee ? COFFEE_MENU : RESTAURANT_MENU[meal] || RESTAURANT_MENU.breakfast;
  const selected = [...COFFEE_MENU, ...RESTAURANT_MENU.breakfast, ...RESTAURANT_MENU.lunch, ...RESTAURANT_MENU.dinner].find(item => item.hanzi === selectedHanzi);
  const title = coffee ? "Coffee & tea · 咖啡和茶" : "Breakfast · lunch · dinner · 早饭 午饭 晚饭";
  const mealTabs = coffee ? "" : '<div class="meal-tabs">' + ["breakfast", "lunch", "dinner"].map(item => '<button data-meal="' + item + '" class="' + (meal === item ? "selected" : "") + '">' + ({ breakfast: "Breakfast 早饭", lunch: "Lunch 午饭", dinner: "Dinner 晚饭" })[item] + '</button>').join("") + '</div>';
  const menuContent = seated ? mealTabs + '<p class="house-note">Tap a dish to hear it. Its pinyin and translation will appear before you order.</p><div class="menu-dish-grid">' + menu.map(item => '<button data-menu-dish="' + item.hanzi + '" class="' + (selectedHanzi === item.hanzi ? "selected" : "") + '"><span>' + item.emoji + '</span><b lang="zh">' + item.hanzi + '</b><small>' + safe(item.meaning) + '</small></button>').join("") + '</div>' + (selected ? '<article class="selected-dish"><span>' + selected.emoji + '</span><div><b lang="zh">' + selected.hanzi + '</b><small>' + safe(selected.pinyin) + ' · ' + safe(selected.meaning) + '</small></div><button data-menu-pronounce>🔊 Listen</button><button class="primary-btn" data-menu-order>Place order →</button></article>' : "") : '<div class="seat-first"><span>🪑</span><b>Choose a table first</b><p>Walk to a chair in the room and sit, or tap below to sit at the nearest table. Then the menu opens.</p><button class="primary-btn" data-' + (coffee ? "coffee" : "restaurant") + '-seat>🪑 Sit down and ask for the menu</button></div>';
  return '<section class="house-activity eatery-activity"><p class="school-kicker">' + (coffee ? "SHANGHAI COFFEE LAB · NPC BARISTA" : "SHANGHAI FAMILY RESTAURANT · NPC WAITRESS") + '</p><h3>' + title + '</h3>' + (seated ? '<div class="waitress-note">' + (coffee ? "☕ The barista is ready to take your order." : "👩🏻‍🍳 Your waitress brings the menu to your table.") + '</div>' : "") + menuContent + activityFeedback(feedback) + '</section>';
}
function mathPanel(index, score, answered, feedback) {
  const question = MATH_QUESTIONS[index % MATH_QUESTIONS.length], profile = getProfile();
  return '<section class="house-activity math-activity"><p class="school-kicker">TEACHER WANG · 王老师 · BEGINNER NUMBERS</p><div class="math-teacher"><span>👩🏻‍🏫</span><div><b>老师：Let’s count together!</b><small>Listen to the Chinese numbers, then choose an answer.</small></div><button data-math-speak="' + safe(question.prompt) + '" aria-label="Hear question">🔊</button></div><div class="math-question"><b lang="zh">' + safe(question.prompt) + '</b><span>' + safe(question.pinyin) + '</span><small>' + safe(question.meaning) + '</small></div><div class="house-choice-grid math-choices" data-math-answers>' + question.choices.map(choice => '<button data-math-answer="' + choice[0] + '" ' + (answered ? "disabled" : "") + '><b lang="zh">' + choice[0] + '</b><small>' + safe(choice[1]) + '</small></button>').join("") + '</div><p class="house-progress">Question ' + (index + 1) + '/5 · Score ' + score + ' · Best ' + (profile.mathHouseBest || 0) + '%</p>' + (answered ? '<button class="primary-btn" data-math-next>' + (index + 1 < MATH_QUESTIONS.length ? "Next question →" : "Finish lesson and save score →") + '</button>' : "") + activityFeedback(feedback) + '</section>';
}

function hub(profile, quest, feedback) {
  const currentWeek = weekKey(today()), weeklyCount = profile.wordCollection.filter(word => weekKey(word.learnedAt) === currentWeek).length;
  const studied = quest.studiedWords.length, ready = studied === FOOD_QUEST.length, streak = profile.currentStudyStreak || 0;
  const nextReward = [3, 7, 14, 30].find(value => value > streak) || 30, restUsed = profile.restDayUsedWeek === currentWeek;
  const canRest = profile.restDayCredits > 0 && !restUsed && profile.lastStudyDate !== today() && streak > 0;
  const restStatus = restUsed ? "This week’s rest day is used. Your current study run is protected through tomorrow." : "A rest day protects your current run for one missed day. Earn another credit every 7 study days.";
  const discovered = (profile.achievements || []).filter(id => id.startsWith("visit:")).length;
  return '<div class="school-welcome"><div><span class="school-emoji">🏫</span><h3>Your campus is ready</h3><p>Study Chinese with Teacher Lin, then take a scored exam. Explore the plaza for words, conversations, and food challenges.</p><button class="school-next" data-school-tab="classroom">Go to Chinese class →</button></div><aside class="school-quest"><b>🥟 TODAY’S PLAZA QUEST · FOOD STREET</b><strong>' + (quest.orderComplete ? "Quest complete!" : studied + "/5 food words learned") + '</strong><div class="quest-track"><i style="width:' + (quest.orderComplete ? 100 : studied / FOOD_QUEST.length * 100) + '%"></i></div><small>' + (quest.orderComplete ? "Rewards collected: +45 XP · +18 coins · 🍜 name badge" : ready ? "Take your words to Food Street and finish the Chinese order." : "Learn 包子, 茶, 鸡蛋, 米饭, and 苹果. Then order from Lin.") + '</small><button class="school-next" data-school-tab="foodquest">' + (quest.orderComplete ? "Review food quest" : "Start food quest") + ' →</button></aside></div>' + (feedback ? '<p class="school-feedback" role="status">' + safe(feedback.text) + '</p>' : "") + '<div class="school-activity-grid"><button data-school-tab="classroom"><span>👩‍🏫</span><b>Chinese classroom</b><small>Register, study the teacher’s list, take an exam, save your score</small></button><button data-school-tab="hunt"><span>🔎</span><b>Chinese Word Hunt</b><small>Walk around, hear words, find matching plaza objects</small></button><button data-school-tab="npcquests"><span>💬</span><b>NPC conversations</b><small>Greet, give directions, and order food in Chinese</small></button><button data-school-tab="timedfood"><span>🥡</span><b>Timed Food Street</b><small>Listen to food orders and beat the 45-second timer</small></button><button data-school-tab="foodquest"><span>🥟</span><b>Daily food quest</b><small>Five picture words and a real plaza NPC activity</small></button><button data-school-tab="culture"><span>🌏</span><b>Culture Street</b><small>Vietnamese, Japanese, and Shanghai food stories</small></button><button data-school-tab="passport"><span>🗺️</span><b>Discovery passport</b><small>' + discovered + '/12 places explored · earn a stamp at each first visit</small></button><button data-school-tab="words"><span>📚</span><b>Weekly word book</b><small>' + weeklyCount + ' new words collected this week</small></button><button data-school-tab="hsk"><span>🎓</span><b>Full HSK 1 course</b><small>300 words, grammar, assessments, certificate</small></button></div><div class="school-campus-note"><b>🗺️ Learn to unlock plaza areas</b><span>Garden Hall opens at 5 learned words; Food Street opens at 5; Friendship Pavilion opens at 10. New game words join your word book and unlock areas.</span></div><div class="school-campus-note school-streak-note"><b>🔥 Current study run: ' + streak + ' day' + (streak === 1 ? "" : "s") + ' · best ' + (profile.bestStudyStreak || 0) + '</b><span>' + (streak >= 30 ? "30-day reward earned!" : (nextReward - streak) + ' more study day' + (nextReward - streak === 1 ? "" : "s") + " to your next XP and coin reward.") + ' Total study days (' + profile.studyStreak + ') are saved permanently.</span><button class="school-next" data-use-rest-day ' + (canRest ? "" : "disabled") + '>🌿 Use a rest day · ' + (profile.restDayCredits || 0) + ' credit' + (profile.restDayCredits === 1 ? "" : "s") + '</button><small>' + restStatus + '</small></div><div class="school-campus-note school-friend-note"><b>🤝 Friend challenges</b><span>Coming after shared multiplayer rooms are connected. No fake online classmates are shown.</span></div>';
}

function badgeCollection(profile) {
  const labels = { "word-hunt-complete": ["🏮", "Plaza Word Hunter"], "timed-food-street": ["🥡", "Quick Order Champion"], "npc-quest:greeting": ["👋", "Friendly Greeting"], "npc-quest:directions": ["🧭", "Helpful Guide"], "npc-quest:order": ["🥟", "Food Street Regular"], "food-street-pin": ["🍜", "Food Street Quest"], "class-pass-1": ["🎓", "Class Exam Pass"] };
  const earned = (profile.achievements || []).filter(id => labels[id]);
  return '<section class="school-campus-note school-badges"><b>🏅 Your Worldmates badges</b>' + (earned.length ? '<div>' + earned.map(id => '<span>' + labels[id][0] + ' ' + safe(labels[id][1]) + '</span>').join("") + '</div>' : '<span>Finish a plaza activity or class exam to earn your first badge.</span>') + '</section>';
}

function classroom(profile, feedback, examIndex, correctCount, answered) {
  const enrollment = profile.classroomEnrollment;
  const history = profile.classroomExamHistory || [];
  const latest = history.at(-1);
  const message = feedback ? '<p class="school-feedback ' + (feedback.kind === "error" ? "food-feedback-error" : "") + '" role="status">' + safe(feedback.text) + '</p>' : "";
  if (!enrollment) return '<section class="classroom-card"><div class="teacher-banner"><span class="teacher-avatar">林</span><div><small>YOUR CHINESE TEACHER</small><h3>Teacher Lin · 林老师</h3><p>Welcome! Register for Beginner Mandarin · Class 1, then study a short lesson and take your first exam.</p></div></div>' + message + '<form class="class-register" data-class-register><label>Student name<input name="studentName" maxlength="24" minlength="2" value="' + safe(profile.name) + '" required autocomplete="nickname" /></label><div class="class-course-label"><span>📘</span><span><b>Beginner Mandarin · Class 1</b><small>Greetings and school words · 8 word lesson · 8-question exam</small></span></div><button class="school-next" type="submit">Register for class →</button></form><p class="classroom-local-note">Your enrollment and marks save to this player profile. To carry them to another device, sign in to your Worldmates account. This is a practice class, not an accredited school record.</p></section>';
  if (examIndex >= 0 && examIndex < CLASS_EXAM.length) {
    const q = CLASS_EXAM[examIndex];
    return '<section class="classroom-card"><div class="teacher-banner"><span class="teacher-avatar">林</span><div><small>TEACHER LIN · CLASS EXAM</small><h3>' + safe(enrollment.studentName) + ' · ' + safe(enrollment.course) + '</h3><p>Question ' + (examIndex + 1) + ' of ' + CLASS_EXAM.length + ' · Choose one answer.</p></div></div>' + message + '<article class="class-exam-question"><small>QUESTION ' + String(examIndex + 1).padStart(2, "0") + ' / ' + CLASS_EXAM.length + '</small><h4>' + safe(q.prompt) + '</h4><div class="class-exam-answers" data-class-exam-answers>' + q.choices.map(choice => '<button type="button" data-class-exam-answer="' + safe(choice) + '" ' + (answered ? 'disabled class="answered"' : "") + '>' + safe(choice) + '</button>').join("") + '</div></article>' + (answered ? '<button class="school-next" data-class-exam-next>' + (examIndex + 1 === CLASS_EXAM.length ? "Finish exam and save score" : "Next question →") + '</button>' : "") + '<p class="classroom-local-note">Your answers and score are saved to your student profile when you finish.</p></section>';
  }
  return '<section class="classroom-card"><div class="teacher-banner"><span class="teacher-avatar">林</span><div><small>YOUR CHINESE TEACHER</small><h3>Teacher Lin · 林老师</h3><p>Class: ' + safe(enrollment.course) + ' · Student: ' + safe(enrollment.studentName) + '</p></div></div>' + message + '<div class="classroom-steps"><article><span>01</span><div><b>Study today’s word list</b><small>Say each word aloud, then mark the lesson complete.</small></div></article><article><span>02</span><div><b>Take the class exam</b><small>8 questions · score out of 100 · 70% to pass</small></div></article><article><span>03</span><div><b>Check your report card</b><small>Your score and date are saved with your profile.</small></div></article></div><h4 class="class-word-heading">📖 Lesson 1 · Greetings & School</h4><div class="class-word-list">' + CLASS_WORDS.map(hanzi => { const w = words.get(hanzi); return '<article><b lang="zh">' + safe(hanzi) + '</b><span>' + safe(w?.pinyin || "") + '</span><small>' + safe(w?.meaning || "") + '</small><button type="button" data-class-speak="' + safe(hanzi) + '" aria-label="Listen to ' + safe(hanzi) + '">🔊</button></article>'; }).join("") + '</div><button class="school-next" data-class-lesson-complete ' + (profile.classroomLessonComplete ? "disabled" : "") + '>' + (profile.classroomLessonComplete ? "Lesson studied ✓ · +20 XP earned" : "I studied this list · finish lesson") + '</button><button class="class-exam-start" data-class-start-exam ' + (profile.classroomLessonComplete ? "" : "disabled") + '>📝 Start class exam →</button>' + (latest ? '<div class="class-report"><div><small>LAST EXAM · ' + safe(latest.date) + '</small><strong>' + latest.score + '%</strong><span>' + latest.correct + '/' + latest.total + ' correct · ' + (latest.passed ? "PASSED ✓" : "Review and retry") + '</span></div><div><b>Your exam history</b>' + history.slice().reverse().map((exam, index) => '<p>Attempt ' + (history.length - index) + ' · ' + exam.score + '% · ' + safe(exam.date) + ' · ' + (exam.passed ? "Pass" : "Try again") + '</p>').join("") + '</div></div>' : '<p class="classroom-local-note">No exam mark yet. Complete the lesson to unlock the exam.</p>') + '<p class="classroom-local-note">Class registration and scores belong to this player profile. Sign in to sync them to your account. These are game learning results, not official school grades or certificates.</p></section>';
}

function wordHunt(profile, started, feedback) {
  const found = profile.wordHuntFound || [];
  const target = WORD_HUNT.find(item => !found.includes(item.id));
  const message = feedback ? '<p class="school-feedback ' + (feedback.kind === "error" ? "food-feedback-error" : "") + '" role="status">' + safe(feedback.text) + '</p>' : "";
  if (!target) return '<section class="hunt-card"><div class="hunt-header"><span>🏮</span><div><small>PLAZA WORD HUNT · COMPLETE</small><h3>Every object found!</h3><p>Five Chinese words were added to your word book.</p></div></div>' + message + '<div class="hunt-progress">' + WORD_HUNT.map(item => '<span class="found">✓ ' + safe(item.object) + ' · ' + safe(item.hanzi) + '</span>').join("") + '</div><p class="classroom-local-note">Your Word Hunt badge and rewards are saved in your shared player profile.</p></section>';
  if (!started) return '<section class="hunt-card"><div class="hunt-header"><span>🔎</span><div><small>EXPLORE THE WORLDMATES PLAZA</small><h3>Find the Chinese words</h3><p>Hear each word, read the clue, then walk to the matching 3D object and press <b>E</b> or tap Explore.</p></div></div>' + message + '<div class="hunt-progress">' + WORD_HUNT.map(item => '<span class="' + (found.includes(item.id) ? "found" : "") + '">' + (found.includes(item.id) ? "✓" : "○") + ' ' + safe(item.object) + '</span>').join("") + '</div><button class="school-next" data-hunt-start>Start / continue hunt →</button><p class="classroom-local-note">Found objects stay saved between visits. Each new object adds its word, XP, and coins to your player profile.</p></section>';
  return '<section class="hunt-card"><div class="hunt-score-row"><span>Found ' + found.length + ' / ' + WORD_HUNT.length + '</span><span class="hunt-next-clue">CLUE ' + (found.length + 1) + ' OF ' + WORD_HUNT.length + '</span></div><div class="quest-track"><i style="width:' + found.length / WORD_HUNT.length * 100 + '%"></i></div>' + message + '<div class="hunt-current"><span class="hunt-object-icon">' + target.emoji + '</span><div><small>CHINESE OBJECT WORD</small><h3 lang="zh">' + safe(target.hanzi) + '</h3><p>' + safe(target.pinyin) + ' · ' + safe(target.meaning) + '</p><button class="food-speak" type="button" data-hunt-speak="' + safe(target.hanzi) + '">🔊 Hear the word</button></div></div><div class="hunt-clue"><b>Your clue</b><p>' + safe(target.clue) + '</p><small>Find the matching 3D object in the plaza, approach its glowing marker, and press E / Explore.</small></div><div class="hunt-progress">' + WORD_HUNT.map(item => '<span class="' + (found.includes(item.id) ? "found" : item.id === target.id ? "current" : "") + '">' + (found.includes(item.id) ? "✓" : item.emoji) + ' ' + safe(item.object) + '</span>').join("") + '</div><p class="classroom-local-note">Wrong objects give you a hint; you can keep exploring and retry. Each found word earns +12 XP and +3 coins.</p></section>';
}

function npcQuestPanel(profile, activeId, feedback) {
  const quest = NPC_QUESTS.find(item => item.id === activeId) || NPC_QUESTS[0];
  const done = new Set(profile.achievements || []), rewardClaimed = Boolean(profile.npcRewards?.["npcquest:" + quest.id + ":" + today()]);
  return '<section class="npc-quest-board"><div class="school-section-intro"><p class="school-kicker">SHORT CHINESE CONVERSATIONS · SCRIPTED NPCS</p><h3>Help a classmate or neighbor</h3><p>Pick a situation, read or hear the question, then choose a Chinese reply. A wrong answer gives a clue and lets you try again.</p></div><div class="npc-quest-list">' + NPC_QUESTS.map(item => '<button type="button" data-npc-quest="' + item.id + '" class="' + (item.id === quest.id ? "selected" : "") + '"><span>' + item.avatar + '</span><b>' + item.npc + '</b><small>' + (done.has("npc-quest:" + item.id) ? "✓ COMPLETED" : safe(item.role)) + '</small></button>').join("") + '</div><article class="npc-quest-chat"><span class="npc-badge">SCRIPTED NPC · NOT A REAL PLAYER</span><div class="mei-card"><span class="mei-avatar">' + quest.avatar + '</span><div><b>' + safe(quest.npc) + '</b><small>' + safe(quest.role) + '</small></div></div><div class="chat-bubble"><b lang="zh">' + safe(quest.prompt) + '</b><small>' + safe(quest.translation) + '</small></div><button class="food-speak" type="button" data-hunt-speak="' + safe(quest.prompt.replace(/^[^：]+：/, "")) + '">🔊 Hear the conversation</button>' + (feedback ? '<p class="school-feedback ' + (feedback.kind === "error" ? "food-feedback-error" : "") + '" role="status">' + safe(feedback.text) + '</p>' : '<p class="school-lesson-hint">Choose the reply that fits the situation.</p>') + '<div class="npc-quest-replies" data-npc-reply>' + quest.replies.map((reply, index) => '<button type="button" data-npc-answer="' + index + '"><b lang="zh">' + safe(reply.text) + '</b><small>' + safe(reply.pinyin) + ' · ' + safe(reply.meaning) + '</small></button>').join("") + '</div><p class="npc-honesty">' + (rewardClaimed ? "Today’s reward is collected. You can still practise the dialogue." : "Complete this conversation for +8 XP and +2 coins. Correct words go into your word book.") + '</p></article></section>';
}

function timedFood(profile, active, timeLeft, index, score, feedback) {
  const best = profile.timedFoodBest || 0, previous = profile.timedFoodLastScore;
  if (!active) return '<section class="timed-food-card"><div class="timed-food-head"><span>🥡</span><div><p class="school-kicker">SHANGHAI FOOD STREET · LISTEN & CHOOSE</p><h3>Can you catch all five orders?</h3><p>Listen to a short Chinese food order and tap the matching dish before 45 seconds run out.</p></div></div>' + (feedback ? '<p class="school-feedback ' + (feedback.kind === "error" ? "food-feedback-error" : "") + '" role="status">' + safe(feedback.text) + '</p>' : "") + '<div class="timed-food-stats"><span>🏆 Best: ' + best + '/5</span><span>' + (previous === null || previous === undefined ? "No previous round" : "Last round: " + previous + "/5") + '</span><span>' + (profile.timedFoodRewardDate === today() ? "Daily reward claimed" : "Daily reward available") + '</span></div><button class="school-next" data-food-challenge-start>Start 45-second food round →</button><p class="classroom-local-note">Correct foods enter your word book and daily food quest. Your best score saves to the shared player profile. One reward per day: +20 XP and +8 coins.</p></section>';
  const item = FOOD_QUEST[index], prompt = item.hanzi === "茶" ? "请给我一杯茶。" : "我想吃" + item.hanzi + "。";
  const options = FOOD_QUEST.map((_, offset) => FOOD_QUEST[(index + offset * 2) % FOOD_QUEST.length]);
  return '<section class="timed-food-card"><div class="timed-food-top"><div><p class="school-kicker">TIMED FOOD STREET · ORDER ' + (index + 1) + ' / ' + FOOD_QUEST.length + '</p><h3>Listen for the food</h3></div><strong class="food-countdown" data-food-clock>' + timeLeft + 's</strong></div><div class="quest-track"><i style="width:' + index / FOOD_QUEST.length * 100 + '%"></i></div>' + (feedback ? '<p class="school-feedback ' + (feedback.kind === "error" ? "food-feedback-error" : "") + '" role="status">' + safe(feedback.text) + '</p>' : '<p class="school-lesson-hint">Listen to the order, then choose the matching dish.</p>') + '<button class="food-order-audio" type="button" data-food-challenge-speak="' + safe(prompt) + '">🔊 Replay order <b lang="zh">' + safe(prompt) + '</b></button><div class="timed-food-options" data-timed-food-answer>' + options.map(option => '<button type="button" data-timed-food-choice="' + safe(option.hanzi) + '"><span>' + option.emoji + '</span><b lang="zh">' + safe(option.hanzi) + '</b><small>' + safe(words.get(option.hanzi)?.meaning || "") + '</small></button>').join("") + '</div><p class="classroom-local-note">' + score + ' orders served · ' + timeLeft + ' seconds left. A wrong answer gives you a retry while the clock continues.</p></section>';
}

function passport(profile) {
  const places = [
    ["classroom", "Worldmates School", "学", "Visit the classroom and its HSK learning board."],
    ["library", "Campus Library", "书", "Explore the reading room and collected-word shelves."],
    ["teahouse", "School Tea House", "茶", "Meet Mei and practise a short drink order."],
    ["garden", "Garden Hall", "园", "Open the quiet solo study circle."],
    ["student-house", "Student House", "家", "Find the homework desk and family bookshelf."],
    ["noodle-house", "Shanghai Noodle House", "面", "Order with Lin after learning the daily food words."],
    ["dumpling-tea", "Dumpling & Tea", "饺", "Explore the food shop and tea table."],
    ["coffee", "Shanghai Coffee House", "咖", "Find the café menu and window seats."],
    ["pavilion", "Friendship Pavilion", "友", "Open the scripted study-circle activity."],
    ["street-pho", "Hanoi Phở Stall", "越", "Discover Vietnamese rice-noodle soup."],
    ["street-yatai", "Japanese Festival Yatai", "祭", "Learn about food stalls at local festivals."],
    ["street-xiaolongbao", "Shanghai Soup Dumplings", "沪", "Discover soup-filled xiaolongbao."],
  ];
  const discoveries = new Set(profile.achievements || []);
  const count = places.filter(([id]) => discoveries.has("visit:" + id)).length;
  return '<section class="discovery-passport"><div class="school-section-intro"><p class="school-kicker">YOUR PLAZA EXPLORATION LOG</p><h3>' + count + '/12 places discovered</h3><p>Walk up to a glowing marker and open its activity to add a stamp. First-time discoveries award +5 XP and +1 coin.</p></div><div class="discovery-stamps">' + places.map(([id, name, icon, detail]) => { const found = discoveries.has("visit:" + id); return '<article class="discovery-stamp ' + (found ? "is-found" : "") + '"><span>' + (found ? "✓" : icon) + '</span><div><b>' + safe(name) + '</b><small>' + safe(found ? "Discovered · stamp saved" : detail) + '</small></div><strong>' + (found ? "STAMPED" : "TO FIND") + '</strong></article>'; }).join("") + '</div><p class="npc-honesty">This passport is saved with your player profile on this device. It does not show other players online.</p></section>';
}

function cultureActivity(profile, activeId, feedback) {
  const active = CULTURE_STOPS.find(stop => stop.id === activeId) || CULTURE_STOPS[0];
  const saved = new Set(profile.achievements || []);
  const completed = CULTURE_STOPS.filter(stop => saved.has("culture:" + stop.id)).length;
  const isSaved = saved.has("culture:" + active.id);
  return '<section class="culture-journal"><div class="culture-street-intro"><span>WORLD FOOD & FESTIVAL WALK</span><h3>Three stalls, three everyday stories</h3><p>Each card shares one specific place or food tradition. Read the note, answer a question, and keep its source in your journal.</p><div class="culture-progress"><b>' + completed + ' / 3 cards collected</b><span>' + completed + ' saved to your profile</span></div></div><div class="culture-stop-list">' + CULTURE_STOPS.map(stop => '<button type="button" class="culture-stop ' + (stop.id === active.id ? "selected" : "") + ' ' + (saved.has("culture:" + stop.id) ? "collected" : "") + '" data-culture-spot="' + stop.id + '"><span>' + (saved.has("culture:" + stop.id) ? "✓" : stop.id === "pho" ? "越" : stop.id === "yatai" ? "祭" : "沪") + '</span><b>' + safe(stop.name) + '</b><small>' + (saved.has("culture:" + stop.id) ? "CARD COLLECTED" : safe(stop.tag)) + '</small></button>').join("") + '</div><article class="culture-story"><p class="school-kicker">' + safe(active.tag) + '</p><h4>' + safe(active.name) + '</h4><p>' + safe(active.fact) + '</p><a href="' + safe(active.source) + '" target="_blank" rel="noopener noreferrer">Read the source: ' + safe(active.sourceLabel) + ' ↗</a>' + (isSaved ? '<div class="culture-complete"><b>Culture card collected</b><span>Saved to your Discovery Passport. You can revisit the story any time.</span></div>' : '<div class="culture-question"><b>' + safe(active.question) + '</b><div class="culture-answers" data-culture-answer>' + active.choices.map(([choice, correct]) => '<button type="button" data-culture-choice="' + correct + '">' + safe(choice) + '</button>').join("") + '</div>' + (feedback ? '<p class="school-feedback ' + (feedback.kind === "error" ? "food-feedback-error" : "") + '" role="status">' + safe(feedback.text) + '</p>' : '<p class="school-lesson-hint">Choose an answer to collect this card.</p>') + '</div>') + '</article><p class="culture-source-note">Culture cards use public tourism and city information; individual food and festival traditions vary by region and community.</p></section>';
}

function foodLesson(quest, feedback) {
  const learned = new Set(quest.studiedWords), current = FOOD_QUEST.find(item => !learned.has(item.hanzi)), progress = Math.min(FOOD_QUEST.length, learned.size);
  if (!current) return '<section class="food-quest-card"><div class="food-quest-head"><span>🥟</span><div><p class="school-kicker">DAILY PLAZA QUEST</p><h3>' + (quest.orderComplete ? "You made it!" : "Five food words learned") + '</h3></div></div>' + foodChips(learned) + '<p class="school-feedback">' + (quest.orderComplete ? "Quest complete. Your XP, coins, and Food Street badge are saved." : "Now head to the Shanghai Food Street NPC, order baozi and tea in Chinese, and claim your rewards.") + '</p>' + (quest.orderComplete ? '<div class="school-empty"><span>🏅</span><b>Daily quest complete</b><p>A new food challenge will be ready tomorrow.</p></div>' : '<button class="primary-btn" data-find-food>Walk to Shanghai Food Street <span>→</span></button>') + '<p class="npc-honesty">Your progress saves on this device.</p></section>';
  if (feedback?.kind === "success") return '<section class="food-quest-card"><div class="food-quest-progress"><b>Food words · ' + progress + '/5</b><div class="quest-track"><i style="width:' + progress * 20 + '%"></i></div></div><div class="food-success-mark">✓</div><h3>Word added to your book!</h3><p class="school-feedback">' + safe(feedback.text) + '</p>' + foodChips(learned) + '<button class="primary-btn" data-food-continue>' + (progress === FOOD_QUEST.length ? "Finish the five words" : "Next food word") + ' <span>→</span></button></section>';
  return '<section class="food-quest-card"><div class="food-quest-progress"><b>Food words · ' + progress + '/5</b><div class="quest-track"><i style="width:' + progress * 20 + '%"></i></div></div><div class="food-question-art" style="--question-color:' + safe(current.color) + '"><span>' + current.emoji + '</span></div><div class="food-question-title"><div><p class="school-kicker">PICTURE ' + (progress + 1) + ' OF 5</p><h3>' + safe(current.hint) + '</h3></div><button type="button" class="food-speak" data-food-speak="' + safe(current.hanzi) + '" aria-label="Hear ' + safe(current.hanzi) + ' spoken in Mandarin">🔊 Hear it</button></div>' + (feedback ? '<p class="school-feedback food-feedback-error" role="status">' + safe(feedback.text) + '</p>' : '<p class="school-lesson-hint">Choose the matching Chinese word. Tap Hear it to listen first.</p>') + '<div class="school-answer-grid food-answer-grid" data-food-answer>' + current.choices.map(choice => '<button data-food-choice="' + safe(choice) + '" data-food-question="' + safe(current.hanzi) + '" lang="zh">' + safe(choice) + '<small>' + safe(words.get(choice)?.pinyin || "") + '</small></button>').join("") + '</div><p class="food-prize-note">Complete the words and NPC order for <b>+45 XP, +18 coins, and a Food Street name badge.</b></p></section>';
}

function foodChips(learned) { return '<div class="food-word-chips">' + FOOD_QUEST.map(item => '<span class="' + (learned.has(item.hanzi) ? "is-learned" : "") + '">' + item.emoji + " " + item.hanzi + (learned.has(item.hanzi) ? " ✓" : "") + '</span>').join("") + '</div>'; }

function foodOrder(quest, feedback, step) {
  if (quest.orderComplete) return '<section class="food-order-card"><span class="npc-badge">SHANGHAI FOOD STREET · NPC</span><div class="food-npc-avatar">林</div><h3>Lin’s Noodle Shop</h3><p class="school-feedback">' + safe(feedback?.text || "You completed today’s order. Come back tomorrow for another food quest!") + '</p><div class="food-reward-receipt"><b>Today’s receipt</b><span>🥟 Baozi + 🍵 tea</span><strong>+45 XP · +18 coins · 🍜 Food Street badge</strong></div></section>';
  if (quest.studiedWords.length < 5) return '<section class="food-order-card"><span class="npc-badge">SHANGHAI FOOD STREET · NPC</span><div class="food-npc-avatar">林</div><h3>Meet Lin at the counter</h3><p>Lin is ready to take your order, but first learn all five words from today’s Study Mode quest.</p><div class="quest-track"><i style="width:' + quest.studiedWords.length * 20 + '%"></i></div><p class="school-feedback">' + quest.studiedWords.length + '/5 food words learned today.</p><button class="primary-btn" data-school-tab="foodquest">Study the food words <span>→</span></button></section>';
  const first = step === 0, prompt = first ? "老板：你好！你想吃什么？" : "老板：好！包子马上来。还想喝点什么？", translation = first ? "Hello! What would you like to eat?" : "Your baozi is coming! What would you like to drink?";
  const replies = first ? [["meal", "我想吃包子。", "Wǒ xiǎng chī bāozi · I’d like baozi."], ["drink", "我想喝茶。", "I’d like tea."], ["other", "我喜欢猫。", "I like cats."]] : [["drink", "我想喝茶。", "Wǒ xiǎng hē chá · I’d like tea."], ["meal", "我想吃米饭。", "I’d like rice."], ["other", "再见！", "Goodbye!"]];
  return '<section class="food-order-card"><span class="npc-badge">SCRIPTED NPC · NOT AN ONLINE PLAYER</span><div class="food-npc-header"><div class="food-npc-avatar">林</div><div><b>Lin</b><small>Food Street shopkeeper · NPC</small></div></div><div class="food-npc-speech"><b lang="zh">' + prompt + '</b><span>' + translation + '</span></div>' + (feedback ? '<p class="school-feedback ' + (feedback.kind === "error" ? "food-feedback-error" : "") + '" role="status">' + safe(feedback.text) + '</p>' : '<p class="school-lesson-hint">Tap a Chinese reply to continue the order.</p>') + '<div class="food-replies" data-food-reply>' + replies.map(reply => '<button data-food-choice-reply="' + reply[0] + '"><b lang="zh">' + reply[1] + '</b><small>' + reply[2] + '</small></button>').join("") + '</div><p class="npc-honesty">Two short replies complete the quest. Try again if you choose the wrong line.</p></section>';
}

function lesson(question, feedback) {
  return '<article class="school-lesson"><div class="school-question-art" style="--question-color:' + safe(question.backdrop || "#f4eee3") + '"><span>' + safe(question.emoji || "✦") + '</span></div><p class="school-lesson-hint">' + safe(question.hint || "Choose the Chinese word that matches.") + '</p><div class="school-answer-grid" data-school-answer>' + question.choices.map(choice => '<button data-answer="' + safe(choice) + '">' + safe(choice) + '<small>' + safe(words.get(choice)?.pinyin || "") + '</small></button>').join("") + '</div><p class="school-feedback" role="status">' + safe(feedback?.text || "Choose the matching Chinese word.") + '</p>' + (feedback ? '<button class="school-next" data-next-question>Next question →</button>' : "") + '</article>';
}

function collection(profile, collectionFilter) {
  // Older local saves may contain partial word entries. Keep one malformed
  // record from taking down the entire school panel.
  const savedWords = Array.isArray(profile.wordCollection) ? profile.wordCollection.filter(word => word && typeof word === "object" && typeof word.hanzi === "string") : [];
  const currentWeek = weekKey(today()), weekly = savedWords.filter(word => weekKey(word.learnedAt) === currentWeek), items = collectionFilter === "all" ? savedWords : weekly;
  return '<section class="school-collection"><div class="school-section-intro"><p class="school-kicker">YOUR WEEKLY COLLECTION BOOK</p><h3>' + weekly.length + '/10 words collected this week</h3><p>Words from picture lessons, the food quest, and HSK study are saved with pinyin and meaning.</p></div><div class="wordbook-filters"><button data-book-filter="week" class="' + (collectionFilter === "week" ? "selected" : "") + '">This week · ' + weekly.length + '</button><button data-book-filter="all" class="' + (collectionFilter === "all" ? "selected" : "") + '">All learned · ' + savedWords.length + '</button></div><div class="school-campus-note"><b>🎁 Weekly reward</b><span>' + (profile.weeklyClaimed === currentWeek ? "Collected: +30 XP and +8 coins. Well done!" : "Learn 10 new words this week to earn +30 XP and +8 coins.") + '</span></div>' + (items.length ? '<div class="collected-words">' + items.map(word => '<article><b lang="zh">' + safe(word.hanzi) + '</b><span>' + safe(word.pinyin) + '</span><small>' + safe(word.meaning) + '</small><time>' + safe(word.learnedAt || "Saved") + '</time></article>').join("") + '</div>' : '<div class="school-empty"><span>📖</span><b>This week’s book is waiting</b><p>Study the daily food quest or a quick lesson to add your first words.</p><button data-school-tab="foodquest">Start today’s quest</button></div>') + '</section>';
}

function conversation(profile) {
  const already = Boolean(profile.npcRewards["mei:" + today()]);
  return '<section class="school-conversation"><span class="npc-badge">SCRIPTED CLASSMATE · NOT A PLAYER</span><div class="mei-card"><span class="mei-avatar">梅</span><div><b>Mei</b><small>Your friendly café classmate</small></div></div><div class="chat-bubble">Mei: 你想喝什么？ <small>(What would you like to drink?)</small></div><div class="school-answer-grid" data-mei-answer><button data-mei-choice="茶">茶<small>chá · tea</small></button><button data-mei-choice="书">书<small>shū · book</small></button><button data-mei-choice="狗">狗<small>gǒu · dog</small></button></div><p class="school-feedback" role="status">' + (already ? "You already earned today’s café reply reward." : "Choose a reply in Chinese.") + '</p><p class="npc-honesty">This is a written practice character. Live chat with other learners needs a shared multiplayer server.</p></section>';
}

function circle() {
  return '<section class="school-circle"><span class="npc-badge">SOLO PRACTICE · SCRIPTED CLASSMATES</span><h3>Little study circle</h3><p>Practise with three friendly classmate characters. They are NPCs, not online players.</p><div class="circle-classmates"><span>小安 <small>NPC</small></span><span>明明 <small>NPC</small></span><span>小雨 <small>NPC</small></span></div><button class="primary-btn" data-start-circle>Start a 3-question circle <span>→</span></button><p class="npc-honesty">Real study groups require a shared multiplayer service, which is not connected yet.</p></section>';
}

function speak(text) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN"; utterance.rate = 0.78; window.speechSynthesis.speak(utterance);
}
