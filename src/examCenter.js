import { getProfile, updateProfile } from "./profile.js";

const levels = [
  { id: "A1", hsk: "Legacy HSK 2.0 Level 1 (rough guide)", title: "Starter", topics: ["greetings", "numbers", "food"], listen: [["你好。", ["Hello", "Goodbye", "Thank you"], 0], ["我叫安娜。", ["My name is Anna", "I am hungry", "I am a teacher"], 0], ["我要一杯茶。", ["I want a cup of tea", "I have a book", "Where is the school"], 0]], read: [["我今年十岁。", ["I am ten this year", "I have ten books", "It is ten o’clock"], 0], ["妈妈在家。", ["Mother is at home", "Mother is at school", "Mother is working"], 0], ["请给我水。", ["Please give me water", "Please show me the way", "Please wait for me"], 0]], write: [["Write: My name is Mei.", ["我", "叫", "梅"]], ["Write: I like tea.", ["我", "喜欢", "茶"]]], speak: ["Introduce yourself: say your name in Chinese.", "Order one drink politely in Chinese."] },
  { id: "A2", hsk: "Legacy HSK 2.0 Level 2 (rough guide)", title: "Elementary", topics: ["daily routines", "directions", "shopping"], listen: [["请一直往前走，然后左转。", ["Go straight, then turn left", "Turn right, then stop", "Cross the street"], 0], ["火车八点半到。", ["The train arrives at 8:30", "The train leaves at 8:00", "The bus arrives at 8:30"], 0], ["这件衣服比那件便宜。", ["This item is cheaper than that one", "That one is newer", "This one is too small"], 0]], read: [["因为下雨，我们今天不去公园。", ["Because it is raining, we are not going to the park today", "We went to the park yesterday", "It will rain at the park tomorrow"], 0], ["请问，最近的地铁站在哪儿？", ["Where is the nearest subway station?", "When does the subway close?", "How much is a subway ticket?"], 0], ["他每天早上跑步半个小时。", ["He runs for half an hour every morning", "He walks to work every day", "He runs for an hour at night"], 0]], write: [["Write: I went to school by bus yesterday.", ["昨天", "学校", "公共汽车"]], ["Write: If you have time, please call me.", ["如果", "时间", "给我打电话"]]], speak: ["Tell a friend what you usually do on weekends.", "Ask politely where the nearest station is."] },
  { id: "B1", hsk: "Legacy HSK 2.0 Level 3 (rough guide)", title: "Intermediate", topics: ["experiences", "opinions", "plans"], listen: [["虽然路上有点儿堵车，但是我们还是准时到了。", ["Although traffic was heavy, we still arrived on time", "We missed the train because of traffic", "The road was closed all day"], 0], ["这次旅行让我对当地文化有了更深的了解。", ["The trip helped me understand local culture better", "The trip was shorter than expected", "The guide changed the travel plan"], 0], ["如果明天不下雨，我们就去爬山。", ["If it does not rain tomorrow, we will go hiking", "We hiked yesterday in the rain", "The mountain is closed tomorrow"], 0]], read: [["她刚搬到这座城市，正在慢慢适应这里的生活节奏。", ["She recently moved here and is gradually adjusting to life", "She is planning to leave the city soon", "She has lived here since childhood"], 0], ["与其花时间抱怨，不如想办法解决问题。", ["Rather than complain, it is better to find a solution", "The problem cannot be solved", "Complaining is a useful solution"], 0], ["这项活动不仅帮助了新生，也让大家有机会交流文化。", ["The activity helped newcomers and encouraged cultural exchange", "Only senior students joined the activity", "The event was cancelled"], 0]], write: [["Write two sentences about a memorable trip.", ["旅行", "因为"]], ["Write your opinion about learning with friends.", ["我认为", "一起"]]], speak: ["Describe a challenge you solved and what you learned.", "Explain one difference between two cultures you know."] },
  { id: "B2", hsk: "Legacy HSK 2.0 Level 4 (rough guide)", title: "Upper intermediate", topics: ["study and work", "news", "argument"], listen: [["校方决定推迟活动，以便给外地学生更多准备时间。", ["The school postponed the event to give visiting students more time", "The school cancelled the event because few students came", "The students asked to shorten the event"], 0], ["报告指出，线上课程提高了灵活性，但互动仍有待加强。", ["Online courses are flexible, but interaction still needs improvement", "Online courses have reduced flexibility", "Interaction is no longer important"], 0], ["尽管预算有限，团队仍然按计划完成了项目。", ["Despite a limited budget, the team completed the project as planned", "The team abandoned the project", "The project cost less than expected and finished early"], 0]], read: [["作者并未否认科技带来的便利，而是提醒读者关注数据隐私。", ["The author acknowledges technology’s convenience but warns about data privacy", "The author argues that technology has no benefits", "The author says privacy no longer matters"], 0], ["调查结果显示，参加社团的学生更容易建立稳定的社交关系。", ["The survey found that club members more easily build stable social relationships", "Most students avoid joining clubs", "Social relationships are unrelated to clubs"], 0], ["这项政策的成效取决于执行方式，而不只是最初的设计。", ["The policy’s success depends on implementation, not just its original design", "The design alone guarantees success", "The policy has already ended"], 0]], write: [["Write a short formal message requesting an appointment.", ["您好", "预约", "请问"]], ["Give one advantage and one drawback of online learning.", ["优点", "缺点"]]], speak: ["Summarize a recent news story and explain its impact.", "Compare two ways of learning and support your preference."] },
  { id: "C1", hsk: "Legacy HSK 2.0 Level 5 (rough guide)", title: "Advanced", topics: ["academic ideas", "inference", "formal writing"], listen: [["发言人强调，短期的数据波动不足以证明长期趋势已经发生改变。", ["Short-term data changes do not prove a long-term trend has shifted", "Long-term trends can be ignored", "The data showed no short-term change"], 0], ["这项研究的价值不仅在于结论，也在于它提出了新的研究方法。", ["The study matters for its conclusion and its new method", "The study only repeats old conclusions", "The research method was not described"], 0], ["专家建议，在扩大试点范围之前，先评估不同地区的实际需求。", ["Experts recommend assessing local needs before expanding the pilot", "Experts say every region has identical needs", "The pilot should be ended immediately"], 0]], read: [["若只以短期效率衡量改革，便可能忽略其对公平与可持续性的影响。", ["Judging reform only by short-term efficiency may overlook fairness and sustainability", "Efficiency has no relation to reform", "Fairness can only be measured in the short term"], 0], ["作者借这一案例说明，制度设计必须考虑执行者的实际处境。", ["The example shows that institutions must consider implementers’ real conditions", "The case proves implementation is unnecessary", "The author rejects institutional design"], 0], ["研究虽提供了有价值的证据，但样本范围限制了结论的普遍性。", ["The evidence is useful, but the sample limits how broadly conclusions apply", "The study had no evidence", "The findings apply to all populations without limits"], 0]], write: [["Write a structured paragraph proposing a campus improvement.", ["建议", "原因", "因此"]], ["Summarize a study and mention one limitation.", ["研究", "结果", "局限"]]], speak: ["Present a reasoned view on whether technology improves education.", "Summarize an argument, then respectfully challenge one assumption."] },
  { id: "C2", hsk: "Legacy HSK 2.0 Level 6 (rough guide)", title: "Proficient", topics: ["subtle argument", "synthesis", "professional communication"], listen: [["与其把争论归结为立场对立，不如追问双方依据的证据是否可比。", ["Instead of reducing disagreement to opposing views, compare the evidence behind them", "The speakers agreed to avoid evidence", "The disagreement was caused by missing data only"], 0], ["政策初衷固然重要，但若缺乏透明的评估机制，公众难以判断其实际成效。", ["Good intentions matter, but transparent evaluation is needed to judge real impact", "Public evaluation is unnecessary when intentions are good", "The policy has already been evaluated transparently"], 0], ["这段话看似让步，实则通过限定适用范围强化了作者的核心论点。", ["The apparent concession strengthens the argument by narrowing its scope", "The author abandons the main argument", "The passage contains no qualification"], 0]], read: [["表面上的共识未必意味着目标一致；它有时只是暂时搁置了分歧。", ["Apparent consensus may only temporarily set disagreements aside", "Agreement always means shared goals", "Disagreement has permanently ended"], 0], ["若将个别案例直接推广为普遍规律，结论便超出了证据所能支持的范围。", ["Generalizing one case may exceed what the evidence supports", "A single case proves every rule", "Evidence should never be used"], 0], ["作者并非质疑技术本身，而是反对把效率视为唯一评价标准。", ["The author questions efficiency as the only measure, not technology itself", "The author opposes all technology", "Efficiency is the only valid measure"], 0]], write: [["Write a balanced argument about one difficult public issue.", ["一方面", "另一方面", "综上"]], ["Write a concise professional proposal with evidence and a caveat.", ["根据", "建议", "不过"]]], speak: ["Synthesize two viewpoints and explain where they genuinely differ.", "Give a nuanced recommendation and address a likely objection."] }
];

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const today = () => new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export function mountExamCenter(root) {
  if (!root || root.dataset.mounted) return;
  root.dataset.mounted = "true";
  let selectedLevel = "A1", activeRun = false, section = 0;
  const sectionNames = ["Listening", "Reading", "Writing", "Speaking"];
  const sections = ["listening", "read", "write", "speak"];
  let answers = [[], [], [], []];

  function registeredProfile() {
    const profile = getProfile();
    return profile.examRegistration || null;
  }

  function render() {
    const profile = getProfile(), registration = registeredProfile();
    const level = levels.find(item => item.id === (registration?.level || selectedLevel)) || levels[0];
    const history = [...(profile.examHistory || [])].reverse();
    if (!registration) {
      root.innerHTML = `<header class="exam-heading"><p class="exam-kicker">WORLDMATES · CHINESE EXAM PRACTICE</p><h1 id="exam-title">Your effort, <em>measured.</em></h1><p>Register your player profile, choose a practice band, and keep each four-skill result with your Worldmates progress.</p></header><div class="exam-columns"><section class="exam-panel"><span class="exam-icon">筆</span><h2>Register for practice exams</h2><form data-exam-register><label>Candidate name<input name="candidate" value="${esc(profile.name === "Little learner" ? "" : profile.name)}" maxlength="32" minlength="2" required autocomplete="name" placeholder="Name on your practice record" /></label><label>Starting level<select name="level">${levels.map(item => `<option value="${item.id}" ${item.id === selectedLevel ? "selected" : ""}>${item.id} · ${item.title}</option>`).join("")}</select></label><p class="exam-level-note" data-level-note></p><label class="exam-consent"><input type="checkbox" name="practiceOnly" required /> <span>I understand this is a Worldmates practice assessment, not an official HSK exam or university credential.</span></label><button class="exam-primary" type="submit">Register player</button><p class="exam-feedback" data-exam-feedback role="status"></p></form><p class="exam-device-note">Registration saves on this device. Sign in from your player profile to sync across devices when account sync is configured.</p><button type="button" class="exam-profile-button" data-exam-profile>Open player profile</button></section><aside class="exam-panel exam-explainer"><h2>What you’ll practice</h2><ul><li>Listening · hear a Mandarin clip and choose its meaning</li><li>Reading · understand a short Chinese passage</li><li>Writing · answer prompts in Chinese</li><li>Speaking · answer aloud, then use a simple self-check rubric</li></ul><details class="exam-map"><summary>How these bands roughly relate to HSK</summary><p>This is a study guide based on the older six-level HSK scale, not an official CEFR equivalence. The newer HSK framework has nine levels.</p><dl><div><dt>A1</dt><dd>HSK 1</dd></div><div><dt>A2</dt><dd>HSK 2</dd></div><div><dt>B1</dt><dd>HSK 3</dd></div><div><dt>B2</dt><dd>HSK 4</dd></div><div><dt>C1</dt><dd>HSK 5</dd></div><div><dt>C2</dt><dd>HSK 6</dd></div></dl></details><div class="exam-score-chip">Each skill scores 0–200<br /><b>800 points total</b></div></aside></div><p class="exam-notice"><b>For university applications:</b> use this to prepare, then take the official HSK through an authorized test center. Universities set their own score requirements.</p>`;
      const form = root.querySelector("[data-exam-register]");
      const select = form.elements.level;
      const levelNote = root.querySelector("[data-level-note]");
      function updateNote() {
        selectedLevel = select.value;
        const found = levels.find(item => item.id === selectedLevel);
        levelNote.textContent = `${found.hsk} · ${found.topics.join(" · ")} · CEFR comparison is only a rough study guide.`;
      }
      select.addEventListener("change", updateNote); updateNote();
      form.addEventListener("submit", event => {
        event.preventDefault();
        const candidateName = String(form.elements.candidate.value || "").trim().slice(0, 32);
        if (candidateName.length < 2) { root.querySelector("[data-exam-feedback]").textContent = "Enter a name with at least 2 characters."; return; }
        updateProfile({ name: candidateName.slice(0, 18), examRegistration: { candidateName, level: selectedLevel, registeredAt: new Date().toISOString(), registrationId: `WM-${Math.random().toString(36).slice(2, 8).toUpperCase()}` } });
        render();
      });
      return;
    }

    root.innerHTML = `<header class="exam-heading"><p class="exam-kicker">WORLD MATES · EXAM CENTER</p><h1 id="exam-title">Practice <em>${esc(level.id)}</em></h1><p>Registered candidate: <b>${esc(registration.candidateName)}</b> · ${esc(registration.registrationId)}</p></header>${activeRun ? renderRun(level) : `<section class="exam-panel exam-dashboard"><div><span class="exam-level-pill">${esc(level.id)} · ${esc(level.title)}</span><h2>Your four-skill mock exam</h2><p>One practice run gives separate listening, reading, writing, and speaking scores. Allow about 15–20 minutes and finish all four parts to save the result.</p><p class="exam-level-note">Study guide: ${esc(level.hsk)}. HSK and CEFR bands do not match exactly; this level is an approximation.</p><div class="exam-start-row"><button type="button" class="exam-primary" data-exam-start>Start ${esc(level.id)} mock exam</button><label>Practice level<select data-exam-level-select>${levels.map(item => `<option value="${item.id}" ${item.id === level.id ? "selected" : ""}>${item.id} · ${item.title}</option>`).join("")}</select></label></div></div><div class="exam-summary"><b>0–800</b><span>total points</span><small>4 skills · 200 points each</small></div></section>${history.length ? `<section class="exam-history"><div class="exam-history-heading"><h2>Saved results</h2><span>${history.length} attempt${history.length === 1 ? "" : "s"}</span></div>${history.map(attempt => `<article class="exam-result-row"><div><b>${esc(attempt.level)} · ${esc(attempt.total)}/800</b><small>${esc(attempt.date)} · Practice result</small></div><div class="exam-mini-scores">${sectionNames.map(name => `<span>${name.slice(0, 1)} ${Number(attempt.scores?.[name]) || 0}</span>`).join("")}</div><button type="button" data-exam-certificate="${esc(attempt.id)}">View record</button></article>`).join("")}</section>` : `<div class="exam-empty"><span>📘</span><b>No results saved yet</b><small>Finish your first mock exam and it will appear here.</small></div>`}<p class="exam-device-note">Scores save to the same player profile as your game. Sign in to your Worldmates account and configure the profile database to sync across devices.</p>`}`;
    root.querySelector("[data-exam-start]")?.addEventListener("click", () => { activeRun = true; section = 0; answers = [[], [], [], []]; render(); });
    root.querySelector("[data-exam-level-select]")?.addEventListener("change", event => {
      selectedLevel = event.target.value;
      updateProfile({ examRegistration: { ...registration, level: selectedLevel } });
    });
    root.querySelectorAll("[data-exam-answer]").forEach(button => button.addEventListener("click", () => {
      const sectionIndex = section;
      const questionIndex = Number(button.dataset.question);
      const value = Number(button.dataset.answer);
      answers[sectionIndex][questionIndex] = value;
      button.closest(".exam-question").querySelectorAll("[data-exam-answer]").forEach(option => option.classList.toggle("chosen", option === button));
    }));
    root.querySelectorAll("[data-exam-listen]").forEach(button => button.addEventListener("click", () => {
      const utterance = button.dataset.examListen;
      const chineseVoice = window.speechSynthesis?.getVoices().find(voice => /^zh(-|$)/i.test(voice.lang));
      if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === "undefined" || !chineseVoice) {
        const transcript = button.closest(".exam-question")?.querySelector(".exam-audio-transcript");
        if (transcript) transcript.hidden = false;
        showFeedback("Audio is unavailable in this browser, so the question transcript is shown.");
        return;
      }
      const speech = new SpeechSynthesisUtterance(utterance); speech.lang = "zh-CN"; speech.voice = chineseVoice; speechSynthesis.cancel(); speechSynthesis.speak(speech);
    }));
    root.querySelector("[data-exam-next]")?.addEventListener("click", () => {
      if (section < 3) {
        if (section === 0 && answers[0].filter(value => value !== undefined).length < level.listen.length) return showFeedback("Answer each listening question first.");
        if (section === 1 && answers[1].filter(value => value !== undefined).length < level.read.length) return showFeedback("Answer each reading question first.");
        if (section === 2) {
          answers[2] = [...root.querySelectorAll("[data-writing-answer]")].map(field => field.value.trim());
          if (answers[2].some(value => !value)) return showFeedback("Complete both writing responses before continuing.");
        }
        section++; render(); return;
      }
      const speakingRatings = [...root.querySelectorAll("[data-speaking-self]")].map(field => field.value);
      if (speakingRatings.some(value => value === "")) return showFeedback("Choose a self-check score for both speaking prompts.");
      answers[3] = speakingRatings.map(Number);
      saveResult(level);
    });
    root.querySelectorAll("[data-speaking-self]").forEach(select => select.addEventListener("change", () => { answers[3][Number(select.dataset.speakingSelf)] = Number(select.value); }));
    root.querySelectorAll("[data-exam-certificate]").forEach(button => button.addEventListener("click", () => showCertificate(button.dataset.examCertificate)));
  }

  function showFeedback(message) {
    const feedback = root.querySelector("[data-exam-feedback]"); if (feedback) feedback.textContent = message;
  }

  function renderRun(level) {
    const key = sections[section];
    const tabs = sectionNames.map((name, index) => `<span class="${index === section ? "current" : index < section ? "done" : ""}">${index < section ? "✓ " : ""}${name}</span>`).join("");
    let body = "";
    if (section < 2) {
      const questions = section === 0 ? level.listen : level.read;
      body = section === 0 ? `<div class="exam-audio-card"><p>Listen carefully, then choose the meaning. We use an installed Mandarin voice, or show a transcript if none is available.</p>${questions.map((item, index) => `<article class="exam-question"><div class="exam-question-head"><b>Audio ${index + 1}</b><button type="button" class="exam-audio-button" data-exam-listen="${esc(item[0])}">▶ Play Mandarin</button></div><p class="exam-audio-transcript" hidden><span>Audio transcript</span><b lang="zh">${esc(item[0])}</b></p><div class="exam-choices">${item[1].map((choice, choiceIndex) => `<button type="button" data-exam-answer data-question="${index}" data-answer="${choiceIndex}">${esc(choice)}</button>`).join("")}</div></article>`).join("")}</div>` : `<div class="exam-questions"><p>Read each sentence and choose the closest meaning.</p>${questions.map((item, index) => `<article class="exam-question"><b lang="zh">${esc(item[0])}</b><div class="exam-choices">${item[1].map((choice, choiceIndex) => `<button type="button" data-exam-answer data-question="${index}" data-answer="${choiceIndex}">${esc(choice)}</button>`).join("")}</div></article>`).join("")}</div>`;
    } else if (section === 2) {
      body = `<div class="exam-writing"><p>Write in Chinese. We’ll save your answers and show how many key ideas from the prompt you included.</p>${level.write.map((item, index) => `<label class="exam-writing-prompt"><b>Writing ${index + 1}</b><span>${esc(item[0])}</span><textarea data-writing-answer maxlength="600" rows="4" lang="zh" placeholder="Type your answer in Chinese…"></textarea><small>Practice scoring checks a few key terms only; it cannot judge full grammar or writing quality.</small></label>`).join("")}</div>`;
    } else {
      body = `<div class="exam-speaking"><p>Speak aloud in Chinese, then rate your own practice. This is a self-check, not an automated pronunciation test.</p>${level.speak.map((prompt, index) => `<article class="exam-speaking-prompt"><b>Speaking ${index + 1}</b><p>${esc(prompt)}</p><small>Try to answer in complete Chinese sentences. No microphone recording is stored.</small><label>How well did you speak clearly and complete the task?<select data-speaking-self="${index}"><option value="">Choose an honest score</option><option value="0">0 · I did not answer</option><option value="25">25 · I tried, with lots of help</option><option value="50">50 · I shared a simple answer</option><option value="75">75 · I answered clearly with some detail</option><option value="100">100 · Clear, complete, confident answer</option></select></label></article>`).join("")}</div>`;
    }
    return `<section class="exam-panel exam-run"><div class="exam-run-top"><span class="exam-level-pill">${esc(level.id)}</span><button type="button" data-exam-cancel>Exit exam</button></div><h2>${esc(sectionNames[section])}</h2><div class="exam-progress" aria-label="Exam section progress">${tabs}</div>${body}<p class="exam-feedback" data-exam-feedback role="status"></p><button type="button" class="exam-primary" data-exam-next>${section === 3 ? "Finish and save score" : "Save section and continue"}</button></section>`;
  }

  function saveResult(level) {
    const listening = Math.round(answers[0].filter((value, index) => value === level.listen[index][2]).length / level.listen.length * 200);
    const reading = Math.round(answers[1].filter((value, index) => value === level.read[index][2]).length / level.read.length * 200);
    const written = answers[2] || [];
    const writingHits = written.reduce((total, response, index) => total + level.write[index][1].filter(keyword => response.includes(keyword)).length, 0);
    const writingTerms = level.write.reduce((total, prompt) => total + prompt[1].length, 0);
    const writing = Math.round(writingHits / writingTerms * 200);
    const speaking = Math.round(answers[3].reduce((sum, value) => sum + value, 0));
    const scores = { Listening: listening, Reading: reading, Writing: writing, Speaking: speaking };
    const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
    const profile = getProfile();
    const attempt = { id: `EX-${Date.now().toString(36).toUpperCase()}`, candidateName: profile.examRegistration?.candidateName || profile.name, level: level.id, hskApprox: level.hsk, scores, total, date: today(), completedAt: new Date().toISOString(), certificate: "Worldmates practice record" };
    updateProfile({ examHistory: [...(profile.examHistory || []), attempt].slice(-100), xp: profile.xp + 20, coins: profile.coins + 5 });
    activeRun = false;
    render();
    showCertificate(attempt.id, true);
  }

  function showCertificate(id, justFinished = false) {
    const attempt = (getProfile().examHistory || []).find(item => item.id === id);
    if (!attempt) return;
    root.insertAdjacentHTML("beforeend", `<div class="exam-certificate-backdrop" role="presentation"><article class="exam-certificate" role="dialog" aria-modal="true" aria-labelledby="exam-certificate-title"><button class="exam-certificate-close" type="button" aria-label="Close certificate">×</button><p class="exam-kicker">WORLDMATES · PRACTICE RESULT</p><h2 id="exam-certificate-title">Practice exam completed</h2><p>This record recognizes a completed Worldmates mock exam. It is not an official HSK certificate or proof verified by an examiner.</p><div class="exam-certificate-name">${esc(attempt.candidateName)}</div><div class="exam-certificate-level">${esc(attempt.level)} practice · ${esc(attempt.total)}/800 points</div><div class="exam-certificate-scores">${Object.entries(attempt.scores).map(([name, score]) => `<span><b>${esc(score)}</b>${esc(name)} / 200</span>`).join("")}</div><small>${esc(attempt.date)} · Result ID ${esc(attempt.id)} · ${esc(attempt.hskApprox)}</small><div class="exam-certificate-actions"><button type="button" data-exam-print>Print / save PDF</button><button type="button" data-certificate-close>Close</button></div></article></div>`);
    const backdrop = root.querySelector(".exam-certificate-backdrop:last-child");
    backdrop.querySelectorAll(".exam-certificate-close,[data-certificate-close]").forEach(button => button.addEventListener("click", () => backdrop.remove()));
    backdrop.querySelector("[data-exam-print]").addEventListener("click", () => window.print());
    if (justFinished) backdrop.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  root.addEventListener("click", event => {
    if (event.target.closest("[data-exam-cancel]")) { activeRun = false; render(); }
    if (event.target.closest("[data-exam-profile]")) document.querySelector("[data-profile-open]")?.click();
  });
  window.addEventListener("lantern:profile", () => { if (!activeRun) render(); });
  render();
}
