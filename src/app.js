import { addLearnedWord, getProfile, recordDailyFoodWord, rewardStudyAnswer, updateProfile } from "./profile.js";
import { questions } from "./questions.js";
import vocabulary from "./data/hsk1-vocabulary.json";
import characterData from "./data/characters.json";
import { mountAccount } from "./account.js";
import { mountPlayerStats } from "./analytics/playerStats.js";
import "./analytics/playerStats.css";
import "./socialRoom.css";
import "./hsk.css";

(() => {
  "use strict";

  const views = { home: document.querySelector("#home-view"), study: document.querySelector("#study-view"), world: document.querySelector("#world-view"), character: document.querySelector("#character-view"), club: document.querySelector("#club-view"), exam: document.querySelector("#exam-view") };
  const crumb = document.querySelector("#crumb-current");
  const lesson = document.querySelector("#lesson-container");
  let questionIndex = 0;
  let answered = false;
  let world = null;
  let worldPending = false;
  let hskCoursePending = false;
  let hskCourseReady = false;
  let studioPreview = null;
  let profilePreview = null;
  let studioPromise = null;
  let draftAppearance = null;
  let pendingSchoolTab = null;
  let clubPending = false;
  let clubReady = false;
  let examReady = false;
  let examPending = false;
  let welcomeFlowRoot = null;
  let welcomeFlowStep = "setup";
  let welcomeFlowReplay = false;
  let welcomeAvatarId = "sakura-street";
  let welcomeDraftName = "";
  let welcomePreview = null;

  function mountHskCourse() {
    if (!hskCourseReady && !hskCoursePending) {
      hskCoursePending = true;
      import("./hsk1.js").then(({ mountHsk1Course }) => {
        hskCoursePending = false; hskCourseReady = true;
        mountHsk1Course(document.querySelector("#hsk-course"));
      }).catch(error => {
        hskCoursePending = false;
        const course = document.querySelector("#hsk-course");
        if (course) course.innerHTML = `<div class="error-state"><p>We couldn’t load the HSK 1 course.</p><p>${escapeHtml(error.message)}</p><button class="retry-btn" type="button" onclick="location.reload()">Try again</button></div>`;
      });
    }
  }

  function navigate(route) {
    const legacyStudy = route === "study";
    const next = legacyStudy ? "world" : (views[route] ? route : "home");
    Object.entries(views).forEach(([name, element]) => {
      element.classList.toggle("active", name === next);
      element.setAttribute("aria-hidden", name !== next ? "true" : "false");
    });
    document.querySelectorAll(".nav-link[data-route]").forEach(link => link.classList.toggle("active", link.dataset.route === next));
    crumb.textContent = next.toUpperCase();
    if (world) world.setVisible(next === "world");
    if (legacyStudy) pendingSchoolTab = "hsk";
    if (studioPreview) studioPreview.setVisible(next === "character");
    if (next === "character") initializeCharacterStudio();
    if (next === "exam" && !examReady && !examPending) {
      examPending = true;
      import("./examCenter.js").then(({ mountExamCenter }) => {
        examPending = false;
        examReady = true;
        mountExamCenter(document.querySelector("#exam-center-root"));
      }).catch(error => {
        examPending = false;
        const root = document.querySelector("#exam-center-root");
        if (root) root.innerHTML = `<div class="error-state"><p>Exam Center couldn’t load.</p><p>${escapeHtml(error.message)}</p><button class="retry-btn" type="button" onclick="location.reload()">Try again</button></div>`;
      });
    }
    if (next === "club" && !clubReady && !clubPending) {
      clubPending = true;
      import("./store.js").then(({ mountClubStore }) => {
        clubPending = false;
        clubReady = true;
        mountClubStore(document.querySelector("#club-store-root"));
      }).catch(error => {
        clubPending = false;
        const root = document.querySelector("#club-store-root");
        if (root) root.innerHTML = `<div class="store-message is-error" role="alert">The Club page couldn’t load. ${escapeHtml(error.message)}</div>`;
      });
    }
    if (next === "world" && !world && !worldPending) {
      worldPending = true;
      import("./world.js").then(({ createWorld }) => {
        worldPending = false;
        if (views.world.classList.contains("active") && !world) {
          world = createWorld(document.querySelector("#world-canvas"));
          world.setVisible(true);
          import("./school.js").then(({ mountSchool }) => {
            mountSchool(document.querySelector("#school-overlay"));
            if (pendingSchoolTab) { const tab = pendingSchoolTab; pendingSchoolTab = null; window.dispatchEvent(new CustomEvent("lantern:open-school", { detail: { tab } })); }
          }).catch(error => console.error("Campus activities could not start", error));
        }
      }).catch(error => {
        worldPending = false;
        const interaction = document.querySelector("#world-interaction");
        interaction.hidden = false;
        interaction.innerHTML = `<button class="interaction-close" aria-label="Close">×</button><h2>World could not start</h2><p>${escapeHtml(error.message)}</p><p>Try a browser with WebGL enabled.</p>`;
        interaction.querySelector(".interaction-close").addEventListener("click", () => { interaction.hidden = true; });
      });
    } else if (next === "world" && legacyStudy) {
      if (document.querySelector("#school-overlay")?.dataset.mounted) window.dispatchEvent(new CustomEvent("lantern:open-school", { detail: { tab: "hsk" } }));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function safeQuestions() {
    if (!Array.isArray(questions)) throw new Error("Lesson data could not be loaded.");
    return questions;
  }

  function loadQuestion() {
    lesson.dataset.ready = "true";
    lesson.innerHTML = '<div class="loading-state"><span class="loader"></span><span>Getting your next picture ready…</span></div>';
    window.setTimeout(() => {
      try {
        const questions = safeQuestions();
        if (!questions.length) {
          lesson.innerHTML = '<div class="empty-state"><span class="empty-icon">✧</span><p>There are no pictures in this lesson just yet.</p></div>';
          return;
        }
        renderQuestion(questions[questionIndex % questions.length], questionIndex + 1, questions.length);
      } catch (error) {
        lesson.innerHTML = `<div class="error-state"><p>We couldn’t load this lesson.</p><p>${escapeHtml(error.message)}</p><button class="retry-btn" type="button" data-action="retry">Try again</button></div>`;
      }
    }, 180);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function renderQuestion(question, number, total) {
    if (!question || !Array.isArray(question.choices) || !question.choices.length) throw new Error("This picture is missing its answer choices.");
    answered = false;
    lesson.innerHTML = `
      <article class="question-card">
        <div class="question-meta"><span class="question-category">${escapeHtml(question.category || "A LITTLE PRACTICE")}</span><span class="question-number">Picture ${number} <span>·</span> ${total}</span></div>
        <div class="question-art" style="background:${escapeHtml(question.backdrop || "#f5f1e7")}"><div class="art-backdrop"></div><span class="art-decoration">${escapeHtml(question.decoration || "✦")}</span><span class="art-emoji" role="img" aria-label="${escapeHtml(question.hint || "A picture clue")}">${escapeHtml(question.emoji || "✦")}</span></div>
        <p class="question-hint">${escapeHtml(question.hint || "What do you see?")}</p>
      </article>
      <section class="answers-card" aria-label="Answer choices">
        <h2 class="answers-title">Which word matches?</h2>
        <div class="answers-list">${question.choices.map((choice, i) => `<button class="answer-option" type="button" data-choice="${escapeHtml(choice)}"><span class="answer-letter">${String.fromCharCode(65 + i)}</span><span class="answer-word" lang="zh">${escapeHtml(choice)}</span><span class="answer-meaning"></span></button>`).join("")}</div>
        <div class="feedback-box" role="status"><span class="feedback-icon">✧</span><span>Choose the word you think matches the picture.</span></div>
        <button class="next-btn" type="button" data-action="next" disabled>Next picture <span>→</span></button>
      </section>`;
    lesson.dataset.answer = question.answer;
  }

  lesson.addEventListener("click", event => {
    const retry = event.target.closest('[data-action="retry"]');
    if (retry) { loadQuestion(); return; }
    const next = event.target.closest('[data-action="next"]');
    if (next) { questionIndex += 1; loadQuestion(); return; }
    const choice = event.target.closest("[data-choice]");
    if (!choice || answered) return;
    answered = true;
    const correct = choice.dataset.choice === lesson.dataset.answer;
    lesson.querySelectorAll("[data-choice]").forEach(button => {
      button.disabled = true;
      if (button.dataset.choice === lesson.dataset.answer) button.classList.add("correct");
    });
    if (!correct) choice.classList.add("incorrect");
    const feedback = lesson.querySelector(".feedback-box");
    feedback.classList.add(correct ? "success" : "error");
    feedback.innerHTML = correct
      ? `<span class="feedback-icon">✓</span><span>That’s right! <b lang="zh">${escapeHtml(lesson.dataset.answer)}</b> means ${escapeHtml(safeQuestions()[questionIndex % safeQuestions().length].meaning || "a new word")}. One lovely new word learned.</span>`
      : `<span class="feedback-icon">↗</span><span>Almost! <b lang="zh">${escapeHtml(lesson.dataset.answer)}</b> means ${escapeHtml(safeQuestions()[questionIndex % safeQuestions().length].meaning || "the right answer")}. Keep going—you’re learning.</span>`;
    rewardStudyAnswer(correct);
    if (correct) {
      const answer = safeQuestions()[questionIndex % safeQuestions().length].answer;
      const entry = vocabulary.words.find(word => word.hanzi === answer);
      if (entry) addLearnedWord(entry);
      recordDailyFoodWord(answer);
    }
    lesson.querySelector('[data-action="next"]').disabled = false;
  });

  window.addEventListener("lantern:picture-practice", () => {
    document.querySelector("#hsk-course").hidden = true;
    document.querySelector("#picture-practice").hidden = false;
    loadQuestion();
  });
  document.querySelector("#back-to-hsk").addEventListener("click", () => {
    document.querySelector("#picture-practice").hidden = true;
    document.querySelector("#hsk-course").hidden = false;
  });

  document.addEventListener("click", event => {
    const schoolLink = event.target.closest("[data-open-school]");
    if (schoolLink) {
      event.preventDefault();
      const tab = schoolLink.dataset.openSchool || "hub";
      history.replaceState(null, "", "#world");
      if (views.world.classList.contains("active") && document.querySelector("#school-overlay")?.dataset.mounted) window.dispatchEvent(new CustomEvent("lantern:open-school", { detail: { tab } }));
      else pendingSchoolTab = tab;
      navigate("world");
      return;
    }
    const link = event.target.closest("[data-route]");
    if (!link || link.getAttribute("aria-disabled") === "true") return;
    event.preventDefault();
    const route = link.dataset.route;
    if (!views[route] && route !== "study") return;
    history.replaceState(null, "", `#${route}`);
    navigate(route);
  });

  window.addEventListener("lantern:school-course", () => {
    const host = document.querySelector("#school-course-host");
    if (!host) return;
    const course = document.querySelector("#hsk-course");
    const practice = document.querySelector("#picture-practice");
    if (course) host.append(course);
    if (practice) host.append(practice);
    mountHskCourse();
    window.dispatchEvent(new CustomEvent("lantern:school-course-ready"));
  });
  document.querySelector("#back-to-hsk").addEventListener("click", () => window.dispatchEvent(new CustomEvent("lantern:school-course")));

  window.addEventListener("hashchange", () => navigate(location.hash.slice(1)));

  const customize = document.querySelector("#customize-modal");
  const profileModal = document.querySelector("#profile-modal");
  const shareButton = document.querySelector("#share-worldmates");
  const shareStatus = document.querySelector("#share-status");
  const shareFallback = document.querySelector("#share-fallback");
  const shareUrlInput = document.querySelector("#share-url");
  shareButton?.addEventListener("click", async () => {
    const inviteUrl = `${location.origin}${import.meta.env.BASE_URL}`;
    shareStatus.textContent = "";
    shareFallback.hidden = true;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Worldmates", text: "Learn Chinese, explore the plaza, and share cultures in Worldmates.", url: inviteUrl });
        shareStatus.textContent = "Choose a friend in your share sheet to send the game.";
        return;
      }
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(inviteUrl);
      shareStatus.textContent = "Game link copied. Send it to a friend!";
    } catch (error) {
      if (error?.name === "AbortError") return;
      shareUrlInput.value = inviteUrl;
      shareFallback.hidden = false;
      shareStatus.textContent = "Sharing isn’t available here. Copy the game link below.";
    }
  });
  shareUrlInput?.addEventListener("focus", event => event.currentTarget.select());
  mountPlayerStats({
    totalElement: document.querySelector("#total-visitor-count"),
    onlineElement: document.querySelector("#online-player-count"),
    statusElement: document.querySelector("#player-count-status"),
  });
  mountAccount();
  document.querySelectorAll("[data-customize-open]").forEach(button => button.addEventListener("click", () => { history.replaceState(null, "", "#character"); navigate("character"); }));
  document.querySelectorAll("[data-customize-close]").forEach(button => button.addEventListener("click", () => { customize.hidden = true; }));
  document.querySelectorAll("[data-profile-open]").forEach(button => button.addEventListener("click", () => { profileModal.hidden = false; openProfilePreview(); }));
  document.querySelectorAll("[data-profile-close]").forEach(button => button.addEventListener("click", () => { profileModal.hidden = true; profilePreview?.setVisible(false); }));
  document.querySelectorAll("[data-avatar-color]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-avatar-color]").forEach(swatch => swatch.classList.toggle("selected", swatch === button));
  }));
  document.querySelector("#player-name-input").addEventListener("input", event => { event.target.dataset.edited = "true"; });
  document.querySelector("[data-customize-save]").addEventListener("click", () => {
    const name = document.querySelector("#player-name-input").value.trim().slice(0, 18) || "Little learner";
    const color = document.querySelector("[data-avatar-color].selected").dataset.avatarColor;
    updateProfile({ name, color });
    customize.hidden = true;
    document.querySelector("#player-name-input").dataset.edited = "";
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { customize.hidden = true; profileModal.hidden = true; profilePreview?.setVisible(false); }
  });

  function openProfilePreview() {
    let canvas = document.querySelector("#profile-avatar-canvas");
    if (!canvas) {
      const card = profileModal.querySelector(".profile-modal");
      const wrap = document.createElement("div"); wrap.className = "profile-3d-preview";
      canvas = document.createElement("canvas"); canvas.id = "profile-avatar-canvas"; canvas.setAttribute("aria-label", "Your current 3D avatar"); wrap.appendChild(canvas);
      card.querySelector("[data-player-name]").before(wrap);
    }
    if (!profilePreview) import("./components/Character/characterPreview.js").then(({ createCharacterPreview }) => {
      if (!profilePreview) profilePreview = createCharacterPreview(canvas, { onStatus: () => {} });
      profilePreview.setVisible(true);
    }); else profilePreview.setVisible(true);
  }

  function initializeCharacterStudio() {
    if (studioPromise) return studioPromise;
    studioPromise = Promise.all([import("./components/Character/characterPreview.js"), import("./utils/characterLoader.js")]).then(([previewModule, loaderModule]) => {
      const { createCharacterPreview } = previewModule;
      const { characterCatalog, hairColors, skinTones, eyeColors } = loaderModule;
      const characters = characterCatalog.freeCharacters;
      const status = document.querySelector("#character-preview-loading");
      const cards = document.querySelector("#character-card-grid");
      const hairStyles = document.querySelector("#hair-swatches");
      const skinStyles = document.querySelector("#skin-swatches");
      const eyeStyles = document.querySelector("#eye-swatches");
      const outfitSelect = document.querySelector("#appearance-outfit");
      const accessorySelect = document.querySelector("#appearance-accessory");
      const nameMap = { rose: "Rose", midnight: "Midnight", violet: "Violet", espresso: "Espresso", silver: "Silver", mint: "Mint", warm: "Warm", peach: "Peach", bronze: "Bronze", deep: "Deep", porcelain: "Porcelain", ocean: "Ocean", amber: "Amber", green: "Green" };
      const profile = window.LANTERN_PROFILE || null;
      draftAppearance = { characterId: "sakura-street", outfitId: "petal-pop", hairColor: "rose", skinTone: "warm", eyeColor: "ocean", accessoryId: "signature", ...(profile?.appearance || {}) };
      const playerProfile = () => {
        try { return JSON.parse(localStorage.getItem("little-lantern-player-v1") || "{}"); } catch { return {}; }
      };
      draftAppearance = { ...draftAppearance, ...(playerProfile().appearance || {}) };

      function currentCharacter() { return characters.find(item => item.id === draftAppearance.characterId) || characters[0]; }
      function colorFor(kind, value) { return ({ hair: hairColors, skin: skinTones, eyes: eyeColors }[kind] || {})[value] || "#bbb"; }
      function renderCards() {
        cards.innerHTML = characters.map(character => `<button class="character-card ${character.id === draftAppearance.characterId ? "selected" : ""}" type="button" data-character-id="${character.id}"><span class="character-card-swatch" style="--card-hair:${character.palette.hair};--card-cloth:${character.palette.top}"><i></i></span><span class="character-card-name">${character.name}</span><span class="character-card-meta">${character.presentation} · FREE</span></button>`).join("");
      }
      function renderOutfits() {
        const character = currentCharacter();
        outfitSelect.innerHTML = character.outfitOptions.map(outfit => `<option value="${outfit.id}" ${outfit.id === draftAppearance.outfitId ? "selected" : ""}>${outfit.name} · Free</option>`).join("");
        document.querySelector("#hair-style-caption").textContent = character.hairStyle;
      }
      function renderSwatches(container, kind, values, selected) {
        container.innerHTML = Object.entries(values).map(([key, color]) => `<button type="button" class="studio-swatch ${key === selected ? "selected" : ""}" style="--swatch:${color}" data-appearance-kind="${kind}" data-appearance-value="${key}" aria-label="${nameMap[key]}" title="${nameMap[key]}"></button>`).join("");
      }
      function renderOptions() {
        renderOutfits(); renderCards();
        renderSwatches(hairStyles, "hairColor", hairColors, draftAppearance.hairColor);
        renderSwatches(skinStyles, "skinTone", skinTones, draftAppearance.skinTone);
        renderSwatches(eyeStyles, "eyeColor", eyeColors, draftAppearance.eyeColor);
        accessorySelect.value = draftAppearance.accessoryId || "signature";
      }
      function showStatus(message, error = false) { status.hidden = false; status.innerHTML = error ? `<span>⚠ ${escapeHtml(message)}</span><button type="button" id="retry-character-load">Retry</button>` : `<span class="loader"></span><span>${escapeHtml(message)}</span>`; }
      studioPreview = createCharacterPreview(document.querySelector("#character-preview-canvas"), {
        characterId: draftAppearance.characterId,
        appearance: draftAppearance,
        onStatus: result => {
          if (result.state === "loading") showStatus(`Loading ${result.character}…`);
          else if (result.state === "ready") status.hidden = true;
            else if (result.state === "error") showStatus(`${result.character} model failed to load. Check the connection and try reloading.`, true);
        },
      });
      renderOptions();
      cards.addEventListener("click", event => {
        const button = event.target.closest("[data-character-id]"); if (!button) return;
        const character = characters.find(item => item.id === button.dataset.characterId); if (!character) return;
        draftAppearance = { ...draftAppearance, characterId: character.id, outfitId: character.outfitId, hairColor: ({"sakura-street":"rose","kai-blue":"midnight","violet-atelier":"espresso","juniper-tech":"espresso"})[character.id], accessoryId: "signature" };
        renderOptions(); studioPreview.setCharacter(character.id, draftAppearance);
      });
      document.querySelector("#character-view").addEventListener("click", event => {
        const swatch = event.target.closest("[data-appearance-kind]");
        if (swatch) { draftAppearance[swatch.dataset.appearanceKind] = swatch.dataset.appearanceValue; renderOptions(); studioPreview.setAppearance(draftAppearance); }
        const emote = event.target.closest("[data-preview-animation]"); if (emote) studioPreview.setAnimation(emote.dataset.previewAnimation);
        if (event.target.closest("#retry-character-load")) studioPreview.setCharacter(draftAppearance.characterId, draftAppearance);
      });
      outfitSelect.addEventListener("change", () => { draftAppearance.outfitId = outfitSelect.value; studioPreview.setAppearance(draftAppearance); });
      accessorySelect.addEventListener("change", () => { draftAppearance.accessoryId = accessorySelect.value; studioPreview.setAppearance(draftAppearance); });
      document.querySelector("#save-appearance").addEventListener("click", () => {
        updateProfile({ appearance: { ...draftAppearance }, color: currentCharacter().palette.top });
        document.querySelector("#studio-save-status").textContent = "Saved! This look is now shared with your profile and Social World.";
      });
      document.querySelector("#reset-appearance").addEventListener("click", () => {
        const character = currentCharacter();
        draftAppearance = { characterId: character.id, outfitId: character.outfitId, hairColor: ({"sakura-street":"rose","kai-blue":"midnight","violet-atelier":"espresso","juniper-tech":"espresso"})[character.id], skinTone: "warm", eyeColor: "ocean", accessoryId: "signature" };
        renderOptions(); studioPreview.setCharacter(character.id, draftAppearance);
        document.querySelector("#studio-save-status").textContent = "Look reset. Save appearance to keep it.";
      });
      document.querySelector("#studio-save-status").textContent = "Your appearance is saved on this device.";
    }).catch(error => {
      const status = document.querySelector("#character-preview-loading");
      status.hidden = false; status.textContent = `Character studio could not start: ${error.message}`;
    });
    return studioPromise;
  }

  function welcomeAppearance(characterId) {
    const defaults = {
      "sakura-street": { outfitId: "petal-pop", hairColor: "rose", eyeColor: "ocean" },
      "kai-blue": { outfitId: "skyline-bomber", hairColor: "midnight", eyeColor: "ocean" },
      "violet-atelier": { outfitId: "maid-pink", hairColor: "espresso", eyeColor: "green" },
      "juniper-tech": { outfitId: "pumpkin-classic", hairColor: "espresso", eyeColor: "amber" },
    };
    return { characterId, ...(defaults[characterId] || defaults["sakura-street"]), skinTone: "warm", accessoryId: "signature" };
  }

  function ensureWelcomeFlow() {
    if (welcomeFlowRoot) return welcomeFlowRoot;
    welcomeFlowRoot = document.createElement("div");
    welcomeFlowRoot.id = "welcome-flow";
    welcomeFlowRoot.className = "welcome-flow-backdrop";
    welcomeFlowRoot.hidden = true;
    document.body.append(welcomeFlowRoot);
    welcomeFlowRoot.addEventListener("click", event => {
      const choice = event.target.closest("[data-welcome-avatar]");
      if (choice) { welcomeDraftName = welcomeFlowRoot.querySelector("#welcome-player-name")?.value || welcomeDraftName; welcomeAvatarId = choice.dataset.welcomeAvatar; renderWelcomeFlow(); return; }
      if (event.target.closest("[data-welcome-skip]")) {
        if (!welcomeFlowReplay) updateProfile({ onboardingComplete: true, worldTutorialComplete: true });
        welcomeFlowRoot.hidden = true;
        welcomePreview?.setVisible(false);
        return;
      }
      if (event.target.closest("[data-welcome-back]")) { welcomeFlowStep = welcomeFlowStep === "explore" ? "controls" : "setup"; renderWelcomeFlow(); return; }
      if (event.target.closest("[data-welcome-next]")) {
        if (welcomeFlowStep === "setup") {
          const nameInput = welcomeFlowRoot.querySelector("#welcome-player-name");
          const name = String(welcomeDraftName || nameInput?.value || "").trim().slice(0, 18);
          const status = welcomeFlowRoot.querySelector("[data-welcome-status]");
          if (name.length < 2) { if (status) status.textContent = "Enter a name with at least 2 letters, or choose Skip for now."; nameInput?.focus(); return; }
          const character = characterData.freeCharacters.find(item => item.id === welcomeAvatarId) || characterData.freeCharacters[0];
          updateProfile({ name, color: character.palette.top, appearance: welcomeAppearance(character.id) });
          welcomeFlowStep = "controls";
        } else if (welcomeFlowStep === "controls") welcomeFlowStep = "explore";
        else {
          updateProfile({ onboardingComplete: true, worldTutorialComplete: true });
          welcomeFlowRoot.hidden = true;
          welcomePreview?.setVisible(false);
          if (!welcomeFlowReplay) { history.replaceState(null, "", "#world"); navigate("world"); }
          welcomeFlowReplay = false;
          return;
        }
        renderWelcomeFlow();
      }
    });
    welcomeFlowRoot.addEventListener("input", event => {
      if (event.target.id === "welcome-player-name") welcomeDraftName = event.target.value;
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !welcomeFlowRoot.hidden) {
        if (!welcomeFlowReplay) updateProfile({ onboardingComplete: true, worldTutorialComplete: true });
        welcomeFlowRoot.hidden = true;
        welcomePreview?.setVisible(false);
      }
    });
    return welcomeFlowRoot;
  }

  function renderWelcomeFlow() {
    const root = ensureWelcomeFlow(), profile = getProfile();
    welcomePreview?.dispose(); welcomePreview = null;
    const steps = { setup: 1, controls: 2, explore: 3 };
    const step = steps[welcomeFlowStep] || 1;
    const names = { "sakura-street": "Mira", "kai-blue": "Kai", "violet-atelier": "Maid", "juniper-tech": "Jack" };
    const content = welcomeFlowStep === "setup" ? `<p class="welcome-flow-kicker">YOUR WORLDMATES JOURNEY</p><h2>First, create your explorer</h2><p class="welcome-flow-copy">Pick a name and a starter avatar. You can change your look later in Character Studio.</p><label class="welcome-name-label" for="welcome-player-name">Player name</label><input id="welcome-player-name" maxlength="18" minlength="2" autocomplete="nickname" placeholder="At least 2 letters" value="${escapeHtml(welcomeDraftName)}" /><div class="welcome-avatar-layout"><div><p class="welcome-avatar-label">Choose your avatar</p><div class="welcome-avatar-grid">${characterData.freeCharacters.map(character => `<button type="button" class="welcome-avatar-choice ${character.id === welcomeAvatarId ? "selected" : ""}" data-welcome-avatar="${escapeHtml(character.id)}" style="--avatar-hair:${escapeHtml(character.palette.hair)};--avatar-clothes:${escapeHtml(character.palette.top)}"><span class="welcome-avatar-art" aria-hidden="true"><i></i></span><b>${names[character.id] || escapeHtml(character.name)}</b><small>${escapeHtml(character.presentation)} · free</small></button>`).join("")}</div></div><div class="welcome-avatar-preview"><canvas id="welcome-avatar-canvas" aria-label="Selected 3D avatar preview"></canvas><span id="welcome-avatar-loading" role="status">Loading your 3D avatar…</span></div></div><p class="welcome-flow-status" data-welcome-status role="status"></p><button class="welcome-flow-primary" data-welcome-next>Save and learn how to play <span>→</span></button>` : welcomeFlowStep === "controls" ? `<p class="welcome-flow-kicker">QUICK GUIDE · ${step}/3</p><h2>Move around the world</h2><p class="welcome-flow-copy">On a computer, use <b>W A S D</b> to walk, <b>Shift</b> to run, and <b>Space</b> to jump. On a phone, drag the left joystick; drag the world to look around.</p><div class="welcome-tip-card"><span>🎮</span><b>Easy to take over</b><small>Use the map or school quest button to get a walking route. Touch the joystick any time to stop auto-walking.</small></div><button class="welcome-flow-back" data-welcome-back>← Back to avatar</button><button class="welcome-flow-primary" data-welcome-next>Next: explore and interact <span>→</span></button>` : `<p class="welcome-flow-kicker">QUICK GUIDE · ${step}/3</p><h2>Explore, learn, and earn</h2><p class="welcome-flow-copy">Walk near a glowing place and tap <b>Explore</b> (or press <b>E</b>). At a house, choose <b>Open door &amp; enter</b>.</p><div class="welcome-tip-card"><span>🎒</span><b>Your first school day</b><small>Follow the mission card: register for class, study 8 words, pass the exam, then order lunch in Chinese. Earn XP, coins, a badge, and the Campus Library.</small></div><button class="welcome-flow-back" data-welcome-back>← Back to controls</button><button class="welcome-flow-primary" data-welcome-next>${welcomeFlowReplay ? "Done" : "Enter Worldmates"} <span>→</span></button>`;
    root.innerHTML = `<section class="welcome-flow-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-flow-title"><button class="welcome-flow-skip" type="button" data-welcome-skip>${welcomeFlowReplay ? "Close" : "Skip"}</button><div class="welcome-flow-progress" aria-label="Step ${step} of 3">${[1, 2, 3].map(value => `<i class="${value <= step ? "active" : ""}"></i>`).join("")}</div><span class="welcome-flow-mark">友</span><h1 class="welcome-flow-title" id="welcome-flow-title">Welcome to Worldmates</h1>${content}</section>`;
    root.hidden = false;
    if (welcomeFlowStep === "setup") {
      const canvas = root.querySelector("#welcome-avatar-canvas"), loading = root.querySelector("#welcome-avatar-loading"), characterId = welcomeAvatarId;
      import("./components/Character/characterPreview.js").then(({ createCharacterPreview }) => {
        if (!canvas.isConnected || welcomeAvatarId !== characterId || welcomeFlowStep !== "setup") return;
        welcomePreview = createCharacterPreview(canvas, { characterId, appearance: welcomeAppearance(characterId), cameraDistance: 4.3, onStatus: result => {
          if (!loading?.isConnected) return;
          loading.textContent = result.state === "ready" ? `${names[characterId] || "Avatar"} is ready` : result.state === "error" ? "Preview unavailable; your avatar will still load in the world." : `Loading ${names[characterId] || "avatar"}…`;
          loading.classList.toggle("is-ready", result.state === "ready");
        } });
      }).catch(() => { if (loading?.isConnected) loading.textContent = "Preview unavailable; your avatar will still load in the world."; });
    }
  }

  function startWelcomeFlow(step = "setup", replay = false) {
    welcomeFlowStep = step; welcomeFlowReplay = replay;
    const profile = getProfile();
    welcomeAvatarId = profile.appearance?.characterId || "sakura-street";
    welcomeDraftName = profile.name === "Little learner" ? "" : profile.name;
    renderWelcomeFlow();
  }

  function maybeStartWelcomeFlow() {
    const profile = getProfile();
    const freshPlayer = profile.name === "Little learner" && profile.xp === 0 && profile.lessons === 0 && !profile.classroomEnrollment;
    if (!profile.onboardingComplete && freshPlayer) startWelcomeFlow("setup", false);
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-tutorial-replay]")) startWelcomeFlow("controls", true);
  });

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(error => console.warn("Little Lantern offline support could not start.", error));
  }

  navigate(location.hash.slice(1) || "home");
  maybeStartWelcomeFlow();
})();
