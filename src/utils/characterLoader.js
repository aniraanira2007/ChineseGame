import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { clone as cloneSkinnedScene } from "three/addons/utils/SkeletonUtils.js";
import catalog from "../data/characters.json";
import mageModelUrl from "../assets/models/characters/anime-female-mage/anime_female_mage.glb?url";
import kaiAnimeBoyModelUrl from "../assets/models/characters/kai-anime-boy.vrm?url";
import headTextureUrl from "../assets/models/characters/anime-female-mage/textures/head_color.webp?url";
import bodyTextureUrl from "../assets/models/characters/anime-female-mage/textures/body_color.webp?url";
import eyesTextureUrl from "../assets/models/characters/anime-female-mage/textures/eyes_color.webp?url";
import hairTextureUrl from "../assets/models/characters/anime-female-mage/textures/hair_color.webp?url";
import outfitTextureUrl from "../assets/models/characters/anime-female-mage/textures/outfit_color.webp?url";

const loader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const textureLoader = new THREE.TextureLoader();
const assetCache = new Map();
let mageTexturePromise;
let maidTexturePromise;
const catalogById = new Map(catalog.freeCharacters.map(character => [character.id, character]));
const maidModelUrl = "/assets/models/characters/maid/Maid.fbx";
const pumpkinModelUrl = "/assets/models/characters/jack-pumpkin/Jack.fbx";
const modelUrls = { "sakura-street": mageModelUrl, "kai-blue": kaiAnimeBoyModelUrl, "violet-atelier": maidModelUrl, "juniper-tech": pumpkinModelUrl };
const toonGradient = new THREE.DataTexture(new Uint8Array([105,105,105, 176,176,176, 255,255,255]), 3, 1, THREE.RGBFormat);
toonGradient.minFilter = THREE.NearestFilter;
toonGradient.magFilter = THREE.NearestFilter;
toonGradient.generateMipmaps = false;
toonGradient.needsUpdate = true;

function modelUrl(characterId) {
  const character = catalogById.get(characterId);
  if (!character) throw new Error(`Unknown character: ${characterId}`);
  const url = modelUrls[characterId];
  if (!url) throw new Error(`No bundled model URL for ${character.name}`);
  return url;
}

function loadMageTextures() {
  if (!mageTexturePromise) {
    const files = { head: headTextureUrl, body: bodyTextureUrl, eyes: eyesTextureUrl, hair: hairTextureUrl, outfit: outfitTextureUrl };
    mageTexturePromise = Promise.all(Object.entries(files).map(async ([name, url]) => {
      const texture = await textureLoader.loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      // These atlas images are the separate Blender exports supplied with the
      // GLB and retain the source file's top-origin UV orientation.
      texture.flipY = true;
      texture.needsUpdate = true;
      return [name, texture];
    })).then(entries => Object.fromEntries(entries)).catch(error => {
      mageTexturePromise = null;
      throw error;
    });
  }
  return mageTexturePromise;
}

function loadMaidTextures() {
  if (!maidTexturePromise) {
    const names = ["Body_Tex", "Clothes_Tex", "Eyebrows_tex", "EyeHighlights_tex", "Eyelashes_Tex", "Eyes_Tex", "EyeWhite_Tex", "Face_Tex", "Hair1_Tex", "Hair2_Tex", "Mouth_tex", "Shoes_Tex"];
    maidTexturePromise = Promise.all(names.map(async name => {
      const texture = await textureLoader.loadAsync(`/assets/models/characters/maid/Textures/${name}.png`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return [name.toLowerCase(), texture];
    })).then(entries => Object.fromEntries(entries)).catch(error => {
      maidTexturePromise = null;
      throw error;
    });
  }
  return maidTexturePromise;
}

function applyMaidTextures(scene, textures) {
  scene.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      const name = material.name.toLowerCase();
      let textureName = null;
      if (name.includes("body_00_skin")) textureName = "body_tex";
      else if (name.includes("hairback")) textureName = "hair2_tex";
      else if (name.includes("tops")) textureName = "clothes_tex";
      else if (name.includes("shoes")) textureName = "shoes_tex";
      else if (name.includes("facemouth")) textureName = "mouth_tex";
      else if (name.includes("eyeiris")) textureName = "eyes_tex";
      else if (name.includes("eyehighlight")) textureName = "eyehighlights_tex";
      else if (name.includes("face_00_skin")) textureName = "face_tex";
      else if (name.includes("eyewhite")) textureName = "eyewhite_tex";
      else if (name.includes("facebrow")) textureName = "eyebrows_tex";
      else if (name.includes("faceeyeline")) textureName = "eyelashes_tex";
      else if (name.includes("hair_00")) textureName = "hair1_tex";
      const map = textureName && textures[textureName];
      if (map) { material.map = map; material.color.set("#ffffff"); material.needsUpdate = true; }
    }
  });
}

