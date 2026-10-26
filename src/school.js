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

export function mountSchool(root) {
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted = "true";
  let questionIndex = 0, selectedAnswer = null, foodNpcStep = 0, collectionFilter = "week", activeCultureSpot = "pho";

  function close() { root.hidden = true; }
  function open(tab) { root.hidden = false; render(tab || "hub"); }
  function render(tab, feedback) {
    tab = tab || "hub";
    const profile = getProfile();
    const quest = profile.dailyQuest && profile.dailyQuest.date === today() ? Object.assign(emptyQuest(), profile.dailyQuest) : emptyQuest();
    const current = questions[questionIndex % questions.length];
    const titles = { hub: "Welcome to school", foodquest: "Today’s food quest", lesson: "Picture lesson", words: "Weekly word book", talk: "Meet Mei", order: "Order at Food Street", circle: "Study circle", passport: "Discovery passport", culture: "Culture Street", hsk: "HSK 1 course" };
    let content;
    try {
      content = tab === "hub" ? hub(profile, quest, feedback) : tab === "foodquest" ? foodLesson(quest, feedback) : tab === "lesson" ? lesson(current, feedback) : tab === "words" ? collection(profile, collectionFilter) : tab === "talk" ? conversation(profile) : tab === "order" ? foodOrder(quest, feedback, foodNpcStep) : tab === "circle" ? circle() : tab === "passport" ? passport(profile) : tab === "culture" ? cultureActivity(profile, activeCultureSpot, feedback) : '<div class="school-course-host" id="school-course-host"><p class="school-loading">Opening your HSK course…</p></div>';
    } catch (error) {
      console.error("Unable to open school activity:", error);
      content = '<section class="school-empty" role="alert"><span>📚</span><b>This activity could not be opened</b><p>Please try another school activity, then reopen this one.</p></section>';
    }
    root.innerHTML = '<section class="school-panel" role="dialog" aria-modal="true" aria-labelledby="school-title"><header class="school-header"><div><p class="school-kicker">WORLDMATES SCHOOL · CAMPUS LIFE</p><h2 id="school-title">' + safe(titles[tab] || titles.hub) + '</h2><p>Meet classmates, practise languages, and explore cultures through everyday school life.</p></div><button type="button" class="school-close" data-school-close aria-label="Close school">×</button></header><nav class="school-tabs" aria-label="School activities"><button data-school-tab="hub" class="' + (tab === "hub" ? "selected" : "") + '">Campus</button><button data-school-tab="foodquest" class="' + (tab === "foodquest" ? "selected" : "") + '">Daily quest</button><button data-school-tab="lesson" class="' + (tab === "lesson" ? "selected" : "") + '">Quick lesson</button><button data-school-tab="words" class="' + (tab === "words" ? "selected" : "") + '">Weekly word book</button><button data-school-tab="culture" class="' + (tab === "culture" ? "selected" : "") + '">Culture Street</button><button data-school-tab="passport" class="' + (tab === "passport" ? "selected" : "") + '">Passport</button><button data-school-tab="talk" class="' + (tab === "talk" ? "selected" : "") + '">Talk to Mei</button><button data-school-tab="circle" class="' + (tab === "circle" ? "selected" : "") + '">Study circle</button><button data-school-tab="hsk" class="' + (tab === "hsk" ? "selected" : "") + '">Full HSK 1</button></nav><div class="school-content" id="school-content">' + content + '</div></section>';
    root.querySelector("[data-school-close]").addEventListener("click", close);
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
  }

  function addWord(hanzi) { const entry = words.get(hanzi); if (entry) addLearnedWord(entry); }
  root.addEventListener("click", event => {
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
  window.addEventListener("lantern:open-school", event => { foodNpcStep = 0; activeCultureSpot = event.detail?.cultureSpot || activeCultureSpot; open(event.detail?.tab || "hub"); });
  window.addEventListener("lantern:school-course-ready", () => {
    const host = root.querySelector("#school-course-host"); if (!host) return;
    const course = document.querySelector("#hsk-course"), practice = document.querySelector("#picture-practice");
    if (course && !host.contains(course)) host.append(course);
    if (practice && !host.contains(practice)) host.append(practice);
  });
  render("hub");
}

function hub(profile, quest, feedback) {
  const currentWeek = weekKey(today()), weeklyCount = profile.wordCollection.filter(word => weekKey(word.learnedAt) === currentWeek).length;
  const studied = quest.studiedWords.length, ready = studied === FOOD_QUEST.length, streak = profile.currentStudyStreak || 0;
  const nextReward = [3, 7, 14, 30].find(value => value > streak) || 30, restUsed = profile.restDayUsedWeek === currentWeek;
  const canRest = profile.restDayCredits > 0 && !restUsed && profile.lastStudyDate !== today() && streak > 0;
  const restStatus = restUsed ? "This week’s rest day is used. Your current study run is protected through tomorrow." : "A rest day protects your current run for one missed day. Earn another credit every 7 study days.";
  const discovered = (profile.achievements || []).filter(id => id.startsWith("visit:")).length;
  return '<div class="school-welcome"><div><span class="school-emoji">🏫</span><h3>Your campus is ready</h3><p>Study five food words with pictures and spoken Mandarin, then order at the Shanghai plaza food street.</p><button class="school-next" data-school-tab="foodquest">' + (quest.orderComplete ? "See your completed quest" : ready ? "Find the food street NPC" : "Start today’s quest") + ' →</button></div><aside class="school-quest"><b>🥟 TODAY’S PLAZA QUEST · FOOD STREET</b><strong>' + (quest.orderComplete ? "Quest complete!" : studied + "/5 food words learned") + '</strong><div class="quest-track"><i style="width:' + (quest.orderComplete ? 100 : studied / FOOD_QUEST.length * 100) + '%"></i></div><small>' + (quest.orderComplete ? "Rewards collected: +45 XP · +18 coins · 🍜 name badge" : ready ? "Take your words to Food Street and finish the Chinese order." : "Learn 包子, 茶, 鸡蛋, 米饭, and 苹果. Then order from Lin.") + '</small></aside></div>' + (feedback ? '<p class="school-feedback" role="status">' + safe(feedback.text) + '</p>' : "") + '<div class="school-activity-grid"><button data-school-tab="foodquest"><span>🥟</span><b>Daily food quest</b><small>Five picture words with spoken Mandarin</small></button><button data-school-tab="culture"><span>🌏</span><b>Culture Street</b><small>Vietnamese, Japanese, and Shanghai food stories</small></button><button data-school-tab="passport"><span>🗺️</span><b>Discovery passport</b><small>' + discovered + '/9 places explored · earn a stamp at each first visit</small></button><button data-school-tab="words"><span>📚</span><b>Weekly word book</b><small>' + weeklyCount + ' new words collected this week</small></button><button data-school-tab="talk"><span>🍵</span><b>Talk to Mei</b><small>Choose a Chinese reply in the tea house</small></button><button data-school-tab="hsk"><span>🎓</span><b>Full HSK 1 course</b><small>300 words, grammar, assessments, certificate</small></button></div><div class="school-campus-note"><b>🗺️ Learn to unlock plaza areas</b><span>Garden Hall opens at 5 learned words; Food Street opens at 5; Friendship Pavilion opens at 10.</span></div><div class="school-campus-note school-streak-note"><b>🔥 Current study run: ' + streak + ' day' + (streak === 1 ? "" : "s") + ' · best ' + (profile.bestStudyStreak || 0) + '</b><span>' + (streak >= 30 ? "30-day reward earned!" : (nextReward - streak) + ' more study day' + (nextReward - streak === 1 ? "" : "s") + " to your next XP and coin reward.") + ' Total study days (' + profile.studyStreak + ') are saved permanently.</span><button class="school-next" data-use-rest-day ' + (canRest ? "" : "disabled") + '>🌿 Use a rest day · ' + (profile.restDayCredits || 0) + ' credit' + (profile.restDayCredits === 1 ? "" : "s") + '</button><small>' + restStatus + '</small></div><div class="school-campus-note school-friend-note"><b>🤝 Friend challenges</b><span>Coming after shared multiplayer rooms are connected. No fake online classmates are shown.</span></div>';
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
