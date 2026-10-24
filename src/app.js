import { rewardStudyAnswer, updateProfile } from "./profile.js";
import { questions } from "./questions.js";
import characterData from "./data/characters.json";
import "./hsk.css";
import "./hsk.css";

(() => {
  "use strict";

  const views = { home: document.querySelector("#home-view"), study: document.querySelector("#study-view"), world: document.querySelector("#world-view"), character: document.querySelector("#character-view") };
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

  function navigate(route) {
    const next = views[route] ? route : "home";
    Object.entries(views).forEach(([name, element]) => {
      element.classList.toggle("active", name === next);
      element.setAttribute("aria-hidden", name !== next ? "true" : "false");
    });
    document.querySelectorAll(".nav-link[data-route]").forEach(link => link.classList.toggle("active", link.dataset.route === next));
    crumb.textContent = next.toUpperCase();
    if (next === "study") {
      document.querySelector("#picture-practice").hidden = true;
      document.querySelector("#hsk-course").hidden = false;
      if (!hskCourseReady && !hskCoursePending) {
        hskCoursePending = true;
        import("./hsk1.js").then(({ mountHsk1Course }) => {
          hskCoursePending = false;
          hskCourseReady = true;
          mountHsk1Course(document.querySelector("#hsk-course"));
        }).catch(error => {
          hskCoursePending = false;
          document.querySelector("#hsk-course").innerHTML = `<div class="error-state"><p>We couldn’t load the HSK 1 course.</p><p>${escapeHtml(error.message)}</p><button class="retry-btn" type="button" onclick="location.reload()">Try again</button></div>`;
        });
      }
    }
    if (studioPreview) studioPreview.setVisible(next === "character");
    if (next === "character") initializeCharacterStudio();
    if (next === "world" && !world && !worldPending) {
      worldPending = true;
      import("./world.js").then(({ createWorld }) => {
        worldPending = false;
        if (views.world.classList.contains("active") && !world) world = createWorld(document.querySelector("#world-canvas"));
      }).catch(error => {
        worldPending = false;
        const interaction = document.querySelector("#world-interaction");
        interaction.hidden = false;
        interaction.innerHTML = `<button class="interaction-close" aria-label="Close">×</button><h2>World could not start</h2><p>${escapeHtml(error.message)}</p><p>Try a browser with WebGL enabled.</p>`;
        interaction.querySelector(".interaction-close").addEventListener("click", () => { interaction.hidden = true; });
      });
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
    const link = event.target.closest("[data-route]");
    if (!link || link.getAttribute("aria-disabled") === "true") return;
    event.preventDefault();
    const route = link.dataset.route;
    if (!views[route]) return;
    history.replaceState(null, "", `#${route}`);
    navigate(route);
  });

  window.addEventListener("hashchange", () => navigate(location.hash.slice(1)));

  const customize = document.querySelector("#customize-modal");
  const profileModal = document.querySelector("#profile-modal");
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

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(error => console.warn("Little Lantern offline support could not start.", error));
  }

  navigate(location.hash.slice(1) || "home");
})();