/** One parsed GLB promise per URL; additional copies reuse its mesh buffers. */
export function loadCharacterModel(characterId) {
  const url = modelUrl(characterId);
  if (!assetCache.has(url)) {
    const format = catalogById.get(characterId).modelFormat;
    const promise = (format === "fbx"
      ? fbxLoader.loadAsync(url).then(scene => ({ scene, animations: scene.animations || [] }))
      : loader.loadAsync(url)).catch(error => {
      assetCache.delete(url);
      throw new Error(`Could not load ${catalogById.get(characterId).name}: ${error.message}`);
    });
    assetCache.set(url, promise);
  }
  return assetCache.get(url);
}

function cloneMaterials(scene, renderStyle) {
  scene.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    // Keep VRoid's authored PBR maps intact. The regular glTF loader reads the
    // VRM container, and this clone keeps each player's tint independent.
    if (renderStyle === "vrm") {
      const cloneMaterial = material => {
        const cloned = material.clone();
        if (cloned.map) cloned.map.colorSpace = THREE.SRGBColorSpace;
        cloned.roughness = Math.max(cloned.roughness ?? 0.7, 0.55);
        return cloned;
      };
      object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
      return;
    }
    const toAnimeMaterial = (source, hasVertexPaint) => {
      const material = new THREE.MeshToonMaterial({
        name: source.name,
        // The imported artist model stores most of its colors in vertex data.
        // Its GLB base-color factor is black, so retaining it would black out
        // the character after converting the material to toon shading.
        color: renderStyle === "vertex-painted" ? new THREE.Color("#ffffff") : (source.color?.clone() || new THREE.Color("#ffffff")),
        map: source.map || null,
        gradientMap: toonGradient,
        side: source.side,
        transparent: source.transparent,
        opacity: source.opacity,
        vertexColors: renderStyle === "vertex-painted" ? hasVertexPaint : source.vertexColors,
        depthWrite: source.depthWrite,
        roughness: source.roughness,
      });
      material.name = source.name;
      return material;
    };
    const hasVertexPaint = Boolean(object.geometry?.getAttribute("color"));
    if (Array.isArray(object.material)) object.material = object.material.map(material => toAnimeMaterial(material, hasVertexPaint));
    else object.material = toAnimeMaterial(object.material, hasVertexPaint);
  });
}

function applyArtistTextures(scene, textures) {
  scene.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      const texture = textures[material.name.toLowerCase()];
      if (!texture) continue;
      material.map = texture;
      material.color.set("#ffffff");
      material.needsUpdate = true;
    }
  });
}

const OUTFITS = {
  "teal-traveler": { cloth: "#3d7784", cloth2: "#b8d5d7", pants: "#292a35", shoe: "#493a37", accessory: "#6e4e3f" },
  "petal-pop": { cloth: "#e878a1", cloth2: "#ffd6df", pants: "#5e4869", shoe: "#55444a", accessory: "#f2adc0" },
  "rose-afterglow": { cloth: "#bb527e", cloth2: "#ffc1d5", pants: "#54436b", shoe: "#4c3f48", accessory: "#f3c1d0" },
  "skyline-bomber": { cloth: "#427fb2", cloth2: "#eaf6ff", pants: "#3e5268", shoe: "#f2f7fb", accessory: "#d9eefb" },
  "cloud-campus": { cloth: "#e8f4fa", cloth2: "#80b9d8", pants: "#38536e", shoe: "#eff8fb", accessory: "#b7dcef" },
  "iris-layered": { cloth: "#8157a2", cloth2: "#e8c8f5", pants: "#684883", shoe: "#49374e", accessory: "#dabbea" },
  "amethyst-evening": { cloth: "#57366f", cloth2: "#f1d0fb", pants: "#8157a2", shoe: "#49374e", accessory: "#c6a0d8" },
  "amethyst-evening": { cloth: "#57366f", cloth2: "#f1d0fb", pants: "#8157a2", shoe: "#fff1fc", accessory: "#c6a0d8" },
  "forest-runner": { cloth: "#2c423e", cloth2: "#a8e27e", pants: "#293633", shoe: "#b9e984", accessory: "#8ec96a" },
  "moss-after-dark": { cloth: "#182723", cloth2: "#8de063", pants: "#202c2b", shoe: "#aff183", accessory: "#a4e978" }
};

