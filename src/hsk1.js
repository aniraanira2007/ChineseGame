import vocabulary from "./data/hsk1-vocabulary.json";
import grammarData from "./data/hsk1-grammar.json";
import { getProfile, rewardStudyAnswer, updateProfile } from "./profile.js";

const WORDS_PER_UNIT = 15;
const UNIT_COUNT = Math.ceil(vocabulary.words.length / WORDS_PER_UNIT);
const PASS_RATE = 0.8;
const grammar = grammarData.points;
const initialProgress = () => ({ passedUnits: [], grammarDone: false, examBest: 0, certificate: null });

export function mountHsk1Course(root) {
  let progress = { ...initialProgress(), ...(getProfile().hsk1Progress || {}) };
  let screen = "home";
  let unitIndex = 0;
  let quiz = null;

  const save = () => {
    progress.passedUnits = [...new Set(progress.passedUnits || [])];
    updateProfile({ hsk1Progress: { ...progress } });
  };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const unitWords = index => vocabulary.words.slice(index * WORDS_PER_UNIT, (index + 1) * WORDS_PER_UNIT);
  const studiedCount = () => progress.passedUnits.length === UNIT_COUNT ? vocabulary.words.length : Math.min(progress.passedUnits.length * WORDS_PER_UNIT, vocabulary.words.length);
  const courseReady = () => progress.passedUnits.length === UNIT_COUNT && progress.grammarDone;
  const shuffle = list => [...list].sort(() => Math.random() - 0.5);
  const speak = text => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.82;
    window.speechSynthesis.speak(utterance);
  };
  const saveAndRender = () => { save(); render(); };

  function renderHome() {
    const passed = progress.passedUnits.length;
    const vocabPct = Math.round(studiedCount() / vocabulary.words.length * 100);
    root.innerHTML = `
      <section class="hsk-course-shell">
        <div class="hsk-course-hero">
          <div><p class="hsk-kicker">HSK 3.0 · LEVEL 1</p><h2>Your first 300 words</h2><p>Build everyday Mandarin with short vocabulary lessons, grammar notes, listening support, and a final review.</p></div>
          <div class="hsk-medallion" aria-hidden="true"><span>HSK</span><b>1</b><small>你好</small></div>
        </div>
        <div class="hsk-progress-panel"><div class="hsk-progress-copy"><b>${studiedCount()} / ${vocabulary.words.length} vocabulary entries</b><span>${passed} / ${UNIT_COUNT} lessons passed · ${grammar.length} grammar points</span></div><div class="hsk-progress-track"><i style="width:${vocabPct}%"></i></div></div>
        <nav class="hsk-actions" aria-label="HSK 1 activities"><button class="hsk-action-btn" data-open-grammar>Grammar review <span>${progress.grammarDone ? "✓ Complete" : `${grammar.length} points`}</span></button><button class="hsk-action-btn" data-picture-practice>Picture practice <span>Original Study Mode</span></button><button class="hsk-action-btn hsk-exam-btn" data-final-exam ${courseReady() ? "" : "disabled"}>Final assessment <span>${courseReady() ? "Ready" : "Pass all lessons + review grammar"}</span></button></nav>
        <div class="hsk-section-heading"><div><p class="hsk-kicker">YOUR LEARNING PATH</p><h3>Vocabulary lessons</h3></div><span>${vocabulary.words.length} words in ${UNIT_COUNT} short lessons</span></div>
        <div class="hsk-unit-grid">${Array.from({ length: UNIT_COUNT }, (_, i) => {
          const words = unitWords(i);
          const done = progress.passedUnits.includes(i);
          const completeCount = i === UNIT_COUNT - 1 ? words.length : WORDS_PER_UNIT;
          return `<button class="hsk-unit-card ${done ? "is-done" : ""}" data-open-unit="${i}"><span class="hsk-unit-number">${done ? "✓" : String(i + 1).padStart(2, "0")}</span><span><b>Lesson ${i + 1}</b><small>${words[0]?.hanzi || ""} → ${words.at(-1)?.hanzi || ""}</small><small>${completeCount} vocabulary entries</small></span><span class="hsk-unit-arrow">${done ? "Review" : "Study"} →</span></button>`;
        }).join("")}</div>
        ${progress.certificate ? renderCertificate() : ""}
        <p class="hsk-credit">Syllabus: HSK 3.0 (November 2025). Vocabulary and grammar data: <a href="https://gushichinese.com/hsk-3.0/downloads" target="_blank" rel="noreferrer">Gushi, CC BY-SA 4.0</a>. This course is independent and is not an official HSK exam or certification.</p>
      </section>`;
  }

  function renderUnit() {
    const words = unitWords(unitIndex);
    root.innerHTML = `<section class="hsk-course-shell"><button class="hsk-back" data-home>← All HSK 1 lessons</button><div class="hsk-section-heading hsk-unit-title"><div><p class="hsk-kicker">LESSON ${unitIndex + 1} OF ${UNIT_COUNT}</p><h2>Learn these words</h2><p>Tap the speaker to hear Mandarin pronunciation. Review the example sentence, then take the lesson quiz.</p></div><span class="hsk-unit-status">${progress.passedUnits.includes(unitIndex) ? "✓ Passed" : `${words.length} words`}</span></div><div class="hsk-word-grid">${words.map((word, i) => `<article class="hsk-word-card"><div class="hsk-word-top"><span class="hsk-word-index">${String(unitIndex * WORDS_PER_UNIT + i + 1).padStart(3, "0")}</span><button class="hsk-speak" data-speak="${escapeHtml(word.hanzi)}" aria-label="Hear ${escapeHtml(word.hanzi)}">🔊</button></div><strong lang="zh">${escapeHtml(word.hanzi)}</strong><span class="hsk-pinyin">${escapeHtml(word.pinyin)}</span><span class="hsk-meaning">${escapeHtml(word.meaning)}</span><div class="hsk-example"><span lang="zh">${escapeHtml(word.exampleChinese)}</span><small>${escapeHtml(word.examplePinyin)}</small><small>${escapeHtml(word.exampleEnglish)}</small></div></article>`).join("")}</div><div class="hsk-unit-footer"><span>Progress saves automatically on this device.</span><button class="primary-btn" data-start-unit="${unitIndex}">Take lesson quiz <span>→</span></button></div></section>`;
  }

  function renderGrammar() {
    root.innerHTML = `<section class="hsk-course-shell"><button class="hsk-back" data-home>← All HSK 1 lessons</button><div class="hsk-section-heading hsk-unit-title"><div><p class="hsk-kicker">GRAMMAR REVIEW</p><h2>45 building blocks</h2><p>Read each point and example. You can hear each Chinese sentence with the speaker button.</p></div><span class="hsk-unit-status">${progress.grammarDone ? "✓ Reviewed" : `${grammar.length} points`}</span></div><div class="hsk-grammar-list">${grammar.map((item, i) => `<article class="hsk-grammar-card"><div><span class="hsk-word-index">POINT ${String(i + 1).padStart(2, "0")}</span><h3>${escapeHtml(item.point)}</h3>${item.pattern ? `<code>${escapeHtml(item.pattern)}</code>` : ""}<p>${escapeHtml(item.explanation)}</p></div><div class="hsk-grammar-example"><span lang="zh">${escapeHtml(item.exampleChinese)}</span><button class="hsk-speak" data-speak="${escapeHtml(item.exampleChinese)}" aria-label="Hear example">🔊</button><small>${escapeHtml(item.exampleEnglish)}</small></div></article>`).join("")}</div><div class="hsk-unit-footer"><span>Review the full list before the final assessment.</span><button class="primary-btn" data-mark-grammar>${progress.grammarDone ? "Grammar review complete ✓" : "Mark grammar reviewed"}</button></div></section>`;
  }

  function makeQuestion(word, pool) {
    const distractors = shuffle(pool.filter(item => item.hanzi !== word.hanzi)).slice(0, 3).map(item => item.meaning);
    return { prompt: word.hanzi, sub: word.pinyin, answer: word.meaning, choices: shuffle([word.meaning, ...distractors]), chinese: true };
  }
  function makeGrammarQuestion(item) {
    const distractors = shuffle(grammar.filter(x => x !== item)).slice(0, 3).map(x => x.explanation);
    return { prompt: item.pattern || item.point, sub: item.point, answer: item.explanation, choices: shuffle([item.explanation, ...distractors]), chinese: false };
  }
  function startQuiz(index, isFinal = false) {
    const qs = isFinal
      ? [...shuffle(vocabulary.words).slice(0, 30).map(word => makeQuestion(word, vocabulary.words)), ...shuffle(grammar).slice(0, 10).map(makeGrammarQuestion)]
      : shuffle(unitWords(index)).map(word => makeQuestion(word, unitWords(index)));
    quiz = { questions: qs, position: 0, score: 0, isFinal };
    screen = "quiz";
    renderQuiz();
  }
  function renderQuiz(feedback = "") {
    const q = quiz.questions[quiz.position];
    if (!q) return finishQuiz();
    root.innerHTML = `<section class="hsk-course-shell"><button class="hsk-back" data-home>← Leave quiz</button><div class="hsk-quiz-card"><p class="hsk-kicker">${quiz.isFinal ? "FINAL ASSESSMENT" : `LESSON ${unitIndex + 1} CHECK`}</p><div class="hsk-quiz-progress"><span>Question ${quiz.position + 1} of ${quiz.questions.length}</span><span>${quiz.score} correct</span></div><div class="hsk-progress-track"><i style="width:${(quiz.position / quiz.questions.length) * 100}%"></i></div><div class="hsk-quiz-prompt"><strong ${q.chinese ? 'lang="zh"' : ""}>${escapeHtml(q.prompt)}</strong><span>${escapeHtml(q.sub)}</span>${q.chinese ? `<button class="hsk-speak" data-speak="${escapeHtml(q.prompt)}" aria-label="Hear word">🔊</button>` : ""}</div><h3>${q.chinese ? "Choose the meaning" : "Choose the matching explanation"}</h3><div class="hsk-choice-list">${q.choices.map((choice, i) => `<button class="hsk-choice" data-quiz-choice="${i}"><span>${String.fromCharCode(65 + i)}</span>${escapeHtml(choice)}</button>`).join("")}</div><p class="hsk-feedback" role="status">${feedback}</p><button class="primary-btn hsk-next" data-quiz-next disabled>Next <span>→</span></button></div></section>`;
  }
  function finishQuiz() {
    const percent = Math.round(quiz.score / quiz.questions.length * 100);
    const passed = percent >= PASS_RATE * 100;
    if (quiz.isFinal) {
      progress.examBest = Math.max(progress.examBest || 0, percent);
      if (passed && courseReady()) {
        const profile = getProfile();
        progress.certificate = { name: profile.name, date: new Date().toISOString(), score: percent };
      }
    } else if (passed && !progress.passedUnits.includes(unitIndex)) {
      progress.passedUnits.push(unitIndex);
    }
    save();
    screen = "result";
    const title = quiz.isFinal ? (passed && courseReady() ? "You earned your certificate!" : "Final assessment complete") : (passed ? "Lesson passed!" : "Keep practicing") ;
    const detail = quiz.isFinal
      ? `${quiz.score} of ${quiz.questions.length} correct · ${percent}%${passed ? "" : " · You need 80% to pass."}`
      : `${quiz.score} of ${quiz.questions.length} correct · ${percent}%${passed ? " · Lesson progress saved." : " · You need 12 correct to pass. You can retry."}`;
    root.innerHTML = `<section class="hsk-course-shell"><div class="hsk-result-card ${passed ? "is-pass" : ""}"><span class="hsk-result-seal">${passed ? "✦" : "↻"}</span><p class="hsk-kicker">${quiz.isFinal ? "HSK 1 REVIEW" : `LESSON ${unitIndex + 1}`}</p><h2>${title}</h2><p>${detail}</p>${quiz.isFinal && progress.certificate ? `<button class="primary-btn" data-show-certificate>View & print certificate <span>→</span></button>` : ""}<div class="hsk-result-actions">${!quiz.isFinal ? `<button class="primary-btn" data-retry-unit="${unitIndex}">Try lesson again <span>↻</span></button>` : `<button class="primary-btn" data-retry-exam>Retake final assessment <span>↻</span></button>`}<button class="hsk-secondary-btn" data-home>Back to HSK 1 course</button></div></div></section>`;
  }

  function renderCertificate() {
    const record = progress.certificate;
    const date = new Date(record.date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    return `<section class="hsk-certificate-wrap"><article class="hsk-certificate" id="hsk-certificate"><div class="certificate-border"><p class="certificate-kicker">LITTLE LANTERN · CHINESE LEARNING GAME</p><div class="certificate-seal">灯</div><h2>Certificate of Completion</h2><p class="certificate-copy">This certificate is awarded to</p><h3>${escapeHtml(record.name)}</h3><p class="certificate-copy">for completing the HSK 3.0 Level 1 learning course, including all 300 vocabulary entries, 45 grammar points, and the final assessment.</p><p class="certificate-score">Final assessment score: <b>${record.score}%</b></p><div class="certificate-footer"><span>${date}</span><span>HSK 1 · Independent learning course</span></div><p class="certificate-disclaimer">Game-issued course completion certificate. It is not an official HSK test score report or credential.</p></div></article><button class="primary-btn certificate-print" data-print-certificate>Print / Save as PDF <span>↗</span></button></section>`;
  }

  function render() {
    if (screen === "home") renderHome();
    else if (screen === "unit") renderUnit();
    else if (screen === "grammar") renderGrammar();
  }

  root.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.speak) { speak(button.dataset.speak); return; }
    if (button.hasAttribute("data-open-unit")) { unitIndex = Number(button.dataset.openUnit); screen = "unit"; render(); }
    else if (button.hasAttribute("data-home")) { screen = "home"; quiz = null; render(); }
    else if (button.hasAttribute("data-open-grammar")) { screen = "grammar"; render(); }
    else if (button.hasAttribute("data-mark-grammar")) { progress.grammarDone = true; saveAndRender(); }
    else if (button.hasAttribute("data-start-unit")) startQuiz(Number(button.dataset.startUnit));
    else if (button.hasAttribute("data-final-exam") && courseReady()) startQuiz(-1, true);
    else if (button.hasAttribute("data-retry-unit")) startQuiz(Number(button.dataset.retryUnit));
    else if (button.hasAttribute("data-retry-exam")) startQuiz(-1, true);
    else if (button.hasAttribute("data-show-certificate")) { screen = "home"; render(); root.querySelector("#hsk-certificate")?.scrollIntoView({ behavior: "smooth", block: "center" }); }
    else if (button.hasAttribute("data-print-certificate")) window.print();
    else if (button.hasAttribute("data-picture-practice")) {
      const event = new CustomEvent("lantern:picture-practice");
      window.dispatchEvent(event);
    } else if (button.hasAttribute("data-quiz-choice") && quiz) {
      const q = quiz.questions[quiz.position];
      const selected = q.choices[Number(button.dataset.quizChoice)];
      const correct = selected === q.answer;
      root.querySelectorAll("[data-quiz-choice]").forEach(option => {
        option.disabled = true;
        const text = q.choices[Number(option.dataset.quizChoice)];
        if (text === q.answer) option.classList.add("is-correct");
        else if (option === button) option.classList.add("is-wrong");
      });
      if (correct) { quiz.score += 1; rewardStudyAnswer(true); }
      root.querySelector(".hsk-feedback").textContent = correct ? "Correct! Nicely done." : `Not quite — the answer is ${q.answer}.`;
      root.querySelector(".hsk-next").disabled = false;
    } else if (button.hasAttribute("data-quiz-next") && quiz) {
      quiz.position += 1;
      if (quiz.position >= quiz.questions.length) finishQuiz(); else renderQuiz();
    }
  });

  render();
  return { render };
}
