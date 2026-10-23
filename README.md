# Little Lantern

Little Lantern is one website with two connected modes: a picture based Mandarin lesson and a playable, single player 3D plaza. The project keeps the original HTML/CSS structure and uses Three.js for the world.

## Run it locally

1. Install [Node.js](https://nodejs.org/) (npm is included).
2. In a terminal, open this project folder: `cd C:\Users\S\Desktop\ChineseGame`
3. Install project packages: `npm install`
4. Start the development website: `npm run dev`
5. Open the local address shown in the terminal (Vite usually prints `http://localhost:5173`).

For a production build, run `npm run build`. To preview that build locally, run `npm run preview`.

## Files

- `index.html` — shared site shell, home page, Study Mode, Social World, and player dialogs.
- `styles.css` and `world.css` — shared site styling and responsive world UI.
- `src/app.js` — Home/Study/World navigation, question feedback, shared profile UI, and rewards.
- `src/questions.js` — the Stage 1 picture questions.
- `src/profile.js` — local saved player name, avatar color, XP, coins, lesson count, level, and achievements.
- `src/world.js` — Three.js plaza, avatar, camera, keyboard/touch movement, jump, run, and location interactions.
- `src/assets/models/characters/anime-female-mage/anime_female_mage.glb` — imported skinned anime traveler used for the default avatar in Character Studio and Social World.
- `src/assets/models/characters/anime-female-mage/textures/` — resized WebP color maps for the face, body, eyes, hair, and outfit.
- `src/assets/models/characters/ASSET_CREDITS.md` — source and license attribution for the imported model.
- `package.json` / `package-lock.json` — Three.js and Vite dependencies and commands.

## What works now

- Home, Study Mode, and Social World live in the same site, with navigation in both directions.
- Eight picture questions still work. Correct answers award 10 XP and 2 coins; incorrect answers award 3 XP. The first answer unlocks the First steps achievement.
- Social World is a single-player Three.js plaza with four destination buildings, trees, roads, a pond, a pavilion, floating location markers, and a Chinese classroom portal to Study Mode.
- Walk with `W A S D` or arrow keys, run with `Shift`, jump with `Space`, and drag on the world to rotate the camera. On touch screens, use the on-screen direction, Run, and Jump buttons.
- Approach a glowing location marker and press `E` to open it. First-time visits to the Tea House, Bookshop, Garden Hall, and Friendship Pavilion award 5 XP and 1 coin each.
- Customize your player name and avatar color. The same profile appears in both modes and is saved in this browser using local storage.
- The default female avatar is a real skinned anime model with a 106-bone rig and authored idle/run clips. The existing loader shares it across Character Studio, profile preview, and the playable world.
- Walk uses the supplied run animation at a slower playback rate. Jump and landing remain driven by the existing world physics with simple avatar pose feedback. Wave, sit, dance, and celebrate use procedural poses because the model does not include matching named clips.
- The Social World labels the room as private solo play; no fake online users are shown.

## Multiplayer and communication

The local room and its location interaction points are structured separately from the renderer so a shared-room transport can be added later. There is no realtime server configured in this project, so multiplayer, text chat, and proximity voice chat are not active. They will need a hosted room service (or a WebSocket/WebRTC backend), authentication, and moderation/privacy controls before real communication is enabled. Mute, block, and report controls are therefore not shown as if they already worked.

Progress is device-local. Accounts and cross-device/cloud saving require a database and authentication service, neither of which is configured here.

## Character asset notes

The imported model is the free Tier 1 GLB from Dawn to Dusk Games. The source page lists it under CC0 1.0. The female default is replaced; the other three starter selections still use this project's existing generated models. The GLB is about 6 MB with the rig, geometry, vertex paint, and animation data. Its five 2048 px PNG color maps are included as optimized 1024 px WebP textures; the extra FBX export is not served by this website.