const HAIR_COLORS = { rose: "#d96f87", midnight: "#29364e", violet: "#493261", espresso: "#43332c", silver: "#c7cad6", mint: "#66a995" };
const SKIN_TONES = { warm: "#f0c5aa", peach: "#e8ad89", bronze: "#bd8060", deep: "#83553f", porcelain: "#f6d7c4" };
const EYE_COLORS = { ocean: "#5b86a3", amber: "#a96c35", violet: "#9a70bb", green: "#579276" };

function applyAppearance(scene, appearance, renderStyle) {
  // The pumpkin character's colors and materials are authored in its FBX.
  if (renderStyle === "authored") return;
  const outfit = OUTFITS[appearance.outfitId] || OUTFITS["petal-pop"];
  const hair = HAIR_COLORS[appearance.hairColor] || HAIR_COLORS.rose;
  const skin = SKIN_TONES[appearance.skinTone] || SKIN_TONES.warm;
  const eyes = EYE_COLORS[appearance.eyeColor] || EYE_COLORS.ocean;
  scene.traverse(object => {
    if (!object.isMesh) return;
    const apply = material => {
      const name = material.name.toLowerCase();
      if (renderStyle === "vrm") {
        // Kai's VRoid outfit is authored as textured cloth. Tint its fabric
        // atlas by clothing part so the default remains the game's blue/white
        // streetwear palette without replacing the original texture details.
        if (name.includes("tops")) material.color.set(outfit.cloth);
        else if (name.includes("bottoms")) material.color.set(outfit.pants);
        else if (name.includes("shoes")) material.color.set(outfit.shoe);
        else if (name.includes("accessory")) material.color.set(outfit.accessory);
        else if (name.includes("hair")) material.color.set(hair);
        else if (name.includes("skin")) material.color.set(skin);
        else if (name.includes("eyeiris")) material.color.set(eyes);
        return;
      }
      if (renderStyle === "vertex-painted") {
        // Keep the supplied face, fabric, and skin paint intact while allowing
        // light, user-selected tints for the simple solid-color materials.
        if (name === "hair") material.color.set(appearance.hairColor === "espresso" ? "#a66d4f" : hair);
        if (name === "head" || name === "body") material.color.set(skin);
        if (name === "eyes") material.color.set(eyes);
        if (name === "outfit") material.color.set(outfit.cloth2).lerp(new THREE.Color("#ffffff"), 0.28);
        return;
      }
      if (outfit[name]) material.color.set(outfit[name]);
      if (name === "cape") material.color.set(outfit.cloth2);
      if (name === "hair") material.color.set(hair);
      if (name === "hair-light") material.color.set(hair).lerp(new THREE.Color("#ffffff"), 0.26);
      if (name === "skin") material.color.set(skin);
      if (name === "eye-iris") material.color.set(eyes);
    };
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    object.visible = !(appearance.accessoryId === "none" && objectMaterials.some(material => material.name.toLowerCase() === "accessory"));
    objectMaterials.forEach(apply);
  });
}

