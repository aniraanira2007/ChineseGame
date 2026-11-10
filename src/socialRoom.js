import * as THREE from "three";
import { supabaseClient } from "./supabaseClient.js";
import { getProfile } from "./profile.js";
import { createCharacter, freeOutfits, hairColors, skinTones, eyeColors } from "./utils/characterLoader.js";
import characterCatalog from "./data/characters.json";

const BLOCK_KEY = "worldmates-chat-blocked-v1";
const MUTE_KEY = "worldmates-chat-muted-v1";
const MAX_MESSAGE_LENGTH = 280;
const allowedCharacterIds = new Set(characterCatalog.freeCharacters.map(character => character.id));
const allowedOutfits = new Set(Object.keys(freeOutfits));
const allowedRooms = new Set(["plaza", "classroom", "teahouse", "library", "home", "food", "dumpling", "cafe", "museum", "studio", "garden", "culture-house", "gym", "restaurant", "math-house", "coffee-house"]);
const voiceEnabledByConfig = import.meta.env.VITE_VOICE_ENABLED === "true";
const h = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function readSet(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return new Set(Array.isArray(value) ? value.filter(item => typeof item === "string") : []); }
  catch { return new Set(); }
}

/** Mounts signed-in, real-time plaza chat. Presence is opt-in; it never creates sample players. */
export function mountSocialRoom(root, { scene = null, getPlayerState = () => null } = {}) {
  if (!root || root.dataset.socialMounted) return () => {};
  root.dataset.socialMounted = "true";
  const status = root.querySelector("[data-social-status]");
  const form = root.querySelector("[data-chat-form]");
  const input = root.querySelector("[data-chat-input]");
  const list = root.querySelector("[data-chat-messages]");
  const players = root.querySelector("[data-social-players]");
  const joinToggle = root.querySelector("[data-social-presence]");
  const voiceToggle = root.querySelector("[data-voice-toggle]");
  const voiceStatus = root.querySelector("[data-voice-status]");
  const worldStatus = document.querySelector("#social-world-status");
  const blocked = readSet(BLOCK_KEY);
  const muted = readSet(MUTE_KEY);
  const messages = [];
  const client = supabaseClient;
  let session = null;
  let channel = null;
  let disposed = false;
  let subscribed = false;
  let authSubscription = null;
  let lastReportAt = 0;
  let lastMessageAt = 0;
  const remotePlayers = new Map();
  let lastMovementAt = 0;
  let isVisible = true;
  const voiceRetryAfter = new Map();
  let localStream = null;
  let voiceEnabled = false;
  const voicePeers = new Map();

  function voiceMessage(message) { if (voiceStatus) voiceStatus.textContent = message; }

  function sendSignal(targetId, signal) {
    if (!channel || !session) return;
    channel.send({ type: "broadcast", event: "rtc", payload: { from: session.user.id, to: targetId, ...signal } }).catch(() => {});
  }

  function isVoiceNearby(userId) {
    const remote = remotePlayers.get(userId), local = getPlayerState();
    if (!remote || !local || remote.room !== (local.room || "plaza")) return false;
    const dx = local.x - remote.target.x, dy = local.y - remote.target.y, dz = local.z - remote.target.z;
    return dx * dx + dy * dy + dz * dz <= 81;
  }

  function closeVoicePeer(userId) {
    const peer = voicePeers.get(userId);
    if (!peer) return;
    peer.connection.onicecandidate = null;
    peer.connection.ontrack = null;
    peer.connection.close();
    peer.audio?.remove();
    voicePeers.delete(userId);
  }

  function makeVoicePeer(userId) {
    if (!localStream || !voiceEnabled || blocked.has(userId) || voicePeers.has(userId)) return voicePeers.get(userId);
    const connection = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    const peer = { connection, audio: null, pendingIce: [], offerSent: false };
    voicePeers.set(userId, peer);
    localStream.getAudioTracks().forEach(track => connection.addTrack(track, localStream));
    connection.onicecandidate = event => { if (event.candidate) sendSignal(userId, { kind: "ice", candidate: event.candidate }); };
    connection.ontrack = event => {
      let audio = peer.audio;
      if (!audio) { audio = document.createElement("audio"); audio.autoplay = true; audio.playsInline = true; audio.dataset.voicePeer = userId; root.appendChild(audio); peer.audio = audio; }
      audio.srcObject = event.streams[0];
      audio.muted = muted.has(userId) || blocked.has(userId);
      audio.play().catch(() => voiceMessage("Tap the page once to allow audio playback."));
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed") { voiceRetryAfter.set(userId, Date.now() + 5000); closeVoicePeer(userId); }
      else if (connection.connectionState === "closed") closeVoicePeer(userId);
      else if (connection.connectionState === "connected") voiceMessage("Nearby voice is connected. Move away or press Stop to leave.");
    };
    return peer;
  }

  async function receiveSignal(payload) {
    if (!payload || payload.to !== session?.user?.id || !payload.from || payload.from === session.user.id || blocked.has(payload.from) || !isVoiceNearby(payload.from)) return;
    if (payload.kind === "offer" && (!voiceEnabled || !remotePlayers.has(payload.from))) return;
    const peer = makeVoicePeer(payload.from);
    if (!peer) return;
    const pc = peer.connection;
    try {
      if (payload.kind === "offer" && payload.description) {
        await pc.setRemoteDescription(payload.description);
        for (const candidate of peer.pendingIce.splice(0)) await pc.addIceCandidate(candidate);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(payload.from, { kind: "answer", description: pc.localDescription });
      } else if (payload.kind === "answer" && payload.description && !pc.remoteDescription) {
        await pc.setRemoteDescription(payload.description);
        for (const candidate of peer.pendingIce.splice(0)) await pc.addIceCandidate(candidate);
      } else if (payload.kind === "ice" && payload.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
        else peer.pendingIce.push(payload.candidate);
      }
    } catch (error) {
      console.warn("Worldmates voice connection could not negotiate.", error);
      voiceRetryAfter.set(payload.from, Date.now() + 5000);
      closeVoicePeer(payload.from);
    }
  }

  async function stopVoice(message = "Voice is off.") {
    voiceEnabled = false;
    for (const userId of [...voicePeers.keys()]) closeVoicePeer(userId);
    voiceRetryAfter.clear();
    localStream?.getTracks().forEach(track => track.stop());
    localStream = null;
    if (voiceToggle) voiceToggle.textContent = "Start nearby voice";
    voiceMessage(message);
  }

  async function startVoice() {
    if (!voiceEnabledByConfig) {
      voiceMessage("Voice is disabled until the project has a secure TURN service and has passed a voice safety test."); return;
    }
    if (!session || !channel || !navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      voiceMessage("This browser or connection does not support voice here."); return;
    }
    if (!isVisible) { voiceMessage("Open the Social World before joining voice."); return; }
    voiceToggle.disabled = true;
    voiceMessage("Waiting for microphone permission…");
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      voiceEnabled = true;
      if (joinToggle && !joinToggle.checked) { joinToggle.checked = true; await trackPresence(); }
      voiceToggle.textContent = "Stop nearby voice";
      voiceMessage("Mic on. Nearby opted-in players within 9 world units can hear you.");
      updateVoicePeers();
    } catch (error) {
      await stopVoice(error?.name === "NotAllowedError" ? "Microphone access was denied. Voice stays off." : "Could not start the microphone. Check browser permission and try again.");
    } finally { if (voiceToggle) voiceToggle.disabled = false; }
  }

  function updateVoicePeers() {
    if (!voiceEnabled || !localStream || !session) return;
    const local = getPlayerState();
    if (!local) return;
    for (const [userId, remote] of remotePlayers) {
      const dx = local.x - remote.target.x, dy = local.y - remote.target.y, dz = local.z - remote.target.z;
      const nearby = remote.room === (local.room || "plaza") && dx * dx + dy * dy + dz * dz <= 81;
      if (!nearby || blocked.has(userId)) { closeVoicePeer(userId); continue; }
      if (Date.now() < (voiceRetryAfter.get(userId) || 0)) continue;
      if (session.user.id.localeCompare(userId) < 0) {
        const peer = makeVoicePeer(userId);
        if (peer?.offerSent && !peer.connection.remoteDescription && Date.now() - peer.offerAt > 8000) { voiceRetryAfter.set(userId, Date.now() + 5000); closeVoicePeer(userId); continue; }
        if (peer && !peer.offerSent) {
          peer.offerSent = true;
          peer.offerAt = Date.now();
          peer.connection.createOffer().then(offer => peer.connection.setLocalDescription(offer)).then(() => sendSignal(userId, { kind: "offer", description: peer.connection.localDescription })).catch(error => {
            console.warn("Worldmates voice offer failed.", error); voiceRetryAfter.set(userId, Date.now() + 5000); closeVoicePeer(userId);
          });
        }
      }
    }
    for (const userId of [...voicePeers.keys()]) if (!remotePlayers.has(userId)) closeVoicePeer(userId);
  }

  function disposeRemotes() { for (const userId of [...remotePlayers.keys()]) destroyRemote(userId); }

  function say(message, kind = "") {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function renderWorldStatus() {
    if (!worldStatus) return;
    const shared = Boolean(isVisible && subscribed && joinToggle?.checked);
    worldStatus.lastChild.textContent = shared ? " SHARED WORLD" : " SOLO WORLD";
    worldStatus.setAttribute("aria-label", shared ? "Shared multiplayer world" : "Single-player world");
  }

  function saveSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify([...value])); }
    catch { say("Your browser could not save this privacy choice.", "error"); }
  }

  function renderMessages() {
    if (!list) return;
    if (!messages.length) {
      list.innerHTML = '<p class="social-empty">No messages yet. Say ni hao to the plaza.</p>';
      return;
    }
    list.innerHTML = messages.slice(-40).map(message => {
      const own = message.userId === session?.user?.id;
      const hiddenByChoice = !own && (muted.has(message.userId) || blocked.has(message.userId));
      return `<article class="social-message"><b>${h(message.name)}${own ? " <small>(you)</small>" : ""}</b><time>${h(new Date(message.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</time><p>${hiddenByChoice ? "Message hidden by your mute or block setting." : h(message.text)}</p>${own ? "" : `<div class="social-message-tools"><button type="button" data-player-action="mute" data-player-id="${h(message.userId)}">${muted.has(message.userId) ? "Show chat" : "Mute chat"}</button><button type="button" data-player-action="block" data-player-id="${h(message.userId)}">${blocked.has(message.userId) ? "Unblock" : "Block"}</button><button type="button" data-player-action="report" data-player-id="${h(message.userId)}">Report</button></div>`}</article>`;
    }).join("");
    list.scrollTop = list.scrollHeight;
  }

  function renderPlayers() {
    if (!players || !channel || !session) return;
    const state = channel.presenceState();
    const uniqueRows = new Map();
    Object.values(state).flat().forEach(row => {
      if (row.userId && row.userId !== session.user.id && !blocked.has(row.userId) && !uniqueRows.has(row.userId)) uniqueRows.set(row.userId, row);
    });
    const rows = [...uniqueRows.values()];
    syncRemotePlayers(rows);
    players.innerHTML = rows.length ? rows.map(row => `<div class="social-player"><span class="social-player-dot"></span><b>${h(row.name || "Worldmate")}</b><div><button type="button" data-player-action="mute" data-player-id="${h(row.userId)}">${muted.has(row.userId) ? "Show chat" : "Mute chat"}</button><button type="button" data-player-action="block" data-player-id="${h(row.userId)}">${blocked.has(row.userId) ? "Unblock" : "Block"}</button><button type="button" data-player-action="report" data-player-id="${h(row.userId)}">Report</button></div></div>`).join("") : '<p class="social-empty">No other signed-in players have chosen to appear here.</p>';
  }

  function safeAppearance(value) {
    const candidate = value && typeof value === "object" ? value : {};
    return {
      characterId: allowedCharacterIds.has(candidate.characterId) ? candidate.characterId : "sakura-street",
      outfitId: typeof candidate.outfitId === "string" && allowedOutfits.has(candidate.outfitId) ? candidate.outfitId : "teal-traveler",
      hairColor: typeof candidate.hairColor === "string" && candidate.hairColor in hairColors ? candidate.hairColor : "espresso",
      skinTone: typeof candidate.skinTone === "string" && candidate.skinTone in skinTones ? candidate.skinTone : "warm",
      eyeColor: typeof candidate.eyeColor === "string" && candidate.eyeColor in eyeColors ? candidate.eyeColor : "green",
      accessoryId: candidate.accessoryId === "none" ? "none" : "signature",
    };
  }

  function makeNameplate(name) {
    const canvas = document.createElement("canvas");
    canvas.width = 384; canvas.height = 96;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgba(31, 48, 40, .82)";
    context.beginPath();
    if (context.roundRect) context.roundRect(8, 8, 368, 80, 30); else context.rect(8, 8, 368, 80);
    context.fill();
    context.fillStyle = "#ffffff"; context.font = "bold 38px system-ui, sans-serif"; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(String(name || "Worldmate").slice(0, 18), 192, 49, 330);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.userData.nameplate = true;
    sprite.scale.set(2.3, 0.58, 1); sprite.position.set(0, 2.58, 0);
    return sprite;
  }

  function destroyRemote(userId) {
    const remote = remotePlayers.get(userId);
    if (!remote) return;
    if (remote.avatar) {
      const root = remote.avatar.root;
      remote.avatar.dispose();
      root.traverse(item => { (Array.isArray(item.material) ? item.material : item.material ? [item.material] : []).forEach(material => material.dispose()); });
    }
    if (remote.wrapper) {
      scene?.remove(remote.wrapper);
      remote.wrapper.traverse(item => { if (item.userData.nameplate && item.material) { item.material.map?.dispose(); item.material.dispose(); } });
    }
    remotePlayers.delete(userId);
  }

  function syncRemotePlayers(rows) {
    if (!scene || !session) return;
    const activeIds = new Set();
    rows.slice(0, 8).forEach(row => {
      if (!row.userId || row.userId === session.user.id || blocked.has(row.userId)) return;
      activeIds.add(row.userId);
      const appearance = safeAppearance(row.appearance);
      let remote = remotePlayers.get(row.userId);
      if (!remote || remote.characterId !== appearance.characterId) {
        if (remote) destroyRemote(row.userId);
        const wrapper = new THREE.Group();
        const avatar = createCharacter({ characterId: appearance.characterId, appearance, playerIdentity: row.name || "Worldmate" });
        avatar.root.scale.setScalar(0.92 * (avatar.root.userData.renderScale || 1));
        wrapper.add(avatar.root, makeNameplate(row.name)); scene.add(wrapper);
        wrapper.traverse(object => { for (let layer = 1; layer <= 15; layer++) object.layers.enable(layer); });
        remote = { wrapper, avatar, characterId: appearance.characterId, target: new THREE.Vector3(), yaw: Number(row.yaw) || 0, room: row.room || "plaza", animation: "idle", name: row.name || "Worldmate" };
        remotePlayers.set(row.userId, remote);
      } else {
        const nextName = String(row.name || "Worldmate").slice(0, 18);
        if (nextName !== remote.name) {
          const oldLabel = remote.wrapper.children.find(item => item.userData.nameplate);
          if (oldLabel) { remote.wrapper.remove(oldLabel); oldLabel.material.map?.dispose(); oldLabel.material.dispose(); }
          remote.wrapper.add(makeNameplate(nextName));
        }
        remote.name = nextName;
        remote.avatar.updateAppearance(appearance);
      }
      const position = row.position || {};
      if ([position.x, position.y, position.z].every(Number.isFinite)) remote.target.set(THREE.MathUtils.clamp(position.x, -70, 70), THREE.MathUtils.clamp(position.y, 0, 6), THREE.MathUtils.clamp(position.z, -70, 70));
      remote.yaw = Number.isFinite(row.yaw) ? row.yaw : remote.yaw;
      remote.room = allowedRooms.has(row.room) ? row.room : "plaza";
      remote.animation = String(row.animation || "idle").toLowerCase();
    });
    for (const id of remotePlayers.keys()) if (!activeIds.has(id)) destroyRemote(id);
  }

  function updateRemotePlayers(delta) {
    const local = getPlayerState();
    for (const remote of remotePlayers.values()) {
      const sameRoom = local && remote.room === (local.room || "plaza");
      remote.wrapper.visible = Boolean(isVisible && sameRoom);
      if (!sameRoom) continue;
      remote.wrapper.position.lerp(remote.target, 1 - Math.exp(-12 * Math.min(delta, 0.05)));
      const difference = Math.atan2(Math.sin(remote.yaw - remote.wrapper.rotation.y), Math.cos(remote.yaw - remote.wrapper.rotation.y));
      remote.wrapper.rotation.y += difference * (1 - Math.exp(-12 * Math.min(delta, 0.05)));
      if (remote.avatar.animation !== remote.animation) remote.avatar.setAnimation(remote.animation);
      remote.avatar.update(Math.min(delta, 0.05));
    }
    updateVoicePeers();
  }

  async function leaveChannel() {
    subscribed = false;
    await stopVoice("Voice stopped because the plaza connection changed.");
    renderWorldStatus();
    const old = channel;
    channel = null;
    disposeRemotes();
    if (old && client) await client.removeChannel(old);
    if (players) players.innerHTML = '<p class="social-empty">Connect to the plaza to see opted-in players.</p>';
  }

  async function joinChannel(nextSession) {
    if (disposed || !client || !nextSession?.user) {
      session = null;
      messages.length = 0;
      renderMessages();
      await leaveChannel();
      form?.querySelectorAll("input,button").forEach(control => { control.disabled = true; });
      if (joinToggle) joinToggle.disabled = true;
      if (voiceToggle) voiceToggle.disabled = true;
      say(client ? "Sign in from your profile to use plaza chat." : "Chat needs the Supabase connection and SQL setup.", "error");
      return;
    }
    if (session?.user?.id === nextSession.user.id && channel) return;
    await leaveChannel();
    messages.length = 0;
    renderMessages();
    session = nextSession;
    form?.querySelectorAll("input,button").forEach(control => { control.disabled = false; });
    if (joinToggle) joinToggle.disabled = false;
    if (voiceToggle) voiceToggle.disabled = !voiceEnabledByConfig;
    if (voiceToggle) voiceToggle.textContent = voiceEnabledByConfig ? "Start nearby voice" : "Voice not ready";
    if (!voiceEnabledByConfig) voiceMessage("Voice is not enabled yet. The project needs secure voice server setup and testing.");
    say("Connecting to the shared plaza…");
    channel = client.channel("worldmates:plaza", {
      config: { private: true, presence: { key: nextSession.user.id }, broadcast: { self: false } },
    });
    channel
      .on("presence", { event: "sync" }, renderPlayers)
      .on("presence", { event: "join" }, renderPlayers)
      .on("presence", { event: "leave" }, renderPlayers)
      .on("broadcast", { event: "move" }, ({ payload }) => {
        if (!payload || payload.userId === session?.user?.id || blocked.has(payload.userId)) return;
        const remote = remotePlayers.get(payload.userId);
        if (!remote) return;
        const position = payload.position || {};
        if ([position.x, position.y, position.z].every(Number.isFinite)) remote.target.set(THREE.MathUtils.clamp(position.x, -70, 70), THREE.MathUtils.clamp(position.y, 0, 6), THREE.MathUtils.clamp(position.z, -70, 70));
        if (Number.isFinite(payload.yaw)) remote.yaw = payload.yaw;
        if (allowedRooms.has(payload.room)) remote.room = payload.room;
        if (["idle", "walk", "run", "jump", "land", "wave", "sit", "dance", "celebrate"].includes(payload.animation)) remote.animation = payload.animation;
      })
      .on("broadcast", { event: "rtc" }, ({ payload }) => { receiveSignal(payload); })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        if (!payload || payload.userId === session?.user?.id || typeof payload.text !== "string" || payload.text.length > MAX_MESSAGE_LENGTH) return;
        messages.push({ userId: payload.userId, name: String(payload.name || "Worldmate").slice(0, 18), text: payload.text, sentAt: payload.sentAt || new Date().toISOString() });
        renderMessages();
      })
      .subscribe(async state => {
        if (disposed || !channel) return;
        if (state === "SUBSCRIBED") {
          subscribed = true;
          say("Connected. Only signed-in players’ messages appear here.", "success");
          if (joinToggle?.checked) await trackPresence();
          renderPlayers();
          renderWorldStatus();
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(state)) {
          subscribed = false;
          say("Could not connect. Check the Supabase realtime SQL and your connection.", "error");
        }
      });
  }

  async function trackPresence() {
    if (!channel || !subscribed || !session) return;
    const profile = getProfile();
    const local = getPlayerState() || { x: 0, y: 0, z: 0, yaw: 0, room: "plaza", animation: "idle" };
    const result = await channel.track({
      userId: session.user.id, name: String(profile.name || "Worldmate").slice(0, 18),
      appearance: safeAppearance(profile.appearance),
      position: { x: local.x, y: local.y, z: local.z }, yaw: local.yaw, room: local.room || "plaza", animation: local.animation || "idle",
      joinedAt: new Date().toISOString(),
    });
    if (result !== "ok") say("Presence could not be shared. Chat may still work.", "error");
    renderWorldStatus();
  }

  function publish(timestamp) {
    if (!isVisible || !joinToggle?.checked || !subscribed || !channel || !session || timestamp - lastMovementAt < 150) return;
    lastMovementAt = timestamp;
    const local = getPlayerState();
    if (!local || ![local.x, local.y, local.z, local.yaw].every(Number.isFinite)) return;
    const result = channel.send({ type: "broadcast", event: "move", payload: {
      userId: session.user.id,
      position: { x: THREE.MathUtils.clamp(local.x, -70, 70), y: THREE.MathUtils.clamp(local.y, 0, 6), z: THREE.MathUtils.clamp(local.z, -70, 70) }, yaw: local.yaw,
      room: allowedRooms.has(local.room) ? local.room : "plaza",
      animation: ["idle", "walk", "run", "jump", "land", "wave", "sit", "dance", "celebrate"].includes(local.animation) ? local.animation : "idle",
    } });
    result.catch(() => say("Movement sync paused. Check the connection.", "error"));
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const text = input?.value.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!text || !channel || !subscribed || !session) return;
    if (Date.now() - lastMessageAt < 900) { say("Please wait a moment before sending another message.", "error"); return; }
    lastMessageAt = Date.now();
    const profile = getProfile();
    const message = { userId: session.user.id, name: String(profile.name || "Worldmate").slice(0, 18), text, sentAt: new Date().toISOString() };
    const result = await channel.send({ type: "broadcast", event: "chat", payload: message });
    if (result !== "ok") { say("Message could not send. Try again when the plaza reconnects.", "error"); return; }
    messages.push(message);
    input.value = "";
    renderMessages();
    say("Message sent.", "success");
  });

  joinToggle?.addEventListener("change", async () => {
    if (joinToggle.checked) await trackPresence();
    else {
      if (channel && subscribed) await channel.untrack();
      if (voiceEnabled) await stopVoice("Voice stopped because you hid your presence.");
    }
    renderWorldStatus();
    say(joinToggle.checked ? "You appear in the opted-in plaza list." : "You are hidden from the player list; chat remains available.", "success");
  });

  voiceToggle?.addEventListener("click", () => {
    if (voiceEnabled) stopVoice();
    else startVoice();
  });

  function onProfileUpdated() { if (joinToggle?.checked) trackPresence().catch(() => say("Your updated avatar could not sync yet.", "error")); }
  window.addEventListener("lantern:profile", onProfileUpdated);

  root.addEventListener("click", async event => {
    const button = event.target.closest("[data-player-action]");
    if (!button || !session) return;
    const userId = button.dataset.playerId;
    if (!userId || userId === session.user.id) return;
    const action = button.dataset.playerAction;
    if (action === "mute") {
      muted.has(userId) ? muted.delete(userId) : muted.add(userId);
      const voicePeer = voicePeers.get(userId);
      if (voicePeer?.audio) voicePeer.audio.muted = muted.has(userId);
      saveSet(MUTE_KEY, muted);
      renderMessages(); renderPlayers();
      say(muted.has(userId) ? "That player’s chat is hidden on this device." : "That player’s chat is visible again.", "success");
    } else if (action === "block") {
      blocked.has(userId) ? blocked.delete(userId) : blocked.add(userId);
      saveSet(BLOCK_KEY, blocked);
      if (blocked.has(userId)) destroyRemote(userId);
      if (blocked.has(userId)) closeVoicePeer(userId);
      renderMessages(); renderPlayers();
      say(blocked.has(userId) ? "That player is blocked on this device." : "That player is unblocked.", "success");
    } else if (action === "report") {
      if (Date.now() - lastReportAt < 5000) { say("Please wait a few seconds before sending another report.", "error"); return; }
      lastReportAt = Date.now();
      const { error } = await client.from("player_reports").insert({ reporter_id: session.user.id, reported_user_id: userId, room: "plaza", category: "chat", details: "Reported from the plaza chat controls." });
      if (error) { say("Report could not be saved. Run the Worldmates social SQL and try again.", "error"); return; }
      say("Report saved securely for the project owner to review. Thank you.", "success");
    }
  });

  if (!client) {
    say("Chat needs the Supabase connection and SQL setup.", "error");
    form?.querySelectorAll("input,button").forEach(control => { control.disabled = true; });
    if (joinToggle) joinToggle.disabled = true;
    if (voiceToggle) voiceToggle.disabled = true;
  } else {
    client.auth.getSession().then(({ data, error }) => {
      if (error) { say("Could not check your account. Sign in again from your profile.", "error"); return; }
      joinChannel(data.session);
    }).catch(() => say("Could not connect to accounts. Your local game remains available.", "error"));
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => { queueMicrotask(() => joinChannel(nextSession)); });
    authSubscription = data.subscription;
  }

  return {
    update: delta => updateRemotePlayers(delta),
    publish,
    setVisible(next) {
      isVisible = Boolean(next);
      if (!isVisible) { if (channel && subscribed) channel.untrack(); stopVoice("Voice stopped because you left the Social World."); }
      else if (isVisible && joinToggle?.checked) trackPresence();
      renderWorldStatus();
    },
    dispose() {
    disposed = true;
    stopVoice("Voice is off.");
    window.removeEventListener("lantern:profile", onProfileUpdated);
    authSubscription?.unsubscribe();
    disposeRemotes();
    leaveChannel();
    },
  };
}
