import { defineConfig } from "vite";

export default defineConfig({
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
