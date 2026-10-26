import * as THREE from "three";
import { getProfile, rewardWorldVisit } from "./profile.js";
import { createCharacter } from "./utils/characterLoader.js";

export function createWorld(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#b9d9e6");
  scene.fog = new THREE.Fog("#b9d9e6", 70, 190);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 280);
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
  function makePatternTexture(paint, repeatX, repeatY, size = 256) {
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = textureCanvas.height = size;
    const context = textureCanvas.getContext("2d");
    paint(context, size);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    return texture;
  }
  const grassMap = makePatternTexture((context, size) => {
    context.fillStyle = "#89b77c"; context.fillRect(0, 0, size, size);
    let seed = 173;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 1700; i++) {
      const x = random() * size, y = random() * size;
      context.fillStyle = ["#709e68", "#a1c68a", "#b6ce91", "#6d9a67"][Math.floor(random() * 4)];
      context.globalAlpha = 0.2 + random() * 0.25;
      context.beginPath(); context.ellipse(x, y, 0.7 + random() * 2, 0.6 + random() * 1.6, random(), 0, Math.PI * 2); context.fill();
    }
    context.globalAlpha = 1;
  }, 42, 42);
  const paverMap = makePatternTexture((context, size) => {
    context.fillStyle = "#c6b89e"; context.fillRect(0, 0, size, size);
    const tile = size / 8;
    for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
      const offset = row % 2 ? tile / 2 : 0;
      context.fillStyle = ["#d3c6ae", "#c9bba2", "#d8cbb3", "#c1b49d"][(row * 3 + column) % 4];
      context.fillRect(column * tile + offset + 2, row * tile + 2, tile - 4, tile - 4);
    }
  }, 9, 9);
  const woodGrainMap = makePatternTexture((context, size) => {
    context.fillStyle = "#936b4d"; context.fillRect(0, 0, size, size);
    for (let line = 0; line < 30; line++) {
      context.strokeStyle = line % 3 ? "#76553e" : "#b4865c"; context.globalAlpha = 0.22;
      context.lineWidth = 1 + line % 2; context.beginPath(); context.moveTo(0, line * size / 30);
      context.bezierCurveTo(size * 0.3, line * size / 30 - 5, size * 0.6, line * size / 30 + 4, size, line * size / 30); context.stroke();
    }
    context.globalAlpha = 1;
  }, 2, 1);
  const materials = {
    grass: mat("#ffffff"), grassLight: mat("#9abb83"), road: mat("#ffffff"), pavers: mat("#ffffff"), roadLine: mat("#f5d786"),
    wallCream: mat("#f1dfbd"), wallPink: mat("#e9b7a0"), wallMint: mat("#c5ddc4"), wallBlue: mat("#bfd5e5"),
    roofRed: mat("#bd634d"), roofDark: mat("#526f70"), roofOrange: mat("#d88d54"), wood: mat("#8b6246"),
    leaf: mat("#5d9668"), leafLight: mat("#81b87a"), trunk: mat("#826047"), stone: mat("#d8d0bd"),
    water: mat("#68b8c7", 0.26), white: mat("#fff6e6"), gold: mat("#e6ad52"),
  };
  materials.grass.map = grassMap;
  materials.road.map = paverMap;
  materials.pavers.map = paverMap;
  materials.wood.map = woodGrainMap;
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
    outdoorColliders.push({ type: "circle", x, z, radius: 1.15 * size });
  }
  const outdoorColliders = [];
  function isBlockedOutdoor(x, z) {
    return outdoorColliders.some(collider => collider.type === "box"
      ? Math.abs(x - collider.x) < collider.halfX && Math.abs(z - collider.z) < collider.halfZ
      : (x - collider.x) ** 2 + (z - collider.z) ** 2 < collider.radius ** 2);
  }
  // A distant Shanghai-inspired skyline gives the campus a clear city setting
  // without adding heavy imported assets or blocking the playable streets.
  const skylineMats = [mat("#78949a"), mat("#8ba5a6"), mat("#a5b1a5")];
  const skylineWindow = new THREE.MeshBasicMaterial({ color: "#f5d18b" });
  for (let i = 0; i < 13; i++) {
    const x = -39 + i * 6.5, z = -63 - (i % 3) * 2;
    const width = 4.3 + (i % 3) * 0.35, height = 13 + ((i * 7) % 17);
    block(x, height / 2, z, width, height, 3.4, skylineMats[i % skylineMats.length], false);
    block(x, height + 0.2, z, width * 0.68, 0.5, 2.4, skylineMats[(i + 1) % skylineMats.length], false);
    for (let floor = 0; floor < Math.floor(height / 2.4); floor++) {
      for (let window = -1; window <= 1; window++) {
        const light = new THREE.Mesh(boxGeo, skylineWindow);
        light.position.set(x + window * 1.05, 1.4 + floor * 2.4, z + 1.73);
        light.scale.set(0.35, 0.42, 0.06); scene.add(light);
      }
    }
  }
  // A playful pearl-tower silhouette sits above the riverfront skyline.
  const pearlStem = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, 19, 10), mat("#bd6d5d"));
  pearlStem.position.set(24, 9.5, -64); scene.add(pearlStem);
  for (const [y, radius] of [[4, 1.8], [11.5, 1.25], [18, 0.85]]) {
    const pearl = new THREE.Mesh(sphereGeo, mat(y === 4 ? "#c77b72" : "#d9a56c", 0.48)); pearl.position.set(24, y, -64); pearl.scale.setScalar(radius); scene.add(pearl);
  }
  const exteriorEntrances = [];
  const roomIdByBuilding = { "Lantern Chinese School": "classroom", "Tea House": "teahouse", Bookshop: "library", "Student House": "home", "Shanghai Noodle House": "food", "Dumpling & Tea": "dumpling", "Shanghai Coffee": "cafe" };
  function building(x, z, width, depth, height, wall, roof, label, sign = "学") {
    // Keep each real doorway facing the central road instead of drawing a fake
    // door over a solid wall on the back of the building.
    const frontSign = z <= 0 ? 1 : -1;
    block(x, height / 2, z - frontSign * depth / 2, width, height, 0.3, wall);
    block(x - width / 2, height / 2, z, 0.3, height, depth, wall);
    block(x + width / 2, height / 2, z, 0.3, height, depth, wall);
    const doorWidth = Math.min(3.6, width * 0.32);
    // North-row storefronts face south toward the plaza; south-row homes face
    // north toward the road. This keeps every visible entrance road-facing.
    const facadeZ = z + frontSign * depth / 2;
    const wallThickness = 0.42;
    const sideSegment = Math.max(0.15, (width - doorWidth) / 2);
    // Collide with the actual walls but leave the doorway open. The previous
    // single footprint rectangle also blocked every visible front door.
    outdoorColliders.push(
      { type: "box", x, z: z - frontSign * depth / 2, halfX: width / 2, halfZ: wallThickness },
      { type: "box", x: x - width / 2, z, halfX: wallThickness, halfZ: depth / 2 },
      { type: "box", x: x + width / 2, z, halfX: wallThickness, halfZ: depth / 2 },
      { type: "box", x: x - (doorWidth + sideSegment) / 2, z: facadeZ, halfX: sideSegment / 2, halfZ: wallThickness },
      { type: "box", x: x + (doorWidth + sideSegment) / 2, z: facadeZ, halfX: sideSegment / 2, halfZ: wallThickness },
    );
    if (roomIdByBuilding[label]) exteriorEntrances.push({ roomId: roomIdByBuilding[label], x, z, frontSign, facadeZ, doorWidth });
    const sideWidth = (width - doorWidth) / 2;
    block(x - (doorWidth + sideWidth) / 2, height / 2, facadeZ, sideWidth, height, 0.3, wall);
    block(x + (doorWidth + sideWidth) / 2, height / 2, facadeZ, sideWidth, height, 0.3, wall);
    block(x, height - 0.62, facadeZ, doorWidth, 1.24, 0.3, wall);
    block(x - doorWidth / 2 - 0.11, 1.15, facadeZ + frontSign * 0.08, 0.22, 2.3, 0.24, materials.wood);
    block(x + doorWidth / 2 + 0.11, 1.15, facadeZ + frontSign * 0.08, 0.22, 2.3, 0.24, materials.wood);
    block(x, 2.32, facadeZ + frontSign * 0.08, doorWidth + 0.44, 0.24, 0.24, materials.gold);
    // Door recess and shallow steps make the entrance legible at player height.
    const leftDoor = block(x - doorWidth * 0.43, 1.08, facadeZ + frontSign * 0.24, 0.14, 2.08, doorWidth * 0.43, materials.wood);
    const rightDoor = block(x + doorWidth * 0.43, 1.08, facadeZ + frontSign * 0.24, 0.14, 2.08, doorWidth * 0.43, materials.wood);
    leftDoor.rotation.y = -frontSign * 0.68; rightDoor.rotation.y = frontSign * 0.68;
    block(x, 0.15, facadeZ + frontSign * 0.9, doorWidth + 1.4, 0.3, 1.5, materials.stone, false);
    for (let i = -1; i <= 1; i++) {
      const wx = x + i * width * 0.27;
      block(wx, height * 0.56, facadeZ + frontSign * 0.04, width * 0.105, height * 0.26, 0.055, materials.wood);
      block(wx, height * 0.56, facadeZ + frontSign * 0.08, width * 0.075, height * 0.205, 0.03, materials.wallBlue);
    }
    if (label.includes("Shanghai") || label.includes("Dumpling")) {
      const awningZ = facadeZ + frontSign * 0.58;
      const colors = [materials.roofRed, materials.white, materials.roofOrange, materials.white];
      for (let panel = 0; panel < 8; panel++) {
        const panelWidth = width / 8;
        block(x - width / 2 + panelWidth * (panel + 0.5), 3.15, awningZ, panelWidth + 0.015, 0.16, 1.15, colors[panel % colors.length], false);
      }
      block(x, 2.96, awningZ + frontSign * 0.56, width, 0.42, 0.16, materials.roofRed, false);
    }
    if (height < 6.5) {
      block(x, 2.72, facadeZ + frontSign * 0.62, width * 0.94, 0.22, 1.25, materials.roofOrange, false);
      for (let i = -2; i <= 2; i++) block(x + i * width * 0.15, 2.57, facadeZ + frontSign * 1.16, width * 0.13, 0.42, 0.14, i % 2 ? materials.white : materials.roofRed, false);
      for (const dx of [-width * 0.34, width * 0.34]) {
        const lantern = new THREE.Mesh(sphereGeo, mat("#c95042", 0.55)); lantern.position.set(x + dx, 3.65, facadeZ + frontSign * 0.33); lantern.scale.set(0.27, 0.4, 0.27); scene.add(lantern);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8), materials.gold); cap.position.set(x + dx, 4.08, facadeZ + frontSign * 0.33); scene.add(cap);
      }
    }
    addChineseRoof(x, height + 0.08, z, width * 1.08, depth * 1.08, Math.min(2.2, height * 0.25), roof);
    // A bright sign above the entrance makes each destination readable at plaza scale.
    block(x, height * 0.68, facadeZ + frontSign * 0.12, Math.min(2.1, width * 0.65), 0.5, 0.11, materials.gold, false);
    const signCanvas = document.createElement("canvas"); signCanvas.width = 256; signCanvas.height = 64;
    const ctx = signCanvas.getContext("2d"); ctx.fillStyle = "#5c4230"; ctx.font = "bold 32px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(`${sign} ${label}`, 128, 34);
    const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace;
    const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(2.0, width * 0.6), 0.48), new THREE.MeshBasicMaterial({ map: signTexture, transparent: true }));
    signBoard.position.set(x, height * 0.68, facadeZ + frontSign * 0.19); signBoard.rotation.y = frontSign < 0 ? Math.PI : 0; scene.add(signBoard);
  }

  // A low-poly hipped roof with a real ridgeline reads as a Chinese roof from
  // the player camera, while staying cheap to render on phones.
  function addChineseRoof(x, y, z, width, depth, rise, material) {
    const w = width / 2, d = depth / 2, r = rise;
    const vertices = [
      -w,0,-d,  w,0,-d,  w,0,d,  -w,0,d,
      0,r,-d * 0.45, 0,r,d * 0.45,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex([0,3,5, 0,5,4, 1,2,5, 1,5,4, 0,1,4, 3,2,5]);
    geometry.computeVertexNormals();
    const roofMaterial = material.clone(); roofMaterial.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geometry, roofMaterial);
    mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    // Warm ridge cap and lifted corners give the roof a distinctive silhouette.
    block(x, y + r + 0.08, z, 0.32, 0.16, depth * 0.55, materials.gold, false);
    for (const [dx,dz] of [[-w,-d],[w,-d],[-w,d],[w,d]]) {
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), materials.gold);
      finial.position.set(x+dx,y+0.08,z+dz); finial.scale.set(1,0.7,1); scene.add(finial);
    }
    return mesh;
  }

  block(0, -0.2, 0, 360, 0.35, 360, materials.grass, false);
  block(0, 0.005, 0, 10, 0.04, 82, materials.road, false);
  block(0, 0.03, 0, 0.12, 0.02, 82, materials.roadLine, false);
  block(0, 0.012, 0, 82, 0.035, 9, materials.road, false);
  block(0, 0.036, 0, 82, 0.025, 0.13, materials.roadLine, false);
  // Stone paths pull the landmarks together so the campus reads as one place.
  block(-17, 0.072, -4.1, 6.0, 0.055, 8.2, materials.pavers, false);
  block(40.6, 0.075, -13.8, 3.4, 0.06, 23.5, materials.pavers, false);
  block(28.2, 0.078, -24.4, 25.2, 0.06, 4.5, materials.pavers, false);
  // Small plaza square and a reflecting pond anchor the walkable crossroads.
  block(0, 0.035, 0, 5, 0.07, 5, materials.stone, false);
  const plazaMedallion = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.45, 0.13, 32), mat("#c9b58c"));
  plazaMedallion.position.set(0, 0.13, 0); plazaMedallion.receiveShadow = true; scene.add(plazaMedallion);
  const plazaRing = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.08, 8, 40), materials.gold);
  plazaRing.position.set(0, 0.22, 0); plazaRing.rotation.x = -Math.PI / 2; scene.add(plazaRing);
  const plazaEmblemCanvas = document.createElement("canvas"); plazaEmblemCanvas.width = 256; plazaEmblemCanvas.height = 256;
  const emblemContext = plazaEmblemCanvas.getContext("2d"); emblemContext.fillStyle = "#45644d"; emblemContext.font = "bold 148px serif"; emblemContext.textAlign = "center"; emblemContext.textBaseline = "middle"; emblemContext.fillText("友", 128, 132);
  const emblemTexture = new THREE.CanvasTexture(plazaEmblemCanvas); emblemTexture.colorSpace = THREE.SRGBColorSpace;
  const plazaEmblem = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: emblemTexture, transparent: true, side: THREE.DoubleSide }));
  plazaEmblem.position.set(0, 0.215, 0); plazaEmblem.rotation.x = -Math.PI / 2; scene.add(plazaEmblem);
  block(15, 0.11, 0, 9, 0.15, 6, materials.water, false);
  for (let i = -2; i <= 2; i++) {
    const pebble = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 8), materials.white);
    pebble.position.set(15 + i * 1.15, 0.23, 3.45); scene.add(pebble);
  }
  // Make the main school large enough to read clearly from the plaza spawn.
  building(-17, -15, 19, 14, 8.2, materials.wallCream, materials.roofRed, "Lantern Chinese School", "学");
  // A broad stone path connects the school’s real front doorway to the main road.
  block(-17, 0.05, -4.1, 5.2, 0.08, 8.1, materials.stone, false);
  for (const x of [-34, -18, 17]) block(x, 0.045, 6.2, 3.4, 0.07, 12.4, materials.stone, false);
  // The school gets a second, smaller roof tier and tall entry columns so it
  // reads like the campus landmark instead of another little house.
  block(-17, 8.35, -15, 14, 0.2, 10, materials.roofDark, false);
  addChineseRoof(-17, 8.52, -15, 16.5, 12.5, 2.1, materials.roofRed);
  for (const x of [-22.2, -11.8]) {
    const column = new THREE.Mesh(cylinderGeo, materials.roofRed);
    column.position.set(x, 3.1, -7.8); column.scale.set(0.28, 6.2, 0.28); column.castShadow = true; scene.add(column);
  }
  // A plaza-facing sign makes the school identifiable before players reach it.
  block(-17, 4.6, -7.25, 9.4, 1.5, 0.22, materials.wood, false);
  block(-17, 4.6, -7.10, 9.05, 1.2, 0.06, materials.white, false);
  const schoolSignCanvas = document.createElement("canvas"); schoolSignCanvas.width = 768; schoolSignCanvas.height = 128;
  const schoolSignContext = schoolSignCanvas.getContext("2d"); schoolSignContext.fillStyle = "#365843"; schoolSignContext.font = "bold 60px sans-serif"; schoolSignContext.textAlign = "center"; schoolSignContext.textBaseline = "middle"; schoolSignContext.fillText("学  WORLDMATES SCHOOL", 384, 66);
  const schoolSignTexture = new THREE.CanvasTexture(schoolSignCanvas); schoolSignTexture.colorSpace = THREE.SRGBColorSpace;
  const schoolSign = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 0.95), new THREE.MeshBasicMaterial({ map: schoolSignTexture, side: THREE.DoubleSide })); schoolSign.position.set(-17, 4.6, -7.05); scene.add(schoolSign);
  building(17, -15, 10, 9, 5.0, materials.wallPink, materials.roofOrange, "Tea House", "茶");
  building(-18, 16, 10, 9, 5.2, materials.wallMint, materials.roofDark, "Bookshop", "书");
  building(17, 16, 11, 9, 5.8, materials.wallBlue, materials.roofRed, "Garden Hall", "园");
  building(-34, 16, 10, 9, 5.3, materials.wallPink, materials.roofOrange, "Student House", "家");
  building(32, -15, 13, 10, 5.8, materials.wallCream, materials.roofRed, "Shanghai Noodle House", "面");
  building(32, 3, 12, 10, 5.4, materials.wallPink, materials.roofDark, "Dumpling & Tea", "饺");
  building(32, 24, 13, 10, 5.5, materials.wallMint, materials.roofOrange, "Shanghai Coffee", "咖");
  block(32, 0.045, 9.6, 3.4, 0.07, 19.2, materials.stone, false);
  // Pavilion, lanterns, planters, and alternating street trees.
  block(-1, 1.7, -24, 7, 3.4, 6, materials.wood);
  outdoorColliders.push({ type: "box", x: -1, z: -24, halfX: 5.6, halfZ: 4.8 });
  addChineseRoof(-1, 3.25, -24, 10.5, 8.8, 2, materials.roofRed);
  for (const [x, z] of [[-9, -8], [9, -8], [-9, 8], [9, 8], [-8, -26], [8, -26]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.6, 8), materials.gold); post.position.set(x, 1.1, z); scene.add(post);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: "#ffda83" })); glow.position.set(x, 2.05, z); scene.add(glow);
  }
  for (const [x, z, size] of [[-26,-26,1.2],[-29,-8,0.85],[-27,8,1],[-28,27,1.3],[-7,29,0.9],[8,29,1.2],[28,28,1],[29,8,1.25],[27,-7,0.9],[40,-37,0.9],[-10,-29,1]]) tree(x, z, size);
  // Flower patches bring color to the plaza paths.
  for (const [x, z] of [[-12,-1],[12,-1],[-2,12],[2,-12],[-22,1],[22,1]]) {
    const petal = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.18, 7), materials.gold); petal.position.set(x, 0.16, z); scene.add(petal);
  }

  // A small international food lane grows from the plaza instead of appearing
  // as a separate menu. Three distinct stalls sit beside the same paved walk.
  const animatedLanterns = [];
  function addBench(x, z, rotation = 0) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation; scene.add(group);
    const seat = new THREE.Mesh(boxGeo, materials.wood); seat.position.set(0, 0.72, 0); seat.scale.set(2.1, 0.16, 0.62); seat.castShadow = true; group.add(seat);
    const back = new THREE.Mesh(boxGeo, materials.wood); back.position.set(0, 1.18, -0.25); back.scale.set(2.1, 0.72, 0.13); back.castShadow = true; group.add(back);
    for (const dx of [-0.72, 0.72]) { const leg = new THREE.Mesh(boxGeo, materials.roofDark); leg.position.set(dx, 0.34, 0); leg.scale.set(0.13, 0.68, 0.14); group.add(leg); }
    outdoorColliders.push({ type: "box", x, z, halfX: 0.75, halfZ: 0.75 });
  }
  function addPlanter(x, z, flowerColor = "#e98787") {
    const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.5, 12), mat("#bd8c68")); tub.position.set(x, 0.28, z); tub.castShadow = true; scene.add(tub);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.68, 0.08, 12), mat("#624e3e")); soil.position.set(x, 0.56, z); scene.add(soil);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 0.4, fx = x + Math.cos(angle) * 0.35, fz = z + Math.sin(angle) * 0.35;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.56, 5), mat("#608c60")); stem.position.set(fx, 0.84, fz); stem.rotation.z = Math.sin(angle) * 0.18; scene.add(stem);
      const bloom = new THREE.Mesh(sphereGeo, mat(i % 2 ? flowerColor : "#f5ca78", 0.62)); bloom.position.set(fx, 1.17, fz); bloom.scale.set(0.15, 0.12, 0.15); scene.add(bloom);
    }
    outdoorColliders.push({ type: "circle", x, z, radius: 0.82 });
  }
  addBench(-11, 4, Math.PI / 2); addBench(11, 4, -Math.PI / 2); addBench(-4, 13); addBench(5, -13, Math.PI);
  addPlanter(-9.8, -3.8); addPlanter(9.8, -3.8, "#df8cad"); addPlanter(-10, 8, "#eab16b"); addPlanter(10, 8);

  function addStreetStall({ x, label, subtitle, color, trim, kind }) {
    const centerZ = -29.2, frontZ = centerZ + 1.55;
    const postMaterial = mat(trim), canopyMaterial = mat(color, 0.82), lightMaterial = new THREE.MeshStandardMaterial({ color: "#ffd879", emissive: "#ffb535", emissiveIntensity: 1.1, roughness: 0.32 });
    // Carved-looking timber counter, open customer side, and a fabric roof.
    block(x, 0.85, frontZ, 5.8, 1.0, 0.92, materials.wood);
    block(x, 1.39, frontZ, 6.0, 0.12, 1.06, materials.gold, false);
    for (const dx of [-2.72, 2.72]) for (const dz of [-1.42, 1.42]) {
      const post = new THREE.Mesh(boxGeo, postMaterial); post.position.set(x + dx, 1.78, centerZ + dz); post.scale.set(0.18, 3.25, 0.18); post.castShadow = true; scene.add(post);
    }
    for (let panel = 0; panel < 8; panel++) {
      const panelWidth = 6.45 / 8, stripeMaterial = panel % 2 ? mat("#fff0d8", 0.85) : canopyMaterial;
      const canopy = new THREE.Mesh(boxGeo, stripeMaterial); canopy.position.set(x - 3.225 + panelWidth * (panel + 0.5), 3.48, centerZ); canopy.scale.set(panelWidth + 0.025, 0.16, 4.05); canopy.castShadow = true; scene.add(canopy);
    }
    const valance = new THREE.Mesh(boxGeo, canopyMaterial); valance.position.set(x, 3.2, frontZ + 0.56); valance.scale.set(6.45, 0.42, 0.16); scene.add(valance);
    const signCanvas = document.createElement("canvas"); signCanvas.width = 768; signCanvas.height = 180;
    const signContext = signCanvas.getContext("2d"); signContext.fillStyle = "#fff8e9"; signContext.fillRect(0, 0, 768, 180);
    signContext.strokeStyle = trim; signContext.lineWidth = 10; signContext.strokeRect(9, 9, 750, 162);
    signContext.textAlign = "center"; signContext.textBaseline = "middle"; signContext.fillStyle = trim; signContext.font = "bold 58px sans-serif"; signContext.fillText(label, 384, 69);
    signContext.fillStyle = "#655949"; signContext.font = "bold 28px sans-serif"; signContext.fillText(subtitle, 384, 128);
    const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.12), new THREE.MeshBasicMaterial({ map: signTexture, side: THREE.DoubleSide })); sign.position.set(x, 2.55, frontZ + 0.48); scene.add(sign);
    // Small dish silhouettes make each counter legible at a glance.
    for (let dish = 0; dish < 3; dish++) {
      const dishX = x - 1.8 + dish * 1.8;
      const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 12), mat("#f1e2ca")); saucer.position.set(dishX, 1.5, frontZ); scene.add(saucer);
      const food = new THREE.Mesh(sphereGeo, mat(kind === "pho" ? ["#d6a668", "#82a978", "#c67a5e"][dish] : kind === "festival" ? ["#d79755", "#f3d38d", "#799966"][dish] : ["#ead6bb", "#e8d3ad", "#d5bc91"][dish]));
      food.position.set(dishX, 1.66, frontZ); food.scale.set(0.27, 0.12, 0.27); scene.add(food);
    }
    for (const dx of [-2.72, 2.72]) {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), lightMaterial); lantern.position.set(x + dx * 0.78, 2.55, frontZ + 0.92); lantern.scale.set(0.72, 1.2, 0.72); scene.add(lantern);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 8), materials.gold); cap.position.set(lantern.position.x, 2.88, lantern.position.z); scene.add(cap);
      animatedLanterns.push({ mesh: lantern, origin: lantern.position.y, phase: x * 0.07 + dx });
    }
    outdoorColliders.push({ type: "box", x, z: centerZ, halfX: 3.15, halfZ: 1.75 });
  }
  addStreetStall({ x: 18, label: "PHỞ · HANOI", subtitle: "RICE NOODLES · VIET NAM", color: "#b64d43", trim: "#78483b", kind: "pho" });
  addStreetStall({ x: 26, label: "MATSURI YATAI", subtitle: "FESTIVAL FOOD · JAPAN", color: "#314a68", trim: "#28394a", kind: "festival" });
  addStreetStall({ x: 34, label: "小笼包 · SHANGHAI", subtitle: "SOUP DUMPLINGS · CHINA", color: "#a94c3d", trim: "#704337", kind: "xiaolongbao" });
  // Paper lanterns above the lane add a little motion without costly effects.
  const laneCord = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 23, 5), mat("#4c5147")); laneCord.position.set(26, 4.38, -29.2); laneCord.rotation.z = Math.PI / 2; scene.add(laneCord);
  for (const x of [20, 24, 28, 32]) {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshStandardMaterial({ color: x % 2 ? "#cf6049" : "#e6a34f", emissive: "#a84a32", emissiveIntensity: 0.2, roughness: 0.45 }));
    lantern.position.set(x, 4.02, -29.2); lantern.scale.set(0.78, 1.18, 0.78); scene.add(lantern);
    animatedLanterns.push({ mesh: lantern, origin: lantern.position.y, phase: x * 0.12 });
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
  function setAvatarRoomLayers(root) { root.traverse(object => { for (let layer = 1; layer <= 7; layer++) object.layers.enable(layer); }); }
  setAvatarRoomLayers(player);
  player.scale.setScalar(0.92 * player.userData.renderScale);
  scene.add(player);
  // Spawn at the crossroads, facing the school row, rather than behind the plaza.
  player.position.set(0, 0, 8);

  const landmarks = [
    { id: "classroom", name: "Lantern Chinese School", x: -17, z: -5.2, icon: "学", detail: "The large red-roof school is straight ahead on the left. Enter through the wide front doors to study at the desks.", action: "Enter the school", route: "room", roomId: "classroom", color: "#e3ad63" },
    { id: "teahouse", name: "School Tea House", x: 17, z: -8.3, icon: "茶", detail: "A small tea room on the right side of the north road. Practise a Chinese conversation with Mei.", action: "Enter the tea house", route: "room", roomId: "teahouse", color: "#79a987" },
    { id: "bookshop", name: "Campus Library", x: -18, z: 10.4, icon: "书", detail: "The green-roof library faces the south edge of the main road. Browse your collected words inside.", action: "Enter the library", route: "room", roomId: "library", color: "#7a9abe" },
    { id: "garden", name: "Garden Hall", x: 17, z: 10.4, icon: "园", detail: "A quiet place for a short solo practice circle with scripted classmates.", action: "Open study circle", route: "school", schoolTab: "circle", requireWords: 5, color: "#81a96e" },
    { id: "student-house", name: "Student House", x: -34, z: 10.4, icon: "家", detail: "The pink student home faces the south side of the road. Sit at your study desk and review words.", action: "Enter the student house", route: "room", roomId: "home", color: "#d88d76" },
    { id: "noodle-house", name: "Shanghai Noodle House", x: 32, z: -8.2, icon: "面", detail: "Order a bowl of Shanghai-style noodles, learn the food words, and sit at the shared table.", action: "Enter the noodle house", route: "room", roomId: "food", requireWords: 5, color: "#d68c55" },
    { id: "dumpling-tea", name: "Dumpling & Tea", x: 32, z: -0.4, icon: "饺", detail: "Explore a little local food shop with dumplings, tea, and a Chinese menu.", action: "Enter the food shop", route: "room", roomId: "dumpling", color: "#b97b91" },
    { id: "coffee", name: "Shanghai Coffee House", x: 32, z: 16.7, icon: "咖", detail: "Take a quiet break in a Shanghai-inspired coffee shop. Sit at a little table and learn a café phrase.", action: "Enter the coffee shop", route: "room", roomId: "cafe", color: "#81a987" },
    { id: "pavilion", name: "Friendship Pavilion", x: -1, z: -20, icon: "友", detail: "Study circle classmates here are NPCs; real shared rooms need a multiplayer server.", action: "Open study circle", route: "school", schoolTab: "circle", requireWords: 10, color: "#bd86a4" },
    { id: "street-pho", name: "Hanoi Phở Stall", x: 18, z: -24.2, icon: "越", detail: "Meet the Hanoi breakfast cook, learn what goes into phở, and add a Vietnam culture card to your journal.", action: "Discover Vietnamese food", route: "school", schoolTab: "culture", cultureSpot: "pho", color: "#d96b56" },
    { id: "street-yatai", name: "Japanese Festival Yatai", x: 26, z: -24.2, icon: "祭", detail: "Explore a matsuri food stall, learn what yatai means, and save a Japan culture card.", action: "Explore festival food", route: "school", schoolTab: "culture", cultureSpot: "yatai", color: "#6d91b4" },
    { id: "street-xiaolongbao", name: "Shanghai Soup Dumplings", x: 34, z: -24.2, icon: "沪", detail: "Discover Shanghai xiaolongbao, try a food-safety question, and save a city culture card.", action: "Discover Shanghai food", route: "school", schoolTab: "culture", cultureSpot: "xiaolongbao", color: "#ce9561" },
    { id: "hunt-lantern", name: "Word Hunt · Lantern", x: 8, z: -17, icon: "灯", detail: "A Word Hunt object. Open the Chinese clue, listen, then check whether this is the object you need.", action: "Check this object", route: "school", schoolTab: "hunt", huntId: "lantern", color: "#de7750" },
    { id: "hunt-book", name: "Word Hunt · Book", x: -10, z: 18, icon: "书", detail: "A Word Hunt object. Open the Chinese clue, listen, then check whether this is the object you need.", action: "Check this object", route: "school", schoolTab: "hunt", huntId: "book", color: "#658ab5" },
    { id: "hunt-tea", name: "Word Hunt · Tea Cup", x: 10, z: 18, icon: "茶", detail: "A Word Hunt object. Open the Chinese clue, listen, then check whether this is the object you need.", action: "Check this object", route: "school", schoolTab: "hunt", huntId: "tea", color: "#78a677" },
    { id: "hunt-bun", name: "Word Hunt · Steamed Bun", x: -20, z: 18, icon: "包", detail: "A Word Hunt object. Open the Chinese clue, listen, then check whether this is the object you need.", action: "Check this object", route: "school", schoolTab: "hunt", huntId: "bun", color: "#c99b68" },
    { id: "hunt-apple", name: "Word Hunt · Apple", x: 21, z: 18, icon: "果", detail: "A Word Hunt object. Open the Chinese clue, listen, then check whether this is the object you need.", action: "Check this object", route: "school", schoolTab: "hunt", huntId: "apple", color: "#bc645a" },
  ];
  // Five low-poly props make the Word Hunt targets visible in the playable plaza.
  function huntProp(x, z, kind) {
    const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
    const part = (geometry, material, px, py, pz, sx = 1, sy = 1, sz = 1) => { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(px, py, pz); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh; };
    if (kind === "lantern") {
      part(new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8), materials.gold, 0, 2.05, 0);
      const body = part(new THREE.SphereGeometry(0.64, 12, 10), mat("#cf5545"), 0, 1.43, 0, 0.68, 0.9, 0.68);
      body.material.emissive = new THREE.Color("#802b20"); body.material.emissiveIntensity = 0.18;
      part(new THREE.CylinderGeometry(0.37, 0.37, 0.09, 10), materials.gold, 0, 1.91, 0);
    } else if (kind === "book") {
      part(boxGeo, mat("#3f7287"), 0, 0.44, 0, 0.9, 0.16, 0.72);
      part(boxGeo, mat("#fff3d8"), 0, 0.72, 0, 0.84, 0.42, 0.68);
      part(boxGeo, mat("#be654f"), -0.36, 0.72, 0, 0.1, 0.44, 0.72);
      part(boxGeo, materials.gold, 0, 0.94, 0, 0.12, 0.1, 0.08);
    } else if (kind === "tea") {
      part(new THREE.CylinderGeometry(0.34, 0.27, 0.42, 12), mat("#f3ead5"), 0, 0.43, 0);
      part(new THREE.CylinderGeometry(0.27, 0.27, 0.13, 12), mat("#9f694a"), 0, 0.61, 0);
      part(new THREE.TorusGeometry(0.22, 0.055, 6, 12), mat("#f3ead5"), 0.33, 0.49, 0).rotation.y = Math.PI / 2;
      part(new THREE.CylinderGeometry(0.5, 0.54, 0.12, 12), materials.wood, 0, 0.08, 0);
    } else if (kind === "bun") {
      part(new THREE.CylinderGeometry(0.55, 0.58, 0.24, 12), materials.wood, 0, 0.16, 0);
      const bun = part(new THREE.SphereGeometry(0.47, 12, 10), mat("#fff4df"), 0, 0.57, 0, 1, 0.8, 1);
      bun.rotation.y = 0.3;
      part(new THREE.ConeGeometry(0.12, 0.24, 7), mat("#fff4df"), 0, 0.94, 0);
    } else {
      const apple = part(new THREE.SphereGeometry(0.48, 12, 10), mat("#d9473f"), 0, 0.58, 0, 1, 0.88, 1);
      apple.material.roughness = 0.42;
      part(new THREE.CylinderGeometry(0.045, 0.06, 0.25, 6), mat("#76573c"), 0, 1.02, 0);
      part(new THREE.SphereGeometry(0.15, 8, 6), materials.leafLight, 0.15, 1.08, 0, 1.3, 0.45, 0.7);
    }
  }
  huntProp(8, -17, "lantern"); huntProp(-10, 18, "book"); huntProp(10, 18, "tea"); huntProp(-20, 18, "bun"); huntProp(21, 18, "apple");
  const markers = [];
  for (const place of landmarks) {
    const markerMat = new THREE.MeshStandardMaterial({ color: place.color, emissive: place.color, emissiveIntensity: 0.22, transparent: true, opacity: 0.9 });
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(place.huntId ? 0.28 : 0.45, 0), markerMat); orb.position.set(place.x, place.huntId ? 2.65 : 2.2, place.z); orb.userData.place = place; scene.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.055, 6, 18), new THREE.MeshBasicMaterial({ color: place.color })); ring.position.set(place.x, 0.13, place.z); ring.rotation.x = -Math.PI / 2; scene.add(ring);
    markers.push({ orb, ring, place });
  }

  const roomConfigs = [
    { id: "classroom", name: "Worldmates School", x: 65, z: 65, layer: 1, wall: "#ead8b7", trim: "#a95f4d", floor: "#cba77a", width: 22, depth: 22, height: 6.5, outside: [-17, -5.2], doorWidth: 3.6, stations: [{ id: "class-desk", label: "Chinese Classroom · Teacher Lin", x: 0, z: 0, icon: "学", tab: "classroom" }, { id: "class-food-quest", label: "Daily food quest board", x: -3.2, z: 4, icon: "🥟", tab: "foodquest" }, { id: "class-board", label: "HSK 1 board", x: 3.2, z: 4, icon: "书", tab: "hsk" }] },
    { id: "library", name: "Campus Library", x: 84, z: 65, layer: 2, wall: "#dae7df", trim: "#527b68", floor: "#c9b493", outside: [-18, 10.4], doorWidth: 3.2, stations: [{ id: "library-table", label: "Reading table", x: 0, z: 0, icon: "书", tab: "words" }, { id: "library-shelf", label: "HSK study shelf", x: -3.8, z: 3.2, icon: "学", tab: "hsk" }] },
    { id: "home", name: "Student House", x: 103, z: 65, layer: 3, wall: "#f0dfd3", trim: "#b96f62", floor: "#bd966c", outside: [-34, 10.4], doorWidth: 3.2, stations: [{ id: "homework-desk", label: "Homework desk", x: 0, z: 0, icon: "文", tab: "lesson" }, { id: "home-books", label: "Family bookcase", x: 3.5, z: 3.4, icon: "书", tab: "words" }] },
    { id: "teahouse", name: "School Tea House", x: 122, z: 65, layer: 4, wall: "#d7e5e7", trim: "#54818b", floor: "#c69b6b", outside: [17, -8.3], doorWidth: 3.2, stations: [{ id: "mei-corner", label: "NPC Conversation Quests", x: 0, z: 0, icon: "梅", tab: "npcquests" }, { id: "mei-chat", label: "Mei’s tea table", x: 3.4, z: 3.2, icon: "茶", tab: "talk" }, { id: "tea-reading", label: "Tea & reading", x: -3.5, z: 3.2, icon: "书", tab: "words" }] },
    { id: "food", name: "Shanghai Food Street", x: 141, z: 65, layer: 5, wall: "#f2dfc4", trim: "#a94f38", floor: "#c99b68", width: 14, depth: 16, height: 5, outside: [32, -8.2], doorWidth: 3.2, stations: [{ id: "food-order", label: "Order with Lin", x: 0, z: 0, icon: "面", tab: "order" }, { id: "food-timer", label: "Timed Food Street Challenge", x: -3.3, z: 3.6, icon: "计", tab: "timedfood" }, { id: "food-table", label: "Weekly word book", x: 3.2, z: 3.6, icon: "饺", tab: "words" }] },
    { id: "dumpling", name: "Dumpling & Tea", x: 160, z: 65, layer: 6, wall: "#f1d7d7", trim: "#a94f38", floor: "#c99b68", width: 14, depth: 16, height: 5, outside: [32, -0.4], doorWidth: 3.2, stations: [{ id: "dumpling-menu", label: "Dumpling menu", x: 0, z: 0, icon: "饺", tab: "lesson" }, { id: "dumpling-table", label: "Tea table", x: 3.2, z: 3.6, icon: "茶", tab: "talk" }] },
    { id: "cafe", name: "Shanghai Coffee House", x: 179, z: 65, layer: 7, wall: "#dce9dd", trim: "#547b68", floor: "#c9b493", width: 14, depth: 16, height: 5, outside: [32, 16.7], doorWidth: 3.2, stations: [{ id: "coffee-menu", label: "Coffee & tea menu", x: 0, z: 0, icon: "咖", tab: "talk" }, { id: "coffee-reading", label: "Window reading table", x: -3.4, z: 3.4, icon: "书", tab: "words" }] },
  ];
  const roomMarkers = [];
  const rooms = new Map();
  function roomBox(group, x, y, z, sx, sy, sz, material) {
    const mesh = new THREE.Mesh(boxGeo, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    const bottom = y - sy / 2, top = y + sy / 2;
    if (bottom < 1.85 && top > 0.2 && sx > 0.18 && sz > 0.18) {
      (group.userData.walkBlockers ||= []).push({ x, z, halfX: sx / 2 + 0.28, halfZ: sz / 2 + 0.28 });
    }
    return mesh;
  }
  function addRoomLabel(group, text, x, y, z, color = "#395045", width = 3.5, height = 0.88) {
    const labelCanvas = document.createElement("canvas"); labelCanvas.width = 1024; labelCanvas.height = 192;
    const context = labelCanvas.getContext("2d"); context.fillStyle = "#fffaf0"; context.beginPath(); context.roundRect(10, 12, 1004, 168, 24); context.fill(); context.strokeStyle = "#c6a96d"; context.lineWidth = 8; context.stroke();
    context.fillStyle = color; context.font = 'bold 74px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif'; context.textAlign = "center"; context.textBaseline = "middle";
    while (context.measureText(text).width > 940 && parseInt(context.font, 10) > 30) context.font = `bold ${parseInt(context.font, 10) - 4}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif`;
    context.fillText(text, 512, 98);
    const texture = new THREE.CanvasTexture(labelCanvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide })); sign.position.set(x, y, z); if (z > 3) sign.rotation.y = Math.PI; group.add(sign);
  }
  function buildRoom(config) {
    const group = new THREE.Group(); group.position.set(config.x, 0, config.z); scene.add(group);
    const wall = mat(config.wall), trim = mat(config.trim), floor = mat(config.floor), ceiling = mat("#f6f0e5"), board = mat("#38564c");
    const wood = materials.wood, gold = materials.gold;
    const roomWidth = config.width || 12, roomDepth = config.depth || 14, roomHeight = config.height || 4.5;
    roomBox(group, 0, -0.12, 0, roomWidth, 0.24, roomDepth, floor);
    // The front wall has a real open doorway that the player can walk through to leave.
    const doorWidth = 3.4, frontWallSpan = roomWidth / 2 - doorWidth / 2, frontWallX = doorWidth / 2 + frontWallSpan / 2;
    roomBox(group, -frontWallX, roomHeight / 2, -roomDepth / 2, frontWallSpan, roomHeight, 0.25, wall); roomBox(group, frontWallX, roomHeight / 2, -roomDepth / 2, frontWallSpan, roomHeight, 0.25, wall); roomBox(group, 0, roomHeight - 0.75, -roomDepth / 2, doorWidth, 1.5, 0.25, wall);
    roomBox(group, 0, roomHeight / 2, roomDepth / 2, roomWidth, roomHeight, 0.25, wall); roomBox(group, -roomWidth / 2, roomHeight / 2, 0, 0.25, roomHeight, roomDepth, wall); roomBox(group, roomWidth / 2, roomHeight / 2, 0, 0.25, roomHeight, roomDepth, wall);
    roomBox(group, 0, roomHeight + 0.05, 0, roomWidth, 0.2, roomDepth, ceiling);
    roomBox(group, 0, 0.08, -roomDepth / 2 + 0.2, 3.8, 0.12, 0.7, trim);
    addRoomLabel(group, config.name, 0, 3.75, 6.72, config.trim);
    // Decorative window panels, wood trim and a warm ceiling lantern.
    for (const x of [-roomWidth * 0.35, roomWidth * 0.35]) { roomBox(group, x, 2.65, roomDepth / 2 - 0.2, 1.7, 1.4, 0.06, mat("#a9d2d4")); roomBox(group, x, 2.65, roomDepth / 2 - 0.28, 1.9, 0.09, 0.12, trim); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshBasicMaterial({ color: "#ffe2a1" })); lamp.position.set(0, 4.25, 0); group.add(lamp);
    const light = new THREE.PointLight("#fff0ca", config.id === "classroom" ? 35 : 18, config.id === "classroom" ? 30 : 18, 2); light.position.set(0, Math.min(roomHeight - 0.4, 4.8), 0); group.add(light);

    const sitSpots = [];
    if (config.id === "classroom") {
      const boardZ = roomDepth / 2 - 2.0;
      // Give the lesson area a large, framed board that reads clearly from
      // across the room instead of blending into the back wall.
      roomBox(group, 0, 2.55, boardZ, 10.2, 2.05, 0.2, wood);
      roomBox(group, 0, 2.55, boardZ - 0.13, 9.75, 1.68, 0.16, board);
      roomBox(group, 0, 1.68, boardZ - 0.14, 9.55, 0.08, 0.12, gold);
      addRoomLabel(group, "CHINESE CLASS  •  HSK 1  •  你好!", 0, 3.02, boardZ - 0.23, "#fff5d8", 8.7, 0.78);
      // Chalk marks and the teacher's ledge make the board look like a place
      // to learn instead of a blank green panel.
      roomBox(group, -3.0, 2.25, boardZ - 0.24, 1.25, 0.04, 0.025, mat("#f5edcf"), false);
      roomBox(group, -1.0, 2.25, boardZ - 0.24, 0.75, 0.04, 0.025, mat("#f5edcf"), false);
      roomBox(group, 1.3, 2.25, boardZ - 0.24, 1.4, 0.04, 0.025, mat("#f5edcf"), false);
      for (const z of [-3.5, 0.5, 4.5]) for (const x of [-4.0, 0, 4.0]) {
        roomBox(group, x, 0.92, z, 1.8, 0.18, 1.0, wood);
        for (const dx of [-0.72, 0.72]) for (const dz of [-0.36, 0.36]) roomBox(group, x + dx, 0.47, z + dz, 0.12, 0.85, 0.12, trim);
        // Center the chair behind its own desk; the seat faces the blackboard.
        const chairX = x;
        roomBox(group, chairX, 0.48, z - 1.42, 0.78, 0.14, 0.72, trim); roomBox(group, chairX, 0.88, z - 1.78, 0.78, 0.8, 0.12, wood);
        for (const dx of [-0.28, 0.28]) for (const dz of [-0.25, 0.25]) roomBox(group, chairX + dx, 0.23, z - 1.42 + dz, 0.09, 0.44, 0.09, trim);
        roomBox(group, x - 0.48, 1.08, z - 0.03, 0.3, 0.06, 0.48, gold);
        sitSpots.push({ x: chairX, z: z - 1.42, yaw: 0 });
      }
    } else if (config.id === "library") {
      for (const x of [-4.5, 4.5]) {
        roomBox(group, x, 1.7, 2.6, 1.5, 3.2, 0.7, wood);
        for (let shelf = 0; shelf < 4; shelf++) {
          roomBox(group, x, 0.5 + shelf * 0.8, 2.2, 1.5, 0.11, 0.9, trim);
          for (let book = 0; book < 5; book++) roomBox(group, x - 0.52 + book * 0.25, 0.82 + shelf * 0.8, 2.36, 0.17, 0.48 + (book % 2) * 0.12, 0.36, mat(["#bd705b", "#648b71", "#dcbb73", "#6987a2", "#a27e9e"][book]));
        }
      }
      roomBox(group, 0, 0.9, 0, 3.6, 0.18, 1.5, wood);
      for (const x of [-1.5, 1.5]) { roomBox(group, x, 0.45, 0, 0.14, 0.85, 0.14, trim); roomBox(group, x, 0.45, -1.1, 0.14, 0.85, 0.14, trim); }
      roomBox(group, 0, 1.03, 5.95, 4.2, 1.0, 0.14, board); addRoomLabel(group, "Reading Room · 静静看书", 0, 1.1, 5.84, "#fff5d8");
    } else if (config.id === "home") {
      roomBox(group, -3.2, 0.75, 2.6, 3.5, 0.24, 1.4, trim); roomBox(group, -3.2, 1.3, 3.1, 3.5, 0.95, 0.45, wall);
      roomBox(group, 3.0, 0.65, 3.2, 2.0, 0.28, 3.2, mat("#e8d5c1"));
      roomBox(group, 3.0, 1.0, 4.2, 2.0, 0.55, 0.3, mat("#faf2e3")); roomBox(group, 3.0, 0.48, 3.2, 0.12, 0.85, 0.12, wood);
      roomBox(group, 0, 0.92, -1.7, 2.2, 0.18, 1.1, wood); roomBox(group, 0, 0.46, -1.7, 0.12, 0.82, 0.12, trim);
      roomBox(group, 0.82, 1.15, -1.65, 0.32, 0.22, 0.32, gold); roomBox(group, -0.65, 1.11, -1.7, 0.42, 0.16, 0.34, mat("#b5d6c0"));
      roomBox(group, -4.5, 1.55, -3.8, 1.3, 2.8, 0.6, wood);
      for (let i = 0; i < 4; i++) roomBox(group, -4.5 + (i - 1.5) * 0.22, 0.75 + (i % 2) * 0.72, -3.43, 0.16, 0.58, 0.25, mat(["#bd705b", "#648b71", "#dcbb73", "#6987a2"][i]));
      addRoomLabel(group, "My Study Corner · 我的书桌", 0, 1.55, -2.55, "#fff5d8");
    } else if (config.id === "cafe") {
      roomBox(group, 0, 2.45, 5.8, 6.4, 1.6, 0.2, board);
      addRoomLabel(group, "上海咖啡 · Coffee & Tea", 0, 3.05, 5.66, "#fff5d8");
      roomBox(group, -4.1, 0.85, 3.4, 2.2, 1.55, 0.9, wood);
      for (const x of [-3.1, 0, 3.1]) {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.1, 0.18, 12), wood); top.position.set(x, 0.95, -0.8); group.add(top);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.78, 8), trim); stem.position.set(x, 0.5, -0.8); group.add(stem);
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.12, 10), trim); foot.position.set(x, 0.1, -0.8); group.add(foot);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.2, 10), mat("#fff5e7")); cup.position.set(x + 0.35, 1.14, -0.8); group.add(cup);
        const chairX = x + 1.4, chairZ = -2.2;
        roomBox(group, chairX, 0.48, chairZ, 0.72, 0.14, 0.72, trim); roomBox(group, chairX, 0.88, chairZ - 0.34, 0.72, 0.8, 0.12, wood);
        sitSpots.push({ x: chairX, z: chairZ, yaw: 0 });
      }
    } else if (config.id === "food" || config.id === "dumpling") {
      // A compact Shanghai-style dining room with a counter, menu board,
      // dumpling baskets, bowls and a long table for vocabulary practice.
      roomBox(group, 0, 2.55, 5.8, 6.8, 1.8, 0.2, board);
      addRoomLabel(group, "上海小吃 · Shanghai Eats", 0, 3.1, 5.66, "#fff5d8");
      roomBox(group, -3.8, 0.78, 3.6, 4.0, 1.45, wood);
      roomBox(group, -3.8, 1.55, 3.6, 4.2, 0.12, gold);
      for (const x of [-2.8, -1.5, 0, 1.5, 3]) {
        roomBox(group, x, 0.95, -0.8, 1.15, 0.16, 2.0, wood);
        roomBox(group, x, 0.5, -1.5, 0.1, 0.8, 0.1, trim);
        roomBox(group, x, 0.5, -0.1, 0.1, 0.8, 0.1, trim);
      }
      for (let i = 0; i < 4; i++) {
        const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.28, 10), mat(i % 2 ? "#d8b778" : "#f1e2c4"));
        basket.position.set(-2.5 + i * 1.6, 1.7, 3.2); group.add(basket);
      }
      addRoomLabel(group, "面条 · 饺子 · 茶", 0, 2.45, 3.0, "#7c4637");
    } else {
      roomBox(group, 0, 0.18, 0.2, 2.4, 0.24, 2.1, wood);
      for (const x of [-0.9, 0.9]) roomBox(group, x, 0.09, 0.2, 0.1, 0.18, 0.1, trim);
      for (const [x, z] of [[-4.1, 2.3], [4.1, 2.3]]) {
        roomBox(group, x, 1.45, z, 1.5, 2.7, 0.7, wood);
        for (let i = 0; i < 3; i++) roomBox(group, x + (i - 1) * 0.34, 1.5, z - 0.36, 0.22, 0.9, 0.28, mat(["#c06f62", "#739577", "#d8b567"][i]));
      }
      addRoomLabel(group, "慢慢喝茶 · Tea & Talk", 0, 3.2, 5.8, "#fff5d8");
    }
    group.traverse(object => { object.layers.set(config.layer); });
    const roomLight = group.children.find(object => object.isLight); if (roomLight) roomLight.layers.set(config.layer);
    // The room camera switches render layers, so it also needs its own fill
    // lighting; otherwise the avatar and furniture become near-black.
    const roomAmbient = new THREE.AmbientLight("#fff1d8", 2.2); roomAmbient.layers.set(config.layer); scene.add(roomAmbient);
    const roomFill = new THREE.PointLight("#fff6e9", config.id === "classroom" ? 90 : 55, config.id === "classroom" ? 40 : 30, 1.5); roomFill.position.set(config.x, 5, config.z - 4); roomFill.layers.set(config.layer); scene.add(roomFill);
    const room = { ...config, width: roomWidth, depth: roomDepth, doorWidth: config.doorWidth || 3.2, group, markers: [], sitSpots, returnPosition: new THREE.Vector3(config.outside[0], 0, config.outside[1]) };
    for (const station of config.stations) {
      const x = config.x + station.x, z = config.z + station.z;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), new THREE.MeshStandardMaterial({ color: "#f0c86d", emissive: "#d6a54d", emissiveIntensity: 0.5 })); orb.position.set(x, 1.65, z); orb.layers.set(config.layer); scene.add(orb);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 18), new THREE.MeshBasicMaterial({ color: "#e0b35c" })); ring.position.set(x, 0.12, z); ring.rotation.x = -Math.PI / 2; ring.layers.set(config.layer); scene.add(ring);
      addRoomLabel(group, `${station.icon} ${station.label}`, station.x, 2.5, station.z - 0.3, "#455c49");
      const place = { id: station.id, name: station.label, x, z, icon: station.icon, detail: `Use the ${station.label.toLowerCase()} to continue learning inside the ${config.name.toLowerCase()}.`, action: "Start activity", route: "school", schoolTab: station.tab };
      const marker = { orb, ring, place, room };
      room.markers.push(marker); roomMarkers.push(marker);
    }
    rooms.set(config.id, room);
  }
  roomConfigs.forEach(buildRoom);

  const keys = new Set();
  const heldTouch = new Set();
  const joystickVector = new THREE.Vector2();
  const joystick = document.querySelector("[data-touch-joystick]");
  const joystickKnob = document.querySelector("[data-joystick-knob]");
  let joystickPointerId = null;
  let yaw = 0, pitch = 0.22, dragging = false, previousX = 0, previousY = 0, velocityY = 0, grounded = true, landingTime = 0;
  let activePlace = null, activeEmote = null, activeEmoteTime = 0, autoWalkTarget = null;
  let autoWalkWaypoints = [];
  let insideRoom = null;
  let sitCameraYaw = 0;
  let running = true;
  const dialog = document.querySelector("#world-interaction");
  const roomStatus = document.querySelector(".room-status");
  const roomExit = document.querySelector("[data-room-exit]");
  const worldExit = document.querySelector(".world-exit");
  const studyPortal = document.querySelector(".world-study-portal");
  roomExit?.addEventListener("click", () => leaveRoom());

  function enterRoom(id) {
    const room = rooms.get(id); if (!room) return;
    insideRoom = room;
    canvas.parentElement.classList.add("in-room");
    if (studyPortal) { studyPortal.hidden = true; studyPortal.style.display = "none"; }
    if (worldExit) worldExit.style.display = "none";
    if (roomExit) {
      roomExit.hidden = false;
      roomExit.style.setProperty("display", "inline-flex", "important");
      roomExit.style.setProperty("position", "absolute", "important");
      roomExit.style.setProperty("top", "54px", "important");
      roomExit.style.setProperty("left", "14px", "important");
      roomExit.style.setProperty("transform", "none", "important");
      roomExit.style.setProperty("z-index", "20", "important");
    }
    const activeEmoteBar = canvas.parentElement.querySelector(".world-emotes");
    if (activeEmoteBar && window.matchMedia("(max-width: 760px)").matches) { activeEmoteBar.style.top = "52px"; activeEmoteBar.style.bottom = "auto"; }
    // Spawn in the teaching aisle so the nearest desk never hides the avatar
    // in the third-person classroom camera.
    player.position.set(room.x, 0, room.z - Math.min(5.5, room.depth / 2 - 1.7));
    player.userData.horizontalVelocity?.set(0, 0, 0);
    player.traverse(object => object.layers.enable(room.layer));
    camera.layers.set(room.layer); camera.far = 90; camera.updateProjectionMatrix();
    yaw = 0; pitch = 0.12; player.rotation.y = 0; velocityY = 0; grounded = true; activeEmote = null;
    roomStatus.innerHTML = `<i></i> INSIDE ${escapeHtml(room.name.toUpperCase())}`;
    if (findSchool) findSchool.hidden = true;
    const sitButton = emoteBar.querySelector('[data-world-emote="Sit"]');
    if (sitButton) { sitButton.textContent = "Sit"; sitButton.disabled = room.sitSpots.length === 0; sitButton.title = room.sitSpots.length ? "Sit at a desk; press again to stand" : "No seat in this room"; }
    hidePlace();
  }
  function leaveRoom() {
    if (!insideRoom) return;
    const room = insideRoom;
    player.position.copy(room.returnPosition);
    player.userData.horizontalVelocity?.set(0, 0, 0);
    insideRoom = null; camera.layers.set(0); camera.far = 280; camera.updateProjectionMatrix();
    canvas.parentElement.classList.remove("in-room");
    if (studyPortal) { studyPortal.hidden = false; studyPortal.style.removeProperty("display"); }
    if (worldExit) worldExit.style.removeProperty("display");
    if (roomExit) { roomExit.hidden = true; roomExit.style.removeProperty("display"); roomExit.style.removeProperty("position"); roomExit.style.removeProperty("top"); roomExit.style.removeProperty("left"); roomExit.style.removeProperty("transform"); roomExit.style.removeProperty("z-index"); }
    const activeEmoteBar = canvas.parentElement.querySelector(".world-emotes");
    if (activeEmoteBar) { activeEmoteBar.style.removeProperty("top"); activeEmoteBar.style.removeProperty("bottom"); }
    yaw = 0; pitch = 0.22; velocityY = 0; grounded = true; activeEmote = null; avatar.setAnimation("Idle");
    roomStatus.innerHTML = "<i></i> PRIVATE SOLO ROOM";
    if (findSchool) findSchool.hidden = false;
    const sitButton = emoteBar.querySelector('[data-world-emote="Sit"]');
    if (sitButton) { sitButton.textContent = "Sit"; sitButton.disabled = true; sitButton.title = "Enter a room to sit"; }
  }

  function showPlace(place) {
    activePlace = place;
    const wordsCollected = getProfile().wordCollection?.length || 0;
    const wordsNeeded = Math.max(0, (place.requireWords || 0) - wordsCollected);
    const isLocked = wordsNeeded > 0;
    dialog.hidden = false;
    dialog.innerHTML = `<button class="interaction-close" aria-label="Close">×</button><span class="interaction-icon">${place.icon}</span><p class="eyebrow">${isLocked ? "CAMPUS GOAL" : "YOU FOUND A PLACE"}</p><h2>${escapeHtml(place.name)}</h2><p>${escapeHtml(isLocked ? `Collect ${wordsNeeded} more Chinese words to unlock this location. You have ${wordsCollected} so far.` : place.detail)}</p><button class="primary-btn interaction-action" ${isLocked ? "disabled" : ""}>${escapeHtml(isLocked ? `Unlock after ${place.requireWords} words` : place.action)} <span>${isLocked ? "🔒" : "→"}</span></button>`;
    dialog.querySelector(".interaction-close").addEventListener("click", hidePlace);
    dialog.querySelector(".interaction-action").addEventListener("click", () => {
      if (isLocked) return;
      const firstVisit = rewardWorldVisit(place.id);
      if (place.route === "room") { enterRoom(place.roomId); return; }
      if (place.route === "school") { hidePlace(); window.dispatchEvent(new CustomEvent("lantern:open-school", { detail: { tab: place.schoolTab, cultureSpot: place.cultureSpot, huntSpot: place.huntId } })); return; }
      dialog.querySelector(".interaction-action").textContent = firstVisit ? "Discovery saved · +5 XP · +1 coin ✧" : "You’ve explored this spot ✧";
      dialog.querySelector(".interaction-action").disabled = true;
    });
  }
  function hidePlace() { dialog.hidden = true; activePlace = null; }
  function escapeHtml(str) { return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
  function openNearest() {
    if (activePlace) { hidePlace(); return; }
    let closest = null, best = 100;
    for (const { place } of (insideRoom ? insideRoom.markers : markers)) {
      const d = (player.position.x - place.x) ** 2 + (player.position.z - place.z) ** 2;
      if (d < best) { closest = place; best = d; }
    }
    if (closest && best < 18) showPlace(closest);
  }

  // A guided walking route helps new players find the school on a small phone screen.
  const findSchool = document.querySelector("[data-find-school]");
  const findCulture = document.querySelector("[data-find-culture]");
  findSchool?.addEventListener("click", () => {
    if (insideRoom) leaveRoom();
    hidePlace();
    autoWalkTarget = landmarks.find(place => place.id === "classroom");
    // Follow the main road first, then approach the school's front door from outside.
    // A direct diagonal would cut through the solid school building.
    // Stay on the plaza road, then stop outside the school’s visible south entrance.
    // The noodle-house return point sits beside a tree at (29, -8). Starting
    // the guided walk with a diagonal toward the plaza runs into that trunk.
    // First leave the storefront straight onto the road, then follow the road.
    const clearFoodStreetDoor = player.position.x > 20 && player.position.z < -4
      ? [new THREE.Vector3(player.position.x, 0, -3.5)]
      : [];
    autoWalkWaypoints = [...clearFoodStreetDoor, new THREE.Vector3(0, 0, -3.5), new THREE.Vector3(-17, 0, -3.5), new THREE.Vector3(autoWalkTarget.x, 0, autoWalkTarget.z)];
    const dx = autoWalkWaypoints[0].x - player.position.x, dz = autoWalkWaypoints[0].z - player.position.z;
    yaw = Math.atan2(-dx, -dz);
    findSchool.innerHTML = "🏫 Walking to the school gate…";
    if (findCulture) findCulture.innerHTML = "🌏 Explore Culture Street <span>three stalls · three stories</span>";
  });
  findCulture?.addEventListener("click", onFindCultureStreet);
  function onFindFood() {
    if (insideRoom) leaveRoom();
    hidePlace();
    autoWalkTarget = landmarks.find(place => place.id === "noodle-house");
    autoWalkWaypoints = [new THREE.Vector3(0, 0, -3.5), new THREE.Vector3(32, 0, -3.5), new THREE.Vector3(autoWalkTarget.x, 0, autoWalkTarget.z)];
    const dx = autoWalkWaypoints[0].x - player.position.x, dz = autoWalkWaypoints[0].z - player.position.z;
    yaw = Math.atan2(-dx, -dz);
    if (findSchool) findSchool.innerHTML = "🥟 Walking to Shanghai Food Street…";
  }
  window.addEventListener("world:find-food", onFindFood);
  function onFindCultureStreet() {
    if (insideRoom) leaveRoom();
    hidePlace();
    autoWalkTarget = landmarks.find(place => place.id === "street-pho");
    // Go around the noodle house, then follow the marked promenade into the
    // three-stall market instead of steering through solid building geometry.
    autoWalkWaypoints = [new THREE.Vector3(0, 0, -3.5), new THREE.Vector3(40.6, 0, -3.5), new THREE.Vector3(40.6, 0, -24.2), new THREE.Vector3(18, 0, -24.2)];
    const dx = autoWalkWaypoints[0].x - player.position.x, dz = autoWalkWaypoints[0].z - player.position.z;
    yaw = Math.atan2(-dx, -dz);
    const findCulture = document.querySelector("[data-find-culture]");
    if (findCulture) findCulture.textContent = "Walking to the Cultural Street…";
  }
  window.addEventListener("world:find-culture", onFindCultureStreet);

  function onKeyDown(event) {
    if (!visible) return;
    if (event.target?.closest?.("button, a, input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
    if (event.code === "KeyE" && !event.repeat) { openNearest(); return; }
    const emotes = { Digit1: "Wave", Digit2: "Sit", Digit3: "Dance", Digit4: "Celebrate" };
    if (emotes[event.code] && !event.repeat) { playEmote(emotes[event.code]); return; }
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) { autoWalkTarget = null; autoWalkWaypoints = []; if (findSchool) findSchool.innerHTML = "🏫 Walk to the School Gate <span>along the road →</span>"; if (findCulture) findCulture.innerHTML = "🌏 Explore Culture Street <span>three stalls · three stories</span>"; }
    keys.add(event.code);
  }
  function onKeyUp(event) { keys.delete(event.code); }
  function playEmote(name) {
    const sitButton = emoteBar.querySelector('[data-world-emote="Sit"]');
    if (name === "Sit") {
      if (!insideRoom?.sitSpots.length) return;
      if (activeEmote === "Sit") { activeEmote = null; activeEmoteTime = 0; sitButton.textContent = "Sit"; yaw = sitCameraYaw; avatar.setAnimation("Idle"); return; }
      const spot = insideRoom.sitSpots.reduce((best, candidate) => {
        const x = insideRoom.x + candidate.x, z = insideRoom.z + candidate.z;
        const distance = (player.position.x - x) ** 2 + (player.position.z - z) ** 2;
        return !best || distance < best.distance ? { candidate, distance } : best;
      }, null)?.candidate;
      if (spot) { player.position.set(insideRoom.x + spot.x, 0, insideRoom.z + spot.z); player.rotation.y = spot.yaw; sitCameraYaw = yaw; yaw = 2.2; }
      player.userData.horizontalVelocity?.set(0, 0, 0);
      activeEmote = "Sit"; activeEmoteTime = Infinity; sitButton.textContent = "Stand"; avatar.setAnimation("Sit"); return;
    }
    activeEmote = name; activeEmoteTime = name === "Dance" ? 2 : name === "Wave" ? 1.2 : 1.1; avatar.setAnimation(name);
  }
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
    pitch = THREE.MathUtils.clamp(pitch + (event.clientY - previousY) * 0.003, insideRoom ? -0.45 : -0.05, 0.65);
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
  function onBlur() { keys.clear(); heldTouch.clear(); releaseJoystick(); }
  window.addEventListener("blur", onBlur);
  function onProfile(e) {
    const saved = e.detail;
    if (saved.appearance?.characterId && saved.appearance.characterId !== player.userData.characterId) {
      const position = player.position.clone();
      avatar.dispose(); scene.remove(player);
      avatar = createCharacter({ characterId: saved.appearance.characterId, appearance: saved.appearance, playerIdentity: saved.name, onStatus: updateAvatarStatus });
      player = avatar.root; setAvatarRoomLayers(player); player.scale.setScalar(0.92 * player.userData.renderScale); player.position.copy(position); scene.add(player);
    } else {
      avatar.updateAppearance(saved.appearance || {});
      avatar.root.userData.playerIdentity = saved.name;
    }
  }
  window.addEventListener("lantern:profile", onProfile);

  const emoteBar = document.createElement("div");
  emoteBar.className = "world-emotes";
  emoteBar.setAttribute("aria-label", "Avatar emotes");
  emoteBar.innerHTML = '<button data-world-emote="Wave">Wave</button><button data-world-emote="Sit" title="Enter a room to sit" disabled>Sit</button><button data-world-emote="Dance">Dance</button><button data-world-emote="Celebrate">Celebrate</button>';
  canvas.parentElement.appendChild(emoteBar);
  emoteBar.addEventListener("click", event => { const button = event.target.closest("[data-world-emote]"); if (button) playEmote(button.dataset.worldEmote); });

  joystick.addEventListener("pointerdown", event => {
    event.preventDefault();
    joystickPointerId = event.pointerId;
    autoWalkTarget = null; autoWalkWaypoints = []; if (findSchool) findSchool.innerHTML = "🏫 Walk to the School Gate <span>along the road →</span>"; if (findCulture) findCulture.innerHTML = "🌏 Explore Culture Street <span>three stalls · three stories</span>";
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
    if (!running || !visible) return;
    const dt = Math.min((time - previousTime) / 1000 || 0, 0.04); previousTime = time;
    const forward = THREE.MathUtils.clamp(Number(keys.has("KeyW") || keys.has("ArrowUp") || heldTouch.has("KeyW")) - Number(keys.has("KeyS") || keys.has("ArrowDown") || heldTouch.has("KeyS")) + joystickVector.y, -1, 1);
    const side = THREE.MathUtils.clamp(Number(keys.has("KeyD") || keys.has("ArrowRight") || heldTouch.has("KeyD")) - Number(keys.has("KeyA") || keys.has("ArrowLeft") || heldTouch.has("KeyA")) + joystickVector.x, -1, 1);
    const runningFast = keys.has("ShiftLeft") || keys.has("ShiftRight") || heldTouch.has("ShiftLeft");
    if (keys.has("Space") && grounded) { velocityY = 7; grounded = false; }
    const speed = runningFast ? 8.6 : 4.7;
    const direction = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(direction.z, 0, -direction.x);
    let movement = direction.multiplyScalar(-forward).add(right.multiplyScalar(side));
    if (autoWalkTarget && !insideRoom) {
      const waypoint = autoWalkWaypoints[0] || new THREE.Vector3(autoWalkTarget.x, 0, autoWalkTarget.z);
      const dx = waypoint.x - player.position.x, dz = waypoint.z - player.position.z;
      if (Math.hypot(dx, dz) < 1.25 && autoWalkWaypoints.length) {
        autoWalkWaypoints.shift();
        movement.set(0, 0, 0);
      } else if (Math.hypot(dx, dz) < 1.45) {
        const destination = autoWalkTarget; autoWalkTarget = null; autoWalkWaypoints = [];
        if (destination.id === "noodle-house") { if (findSchool) findSchool.textContent = "🥟 You’re at Food Street"; }
        else if (destination.id === "street-pho") { if (findCulture) findCulture.textContent = "🌏 You’re at Culture Street"; }
        else if (findSchool) findSchool.textContent = "🏫 You’re at the School Gate";
        showPlace(destination); movement.set(0, 0, 0);
      } else {
        const targetYaw = Math.atan2(-dx, -dz);
        yaw = targetYaw;
        movement.set(dx, 0, dz).normalize();
      }
    }
    const inputStrength = Math.min(1, movement.length());
    if (inputStrength > 0) movement.normalize().multiplyScalar(speed * inputStrength);
    else movement.set(0, 0, 0);
    const horizontalVelocity = player.userData.horizontalVelocity || (player.userData.horizontalVelocity = new THREE.Vector3());
    horizontalVelocity.lerp(movement, 1 - Math.exp(-11 * dt));
    const previousX = player.position.x, previousZ = player.position.z;
    const nextX = previousX + horizontalVelocity.x * dt;
    const nextZ = previousZ + horizontalVelocity.z * dt;
    if (insideRoom) {
      const room = insideRoom;
      const frontWallZ = room.z - room.depth / 2;
      const currentLocal = { x: player.position.x - room.x, z: player.position.z - room.z };
      const wasInsideFurniture = room.group.userData.walkBlockers.some(c => Math.abs(currentLocal.x - c.x) < c.halfX && Math.abs(currentLocal.z - c.z) < c.halfZ);
      let roomX = THREE.MathUtils.clamp(nextX, room.x - room.width / 2 + 0.55, room.x + room.width / 2 - 0.55);
      let roomZ = nextZ;
      const nearDoor = Math.abs(roomX - room.x) < room.doorWidth / 2 - 0.48;
      if (roomZ > room.z + room.depth / 2 - 0.55) roomZ = room.z + room.depth / 2 - 0.55;
      if (roomZ < frontWallZ + 0.35 && !nearDoor) roomZ = frontWallZ + 0.35;
      const toLocal = (x, z) => ({ x: x - room.x, z: z - room.z });
      const xCandidate = toLocal(roomX, player.position.z);
      if (!wasInsideFurniture && room.group.userData.walkBlockers.some(c => Math.abs(xCandidate.x - c.x) < c.halfX && Math.abs(xCandidate.z - c.z) < c.halfZ)) {
        roomX = player.position.x; horizontalVelocity.x = 0;
      }
      const zCandidate = toLocal(roomX, roomZ);
      if (!wasInsideFurniture && room.group.userData.walkBlockers.some(c => Math.abs(zCandidate.x - c.x) < c.halfX && Math.abs(zCandidate.z - c.z) < c.halfZ)) {
        roomZ = player.position.z; horizontalVelocity.z = 0;
      }
      player.position.set(roomX, player.position.y, roomZ);
      // Check the player's resulting position, not only a single-frame plane
      // crossing. A long key press can cross several steps in one input window.
      const doorExit = player.position.z < frontWallZ - 0.35 && Math.abs(player.position.x - room.x) < room.doorWidth / 2 - 0.48;
      if (doorExit) leaveRoom();
    } else {
      if (!isBlockedOutdoor(nextX, player.position.z)) player.position.x = nextX;
      else horizontalVelocity.x = 0;
      if (!isBlockedOutdoor(player.position.x, nextZ)) player.position.z = nextZ;
      else horizontalVelocity.z = 0;
      player.position.x = THREE.MathUtils.clamp(player.position.x, -42, 42);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -42, 42);
      const entered = exteriorEntrances.find(entrance => {
        const crossed = entrance.frontSign > 0 ? previousZ > entrance.facadeZ && player.position.z <= entrance.facadeZ : previousZ < entrance.facadeZ && player.position.z >= entrance.facadeZ;
        return crossed && Math.abs(player.position.x - entrance.x) < entrance.doorWidth / 2 - 0.45;
      });
      if (entered) enterRoom(entered.roomId);
    }
    if (horizontalVelocity.lengthSq() > 0.025) {
      const targetHeading = Math.atan2(horizontalVelocity.x, horizontalVelocity.z);
      // Interpolate the shortest angular distance so left/right changes never
      // spin the avatar the long way across the +/- PI boundary.
      const headingDelta = Math.atan2(Math.sin(targetHeading - player.rotation.y), Math.cos(targetHeading - player.rotation.y));
      player.rotation.y += headingDelta * (1 - Math.exp(-12 * dt));
    }
    // The room/outdoor movement branches already constrain the player to the
    // walkable floor and handle doorway transitions before gravity is applied.
    velocityY -= 19 * dt; player.position.y += velocityY * dt;
    if (player.position.y <= 0) { player.position.y = 0; velocityY = 0; if (!grounded) landingTime = 0.34; grounded = true; }
    // Pull back inside compact rooms so a seated or standing player stays in
    // frame on narrow phone screens. Aim a little lower while seated to keep
    // the legs and chair visible instead of cropping the head and shoulders.
    const cameraDistance = activeEmote === "Sit" ? 4.4 : insideRoom ? 5.3 : 5.8;
    const target = new THREE.Vector3(player.position.x, player.position.y + (activeEmote === "Sit" ? 0.82 : insideRoom ? 1.05 : 1.2), player.position.z);
    const roomCameraSide = insideRoom ? -1 : 1;
    const desiredCamera = new THREE.Vector3(target.x + roomCameraSide * Math.sin(yaw) * Math.cos(pitch) * cameraDistance, target.y + 2.1 + Math.sin(pitch) * 4.5, target.z + roomCameraSide * Math.cos(yaw) * Math.cos(pitch) * cameraDistance);
    camera.position.lerp(desiredCamera, 1 - Math.exp(-8 * dt));
    camera.lookAt(target.x, target.y + (activeEmote === "Sit" ? 0.16 : 0.35), target.z);
    markers.forEach(({ orb, ring }, i) => { orb.rotation.y += dt * 0.75; orb.position.y = 2.05 + Math.sin(time * 0.0015 + i) * 0.18; ring.material.opacity = 0.75 + Math.sin(time * 0.003 + i) * 0.2; });
    animatedLanterns.forEach(({ mesh, origin, phase }) => { mesh.position.y = origin + Math.sin(time * 0.0012 + phase) * 0.045; mesh.rotation.z = Math.sin(time * 0.0008 + phase) * 0.035; });
    landingTime = Math.max(0, landingTime - dt);
    if (!grounded || horizontalVelocity.lengthSq() > 0.025) {
      if (activeEmote === "Sit") {
        emoteBar.querySelector('[data-world-emote="Sit"]').textContent = "Sit";
        yaw = sitCameraYaw;
      }
      activeEmote = null;
    }
    if (activeEmote) { activeEmoteTime -= dt; if (activeEmoteTime <= 0) activeEmote = null; }
    const nextAnimation = !grounded ? "Jump" : landingTime > 0 ? "Land" : activeEmote || (horizontalVelocity.lengthSq() > 0.12 ? (runningFast ? "Run" : "Walk") : "Idle");
    if (avatar.animation !== nextAnimation.toLowerCase()) avatar.setAnimation(nextAnimation);
    avatar.update(dt);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }
  let visible = true;
  frame = requestAnimationFrame(animate);

  function setVisible(nextVisible) {
    visible = Boolean(nextVisible);
    if (!visible) { cancelAnimationFrame(frame); keys.clear(); heldTouch.clear(); releaseJoystick(); }
    else { previousTime = 0; resize(); frame = requestAnimationFrame(animate); }
  }

  function dispose() {
    running = false; cancelAnimationFrame(frame); resizeObserver.disconnect();
    window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur); window.removeEventListener("lantern:profile", onProfile); window.removeEventListener("world:find-food", onFindFood);
    roomExit?.removeEventListener("click", leaveRoom);
    canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointermove", pointerMove); canvas.removeEventListener("pointerup", pointerUp); canvas.removeEventListener("pointercancel", pointerUp);
    emoteBar.remove();
    renderer.dispose(); scene.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); if (obj.material && !Array.isArray(obj.material)) obj.material.dispose(); });
  }
  return { dispose, showNearest: openNearest, setVisible };
}