/** Reusable non-React character scene controller for this project's vanilla Three.js renderer. */
export function createCharacter({ characterId = "sakura-street", outfitId, playerIdentity = "guest", appearance = {}, onStatus = () => {} } = {}) {
  const character = catalogById.get(characterId) || catalogById.get("sakura-street");
  const root = new THREE.Group();
  root.name = `PlayerAvatar:${playerIdentity}`;
  root.userData.playerIdentity = playerIdentity;
  root.userData.characterId = character.id;
  root.userData.renderScale = character.renderScale || 1;
  let mixer = null, actions = new Map(), currentAction = null, model = null, loaded = false;
  let currentState = "Idle";
  let proceduralTime = 0;
  const proceduralStates = new Set(["jump", "land", "wave", "sit", "dance", "celebrate"]);
  const restPose = new Map();
  let armBones = [];
  let baseModelScale = new THREE.Vector3(1, 1, 1);
  let baseModelPosition = new THREE.Vector3();
  let baseModelRotation = new THREE.Euler();
  const state = { ...appearance, outfitId: outfitId || appearance.outfitId || character.outfitId };

  const ready = Promise.all([
    loadCharacterModel(character.id),
    character.renderStyle === "vertex-painted" ? loadMageTextures() : character.textureSet === "maid" ? loadMaidTextures() : Promise.resolve(null),
  ]).then(([gltf, textures]) => {
    model = cloneSkinnedScene(gltf.scene);
    // VRoid exports face -Z while this game presents characters toward +Z.
    if (character.renderStyle === "vrm") model.rotation.y = Math.PI;
    if (character.modelFormat === "fbx") {
      // FBX exports can carry very different unit scales and pivots. Normalize
      // this imported character to the existing game's roughly 1.7 m avatar.
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const height = bounds.getSize(new THREE.Vector3()).y;
      if (height > 0 && Number.isFinite(height)) {
        const unitScale = 1.7 / height;
        model.scale.multiplyScalar(unitScale);
        model.position.y -= bounds.min.y * unitScale;
      }
    }
    cloneMaterials(model, character.renderStyle);
    if (textures) applyArtistTextures(model, textures);
    if (character.textureSet === "maid") applyMaidTextures(model, textures);
    applyAppearance(model, state, character.renderStyle);
    model.traverse(object => {
      if (!object.isBone) return;
      restPose.set(object, object.quaternion.clone());
      const name = object.name.toLowerCase();
      if (name.includes("upper_arm") || name.includes("forearm") || name.includes("upperarm") || name.includes("lowerarm") || name.includes("shoulder") || name.includes("leftarm") || name.includes("rightarm")) armBones.push(object);
    });
    baseModelScale.copy(model.scale);
    baseModelPosition.copy(model.position);
    baseModelRotation.copy(model.rotation);
    root.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) actions.set(clip.name.toLowerCase(), mixer.clipAction(clip));
    loaded = true;
    setAnimation(currentState, 0);
    onStatus({ state: "ready", character: character.name });
    return model;
  }).catch(error => {
    onStatus({ state: "error", character: character.name, error });
    return null;
  });

  function setAnimation(nextState, crossFade = 0.2) {
    const key = String(nextState || "Idle").toLowerCase();
    // The supplied model includes authored idle/run clips. It has no separate
    // walk clip, so its run clip is played slower for the existing walk state.
    const clipKey = key === "walk" ? "run" : key;
    const action = actions.get(clipKey) || actions.get("idle");
    currentState = key;
    if (!action) { proceduralTime = 0; return; }
    action.timeScale = key === "walk" ? 0.62 : 1;
    if (action === currentAction) return;
    action.reset();
    action.enabled = true;
    action.setEffectiveWeight(1);
    const oneShot = ["jump", "land", "wave", "sit", "celebrate"].includes(key);
    action.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
    action.clampWhenFinished = true;
    if (currentAction) action.crossFadeFrom(currentAction, crossFade, true);
    action.play(); currentAction = action;
    proceduralTime = 0;
  }
  function setOutfit(nextOutfitId) {
    if (!OUTFITS[nextOutfitId]) return false;
    state.outfitId = nextOutfitId;
    if (model) applyAppearance(model, state, character.renderStyle);
    return true;
  }
  function updateAppearance(nextAppearance = {}) {
    Object.assign(state, nextAppearance);
    if (model) applyAppearance(model, state, character.renderStyle);
  }
  function update(delta) {
    if (!mixer || !loaded) return;
    mixer.update(delta);
    const hasAuthoredState = actions.has(currentState === "walk" ? "run" : currentState) || actions.has("idle");
    const proceduralLocomotion = (character.renderStyle === "vrm" || character.proceduralLocomotion) && !hasAuthoredState && ["idle", "walk", "run", "jump", "land", "wave"].includes(currentState);
    if (proceduralStates.has(currentState) || proceduralLocomotion) {
      proceduralTime += delta;
      const wave = currentState === "wave";
      const sit = currentState === "sit";
      const dance = currentState === "dance";
      const celebrate = currentState === "celebrate";
      const jump = currentState === "jump";
      const land = currentState === "land";
      const walking = currentState === "walk" || currentState === "run";
      const speed = currentState === "run" ? 12 : 8;
      const swing = walking ? Math.sin(proceduralTime * speed) : 0;
      for (const bone of armBones) {
        const base = restPose.get(bone);
        if (!base) continue;
        const name = bone.name.toLowerCase();
        const right = name.endsWith(".r") || name.endsWith("_r") || name.includes("_r_") || name.includes("right");
        const shoulder = name.includes("shoulder");
        const upper = name.includes("upper_arm") || name.includes("upperarm") || name.includes("leftarm") || name.includes("rightarm") || shoulder;
        const relaxAngle = shoulder ? 0.24 : 0.82;
        const offset = new THREE.Quaternion();
        if (wave && right && upper) offset.setFromEuler(new THREE.Euler(-1.25 + Math.sin(proceduralTime * 8) * 0.18, 0, -0.35));
        else if ((celebrate || jump) && upper) offset.setFromEuler(new THREE.Euler(0, 0, right ? -0.8 : 0.8));
        else if (walking && upper) offset.setFromEuler(new THREE.Euler((right ? 1 : -1) * swing * (shoulder ? 0.1 : 0.38), 0, (right ? -1 : 1) * relaxAngle));
        else if (proceduralLocomotion && upper) offset.setFromEuler(new THREE.Euler(0, 0, (right ? -1 : 1) * relaxAngle));
        else if (dance && upper) offset.setFromEuler(new THREE.Euler(0, Math.sin(proceduralTime * 5) * 0.28, (right ? -1 : 1) * (0.45 + Math.sin(proceduralTime * 5) * 0.2)));
        else if (sit && upper) offset.setFromEuler(new THREE.Euler(0, 0, right ? -0.28 : 0.28));
        if (character.renderStyle === "vrm") bone.quaternion.copy(offset).multiply(base);
        else bone.quaternion.copy(base).multiply(offset);
      }
      if (proceduralLocomotion) {
        model.traverse(object => {
          if (!object.isBone) return;
          const name = object.name.toLowerCase();
          const base = restPose.get(object);
          if (!base) return;
          const offset = new THREE.Quaternion();
          if (name.includes("upperleg") || name.includes("upleg") || name.includes("leftthigh") || name.includes("rightthigh")) {
            const right = name.includes("right") || name.includes("_r_");
            const angle = walking ? (right ? 1 : -1) * swing * 0.42 : jump ? 0.38 : 0;
            offset.setFromEuler(new THREE.Euler(angle, 0, 0));
          } else if (name.includes("lowerleg") || name.endsWith("leftleg") || name.endsWith("rightleg")) {
            const angle = walking ? Math.max(0, Math.sin(proceduralTime * speed + Math.PI / 2)) * 0.52 : jump ? -0.48 : land ? 0.16 : 0;
            offset.setFromEuler(new THREE.Euler(angle, 0, 0));
          } else if (name.includes("spine") || name.includes("chest")) {
            if (currentState === "idle") offset.setFromEuler(new THREE.Euler(Math.sin(proceduralTime * 1.8) * 0.018, 0, 0));
            else if (walking) offset.setFromEuler(new THREE.Euler(currentState === "run" ? -0.08 : -0.035, 0, 0));
            else if (jump) offset.setFromEuler(new THREE.Euler(-0.12, 0, 0));
            else if (land) offset.setFromEuler(new THREE.Euler(0.09, 0, 0));
          }
          if (character.renderStyle === "vrm") object.quaternion.copy(offset).multiply(base);
          else object.quaternion.copy(base).multiply(offset);
        });
      }
      model.scale.copy(baseModelScale);
      if (jump) model.position.y = Math.sin(Math.min(proceduralTime / 0.65, 1) * Math.PI) * 0.08;
      else if (land) model.scale.y *= 0.88 + Math.min(proceduralTime / 0.24, 1) * 0.12;
      else model.position.copy(baseModelPosition);
      if (dance) model.rotation.y = baseModelRotation.y + Math.sin(proceduralTime * 3.5) * 0.14;
      else model.rotation.y = baseModelRotation.y;
    } else if (model) {
      model.scale.copy(baseModelScale);
      model.position.copy(baseModelPosition);
      model.rotation.copy(baseModelRotation);
    }
  }
  function dispose() {
    if (mixer) mixer.stopAllAction();
    root.parent?.remove(root);
  }
  onStatus({ state: "loading", character: character.name });
  return { root, ready, update, setAnimation, setOutfit, updateAppearance, dispose, get loaded() { return loaded; }, get animation() { return currentState; }, get appearance() { return { ...state }; } };
}

export { catalog as characterCatalog, OUTFITS as freeOutfits, HAIR_COLORS as hairColors, SKIN_TONES as skinTones, EYE_COLORS as eyeColors };
