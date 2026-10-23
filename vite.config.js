import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves project sites from /<repository-name>/.
  // Keep local development and other root-domain hosts at /.
  base: process.env.GITHUB_ACTIONS === "true" ? "/ChineseGame/" : "/",
  // Character binaries are immutable source assets and can be large enough to
  // exceed the Windows file watcher handle limits. They are imported with ?url.
  server: { watch: { ignored: ["**/src/assets/models/characters/*.glb", "**/src/assets/models/characters/*.vrm", "**/public/assets/models/characters/maid/**"] } },
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll("\\", "/");
          if (normalized.includes("/node_modules/three/build/three.module.js")) return "three-core";
        },
      },
    },
  },
});
