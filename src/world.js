import * as THREE from "three";
import { getProfile, rewardWorldVisit } from "./profile.js";
import { createCharacter } from "./utils/characterLoader.js";

export function createWorld(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#b9d9e6");
  scene.fog = new THREE.Fog("#b9d9e6", 42, 105);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 150);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  scene.add(new THREE.HemisphereLight("#e7f5ff", "#738862", 2));
  const sun = new THREE.DirectionalLight("#fff1d4", 3.1);
  sun.position.set(-13, 24, 11); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -35; sun.shadow.camera.right = 35; sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
  scene.add(sun);

  const mat = (color, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness });
  const materials = {
    grass: mat("#82ad76"), grassLight: mat("#9abb83"), road: mat("#737c84"), roadLine: mat("#f5d786"),
    wallCream: mat("#f1dfbd"), wallPink: mat("#e9b7a0"), wallMint: mat("#c5ddc4"), wallBlue: mat("#bfd5e5"),
    roofRed: mat("#bd634d"), roofDark: mat("#526f70"), roofOrange: mat("#d88d54"), wood: mat("#8b6246"),
    leaf: mat("#5d9668"), leafLight: mat("#81b87a"), trunk: mat("#826047"), stone: mat("#d8d0bd"),
    water: mat("#68b8c7", 0.26), white: mat("#fff6e6"), gold: mat("#e6ad52"),
  };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeo = new THREE.SphereGeometry(1, 12, 10);
  const coneGeo = new THREE.ConeGeometry(1, 1, 6);
  const cylinderGeo = new THREE.CylinderGeometry(0.78, 0.9, 1, 8);

  function block(x, y, z, sx, sy, sz, material, cast = true) {
    const mesh = new THREE.Mesh(boxGeo, material);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = cast; mesh.receiveShadow = true;
    scene.add(mesh); return mesh;
  }
  function sphere(x, y, z, scale, material) {
    const mesh = new THREE.Mesh(sphereGeo, material);
    mesh.position.set(x, y, z); mesh.scale.setScalar(scale); mesh.castShadow = true; scene.add(mesh); return mesh;
  }
  function tree(x, z, size = 1) {
    const trunk = new THREE.Mesh(cylinderGeo, materials.trunk);
    trunk.position.set(x, 0.85 * size, z); trunk.scale.set(0.36 * size, 1.7 * size, 0.36 * size); trunk.castShadow = true; scene.add(trunk);
    sphere(x, 2.15 * size, z, 1.2 * size, (Math.abs(x + z) % 2 > 1) ? materials.leafLight : materials.leaf);
    sphere(x - 0.6 * size, 1.95 * size, z + 0.15 * size, 0.73 * size, materials.leaf);
    sphere(x + 0.55 * size, 1.85 * size, z - 0.1 * size, 0.75 * size, materials.leafLight);
  }
  function building(x, z, width, depth, height, wall, roof, label, sign = "学") {
    block(x, height / 2, z, width, height, depth, wall);
    for (let i = -1; i <= 1; i++) {
      const wx = x + i * width * 0.27;
      block(wx, height * 0.56, z - depth / 2 - 0.025, width * 0.105, height * 0.26, 0.055, materials.wood);
      block(wx, height * 0.56, z - depth / 2 - 0.06, width * 0.075, height * 0.205, 0.03, materials.wallBlue);
    }
    block(x, 0.58, z - depth / 2 - 0.08, width * 0.18, 1.16, 0.18, materials.wood);
    block(x, 0.54, z - depth / 2 - 0.18, width * 0.14, 0.98, 0.035, materials.roofOrange);
    const roofMesh = new THREE.Mesh(coneGeo, roof);
    roofMesh.position.set(x, height + 0.72, z); roofMesh.scale.set(width * 0.78, 1.45, depth * 0.78); roofMesh.rotation.y = Math.PI / 4; roofMesh.castShadow = true; scene.add(roofMesh);
    block(x, height + 0.12, z, width * 1.14, 0.2, depth * 1.14, roof, false);
    // A bright sign above the entrance makes each destination readable at plaza scale.
    block(x, height * 0.68, z - depth / 2 - 0.12, Math.min(2.1, width * 0.65), 0.5, 0.11, materials.gold, false);
    const signCanvas = document.createElement("canvas"); signCanvas.width = 256; signCanvas.height = 64;
    const ctx = signCanvas.getContext("2d"); ctx.fillStyle = "#5c4230"; ctx.font = "bold 32px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${sign} ${label}`, 128, 34);
    const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace;
    const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(2.0, width * 0.6), 0.48), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true }));
    signBoard.position.set(x, height * 0.68, z - depth / 2 - 0.19); scene.add(signBoard);
  }

  block(0, -0.2, 0, 100, 0.35, 100, materials.grass, false);
  block(0, 0.005, 0, 10, 0.04, 82, materials.road, false);
  block(0, 0.03, 0, 0.12, 0.02, 82, materials.roadLine, false);
  block(0, 0.012, 0, 82, 0.035, 9, materials.road, false);
  block(0, 0.036, 0, 82, 0.025, 0.13, materials.roadLine, false);
  // Small plaza square and a reflecting pond anchor the walkable crossroads.
  block(0, 0.035, 0, 14, 0.07, 14, materials.stone, false);
  block(15, 0.11, 0, 9, 0.15, 6, materials.water, false);
  for (let i = -2; i <= 2; i++) {
    const pebble = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 8), materials.white);
    pebble.position.set(15 + i * 1.15, 0.23, 3.45); scene.add(pebble);
  }
  building(-17, -15, 11, 9, 5.6, materials.wallCream, materials.roofRed, "Classroom", "学");
  building(17, -15, 10, 9, 5.0, materials.wallPink, materials.roofOrange, "Tea House", "茶");
  building(-18, 16, 10, 9, 5.2, materials.wallMint, materials.roofDark, "Bookshop", "书");
  building(17, 16, 11, 9, 5.8, materials.wallBlue, materials.roofRed, "Garden Hall", "园");
  // Pavilion, lanterns, planters, and alternating street trees.
  block(-1, 1.7, -24, 7, 3.4, 6, materials.wood);
  const pavilionRoof = new THREE.Mesh(coneGeo, materials.roofRed); pavilionRoof.position.set(-1, 4.0, -24); pavilionRoof.scale.set(5, 1.4, 4.4); pavilionRoof.rotation.y = Math.PI / 4; scene.add(pavilionRoof);
  for (const [x, z] of [[-9, -8], [9, -8], [-9, 8], [9, 8], [-8, -26], [8, -26]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.6, 8), materials.gold); post.position.set(x, 1.1, z); scene.add(post);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: "#ffda83" })); glow.position.set(x, 2.05, z); scene.add(glow);
  }
  for (const [x, z, size] of [[-26,-26,1.2],[-29,-8,0.85],[-27,8,1],[-28,27,1.3],[-7,29,0.9],[8,29,1.2],[28,28,1],[29,8,1.25],[27,-7,0.9],[27,-27,1.2],[-10,-29,1]]) tree(x, z, size);
  // Flower patches bring color to the plaza paths.
  for (const [x, z] of [[-12,-1],[12,-1],[-2,12],[2,-12],[-22,1],[22,1]]) {
    const petal = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.18, 7), materials.gold); petal.position.set(x, 0.16, z); scene.add(petal);
  }

  function updateAvatarStatus({ state, error }) {
    let status = document.querySelector("#world-avatar-loading");
    if (!status) { status = document.createElement("div"); status.id = "world-avatar-loading"; status.className = "world-avatar-loading"; status.setAttribute("role", "status"); canvas.parentElement.appendChild(status); }
    if (state === "loading") { status.hidden = false; status.textContent = "Loading your avatar…"; }
    else if (state === "ready") { status.hidden = true; }
    else { status.hidden = false; status.textContent = "Your avatar model could not load. Please reload and try again."; status.title = error?.message || ""; }
  }
  const initialProfile = getProfile();
  let avatar = createCharacter({ characterId: initialProfile.appearance.characterId, outfitId: initialProfile.appearance.outfitId, appearance: initialProfile.appearance, playerIdentity: initialProfile.name, onStatus: updateAvatarStatus });
  let player = avatar.root;
  player.scale.setScalar(0.92 * player.userData.renderScale);
  scene.add(player);
  player.position.set(0, 0, 22);

  const landmarks = [
    { id: "classroom", name: "Chinese Classroom", x: -17, z: -8, icon: "学", detail: "A warm little classroom. Your Study Mode lesson is just through the portal.", action: "Enter Study Mode", route: "study", color: "#e3ad63" },
    { id: "teahouse", name: "Tea House", x: 17, z: -8, icon: "茶", detail: "Take a quiet break beside the tea house pond.", action: "Take a tea break", route: "reward", color: "#79a987" },
    { id: "bookshop", name: "Bookshop", x: -18, z: 9, icon: "书", detail: "A bookshop for curious readers. Browse your next adventure.", action: "Browse books", route: "reward", color: "#7a9abe" },
    { id: "garden", name: "Garden Hall", x: 17, z: 9, icon: "园", detail: "Pause among the garden flowers and enjoy the fresh air.", action: "Explore the garden", route: "reward", color: "#81a96e" },
    { id: "pavilion", name: "Friendship Pavilion", x: -1, z: -20, icon: "友", detail: "A peaceful meeting place. Shared rooms and real players will arrive with a multiplayer server.", action: "Look around", route: "reward", color: "#bd86a4" },
  ];
  const markers = [];
  for (const place of landmarks) {
    const markerMat = new THREE.MeshStandardMaterial({ color: place.color, emissive: place.color, emissiveIntensity: 0.22, transparent: true, opacity: 0.9 });
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), markerMat); orb.position.set(place.x, 2.2, place.z); orb.userData.place = place; scene.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.055, 6, 18), new THREE.MeshBasicMaterial({ color: place.color })); ring.position.set(place.x, 0.13, place.z); ring.rotation.x = -Math.PI / 2; scene.add(ring);
    markers.push({ orb, ring, place });
  }

  const keys = new Set();
  const heldTouch = new Set();
  const joystickVector = new THREE.Vector2();
  const joystick = document.querySelector("[data-touch-joystick]");
  const joystickKnob = document.querySelector("[data-joystick-knob]");
  let joystickPointerId = null;
  let yaw = 0, pitch = 0.22, dragging = false, previousX = 0, previousY = 0, velocityY = 0, grounded = true, landingTime = 0;
  let activePlace = null, activeEmote = null, activeEmoteTime = 0;
  let running = true;
  const dialog = document.querySelector("#world-interaction");

  function showPlace(place) {
    activePlace = place;
    dialog.hidden = false;
    dialog.innerHTML = `<button class="interaction-close" aria-label="Close">×</button><span class="interaction-icon">${place.icon}</span><p class="eyebrow">YOU FOUND A PLACE</p><h2>${escapeHtml(place.name)}</h2><p>${escapeHtml(place.detail)}</p><button class="primary-btn interaction-action">${escapeHtml(place.action)} <span>→</span></button>`;
    dialog.querySelector(".interaction-close").addEventListener("click", hidePlace);
    dialog.querySelector(".interaction-action").addEventListener("click", () => {
      if (place.route === "study") { window.location.hash = "study"; return; }
      if (rewardWorldVisit(place.id)) {
        dialog.querySelector(".interaction-action").textContent = "Lovely — +5 XP · +1 coin!";
        dialog.querySelector(".interaction-action").disabled = true;
      } else {
        dialog.querySelector(".interaction-action").textContent = "You’ve explored this spot ✧";
        dialog.querySelector(".interaction-action").disabled = true;
      }
    });
  }
  function hidePlace() { dialog.hidden = true; activePlace = null; }
  function escapeHtml(str) { return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  function openNearest() {
    if (activePlace) { hidePlace(); return; }
    let closest = null, best = 100;
    for (const { place } of markers) {
      const d = (player.position.x - place.x) ** 2 + (player.position.z - place.z) ** 2;
      if (d < best) { closest = place; best = d; }
    }
    if (closest && best < 18) showPlace(closest);
  }

  function onKeyDown(event) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    if (event.code === "KeyE" && !event.repeat) { openNearest(); return; }
    const emotes = { Digit1: "Wave", Digit2: "Sit", Digit3: "Dance", Digit4: "Celebrate" };
    if (emotes[event.code] && !event.repeat) { playEmote(emotes[event.code]); return; }
    keys.add(event.code);
  }
  function onKeyUp(event) { keys.delete(event.code); }
  function playEmote(name) { activeEmote = name; activeEmoteTime = name === "Dance" ? 2 : name === "Sit" ? 1.8 : name === "Wave" ? 1.2 : 1.1; avatar.setAnimation(name); }
  function moveJoystick(event) {
    const rect = joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) * 0.34);
    const dx = (event.clientX - (rect.left + rect.width / 2)) / radius;
    const dy = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const length = Math.hypot(dx, dy);
    const scale = length > 1 ? 1 / length : 1;
    const x = dx * scale, y = dy * scale;
    joystickVector.set(x, -y);
    joystickKnob.style.setProperty("--joystick-x", `${x * radius}px`);
    joystickKnob.style.setProperty("--joystick-y", `${y * radius}px`);
  }
  function releaseJoystick() {
    joystickPointerId = null;
    joystickVector.set(0, 0);
    joystickKnob?.style.setProperty("--joystick-x", "0px");
    joystickKnob?.style.setProperty("--joystick-y", "0px");
  }
  function pointerDown(event) { dragging = true; previousX = event.clientX; previousY = event.clientY; canvas.setPointerCapture(event.pointerId); }
  function pointerMove(event) {
    if (!dragging) return;
    yaw -= (event.clientX - previousX) * 0.005;
    pitch = THREE.MathUtils.clamp(pitch + (event.clientY - previousY) * 0.003, -0.05, 0.65);
    previousX = event.clientX; previousY = event.clientY;
  }
  function pointerUp() { dragging = false; }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.fov = rect.width < 600 ? 67 : 58;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas.parentElement);
  resize();
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  window.addEventListener("blur", () => { keys.clear(); heldTouch.clear(); releaseJoystick(); });
  window.addEventListener("lantern:profile", e => {
    const saved = e.detail;
    if (saved.appearance?.characterId && saved.appearance.characterId !== player.userData.characterId) {
      const position = player.position.clone();
      avatar.dispose(); scene.remove(player);
      avatar = createCharacter({ characterId: saved.appearance.characterId, appearance: saved.appearance, playerIdentity: saved.name, onStatus: updateAvatarStatus });
      player = avatar.root; player.scale.setScalar(0.92 * player.userData.renderScale); player.position.copy(position); scene.add(player);
    } else {
      avatar.updateAppearance(saved.appearance || {});
      avatar.root.userData.playerIdentity = saved.name;
    }
  });

  const emoteBar = document.createElement("div");
  emoteBar.className = "world-emotes";
  emoteBar.setAttribute("aria-label", "Avatar emotes");
  emoteBar.innerHTML = '<button data-world-emote="Wave">Wave</button><button data-world-emote="Sit">Sit</button><button data-world-emote="Dance">Dance</button><button data-world-emote="Celebrate">Celebrate</button>';
  canvas.parentElement.appendChild(emoteBar);
  emoteBar.addEventListener("click", event => { const button = event.target.closest("[data-world-emote]"); if (button) playEmote(button.dataset.worldEmote); });

  joystick.addEventListener("pointerdown", event => {
    event.preventDefault();
    joystickPointerId = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    moveJoystick(event);
  });
  joystick.addEventListener("pointermove", event => { if (event.pointerId === joystickPointerId) moveJoystick(event); });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => joystick.addEventListener(type, event => {
    if (event.pointerId === joystickPointerId) releaseJoystick();
  }));

  document.querySelectorAll("[data-move]").forEach(button => {
    const dir = button.dataset.move;
    if (dir === "interact") { button.addEventListener("click", openNearest); return; }
    const key = { forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD", run: "ShiftLeft", jump: "Space" }[dir];
    if (dir === "jump") { button.addEventListener("pointerdown", event => { event.preventDefault(); if (grounded) { velocityY = 7; grounded = false; } }); return; }
    button.addEventListener("pointerdown", e => { e.preventDefault(); heldTouch.add(key); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(name => button.addEventListener(name, () => heldTouch.delete(key)));
  });

  let previousTime = 0, frame = 0;
  function animate(time) {
    if (!running) return;
    const dt = Math.min((time - previousTime) / 1000 || 0, 0.04); previousTime = time;
    const forward = THREE.MathUtils.clamp(Number(keys.has("KeyW") || keys.has("ArrowUp") || heldTouch.has("KeyW")) - Number(keys.has("KeyS") || keys.has("ArrowDown") || heldTouch.has("KeyS")) + joystickVector.y, -1, 1);
    const side = THREE.MathUtils.clamp(Number(keys.has("KeyD") || keys.has("ArrowRight") || heldTouch.has("KeyD")) - Number(keys.has("KeyA") || keys.has("ArrowLeft") || heldTouch.has("KeyA")) + joystickVector.x, -1, 1);
    const runningFast = keys.has("ShiftLeft") || keys.has("ShiftRight") || heldTouch.has("ShiftLeft");
    if (keys.has("Space") && grounded) { velocityY = 7; grounded = false; }
    const speed = runningFast ? 8.6 : 4.7;
    const direction = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(direction.z, 0, -direction.x);
    const movement = direction.multiplyScalar(-forward).add(right.multiplyScalar(side));
    const inputStrength = Math.min(1, movement.length());
    if (inputStrength > 0) movement.normalize().multiplyScalar(speed * inputStrength);
    else movement.set(0, 0, 0);
    const horizontalVelocity = player.userData.horizontalVelocity || (player.userData.horizontalVelocity = new THREE.Vector3());
    horizontalVelocity.lerp(movement, 1 - Math.exp(-11 * dt));
    player.position.addScaledVector(horizontalVelocity, dt);
    if (horizontalVelocity.lengthSq() > 0.025) player.rotation.y = Math.atan2(horizontalVelocity.x, horizontalVelocity.z);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -42, 42);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -42, 42);
    velocityY -= 19 * dt; player.position.y += velocityY * dt;
    if (player.position.y <= 0) { player.position.y = 0; velocityY = 0; if (!grounded) landingTime = 0.34; grounded = true; }
    const cameraDistance = 6.8;
    const target = new THREE.Vector3(player.position.x, player.position.y + 1.2, player.position.z);
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * cameraDistance, target.y + 2.1 + Math.sin(pitch) * 4.5, target.z + Math.cos(yaw) * Math.cos(pitch) * cameraDistance);
    camera.lookAt(target.x, target.y + 0.35, target.z);
    markers.forEach(({ orb, ring }, i) => { orb.rotation.y += dt * 0.75; orb.position.y = 2.05 + Math.sin(time * 0.0015 + i) * 0.18; ring.material.opacity = 0.75 + Math.sin(time * 0.003 + i) * 0.2; });
    landingTime = Math.max(0, landingTime - dt);
    if (!grounded || horizontalVelocity.lengthSq() > 0.025) activeEmote = null;
    if (activeEmote) { activeEmoteTime -= dt; if (activeEmoteTime <= 0) activeEmote = null; }
    const nextAnimation = !grounded ? "Jump" : landingTime > 0 ? "Land" : activeEmote || (horizontalVelocity.lengthSq() > 0.12 ? (runningFast ? "Run" : "Walk") : "Idle");
    if (avatar.animation !== nextAnimation.toLowerCase()) avatar.setAnimation(nextAnimation);
    avatar.update(dt);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);

  function dispose() {
    running = false; cancelAnimationFrame(frame); resizeObserver.disconnect();
    window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
    canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointermove", pointerMove); canvas.removeEventListener("pointerup", pointerUp);
    renderer.dispose(); scene.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); if (obj.material && !Array.isArray(obj.material)) obj.material.dispose(); });
  }
  return { dispose, showNearest: openNearest };
}
