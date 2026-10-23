import * as THREE from "three";
import { createCharacter } from "../../utils/characterLoader.js";
import { getProfile } from "../../profile.js";

/** Lightweight reusable GLB preview scene for the studio and player profile. */
export function createCharacterPreview(canvas, { characterId, appearance, onStatus = () => {} } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#efe8df");
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 30);
  camera.position.set(0, 1.95, 7.2);
  camera.lookAt(0, 1.68, 0);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.4));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  scene.add(new THREE.HemisphereLight("#fff8f2", "#655b68", 2.2));
  const key = new THREE.DirectionalLight("#fff2de", 3.2); key.position.set(-3, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight("#b7ccf0", 1.8); rim.position.set(4, 3, -3); scene.add(rim);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.13, 1.18, 0.12, 48), new THREE.MeshStandardMaterial({ color: "#e3cfae", roughness: 0.74 }));
  plinth.position.y = 0.05; plinth.receiveShadow = true; scene.add(plinth);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 48), new THREE.MeshStandardMaterial({ color: "#e8ddd0", roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.03; scene.add(floor);

  let current = null, visible = true, disposed = false, frame = 0, previous = 0, dragging = false, oldX = 0;
  function setCharacter(nextId, nextAppearance = {}) {
    if (current) { current.dispose(); scene.remove(current.root); }
    const profile = getProfile();
    current = createCharacter({
      characterId: nextId || profile.appearance.characterId,
      playerIdentity: profile.name,
      appearance: { ...profile.appearance, ...nextAppearance },
      onStatus,
    });
    current.root.position.y = 0.08;
    current.root.scale.setScalar(0.98 * current.root.userData.renderScale);
    // The supplied GLB's front faces +Z, toward the preview camera.
    current.root.rotation.y = 0;
    scene.add(current.root);
    return current.ready;
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas.parentElement); resize();
  function animate(time) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    if (!visible) return;
    const delta = Math.min((time - previous) / 1000 || 0, 0.05); previous = time;
    current?.update(delta);
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  function down(e) { dragging = true; oldX = e.clientX; canvas.setPointerCapture(e.pointerId); }
  function move(e) { if (!dragging || !current) return; current.root.rotation.y += (e.clientX - oldX) * 0.009; oldX = e.clientX; }
  function up() { dragging = false; }
  canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  setCharacter(characterId, appearance);

  function dispose() {
    disposed = true; cancelAnimationFrame(frame); observer.disconnect();
    canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up);
    current?.dispose(); renderer.dispose();
  }
  return {
    setCharacter, setAnimation: state => current?.setAnimation(state), setAppearance: values => current?.updateAppearance(values),
    setVisible: value => { visible = value; previous = 0; }, dispose,
  };
}
