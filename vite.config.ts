import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port and no clearing of the terminal.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  test: {
    // happy-dom gives us localStorage / window for util + store tests
    // without the weight of jsdom. Files that don't need it (pure logic)
    // still run fine.
    environment: "happy-dom",
    setupFiles: ["./src/test-setup.ts"],
    // The dev machine sets NODE_ENV=production globally, which causes
    // vite-plus to load React's production build. Testing-library needs
    // the development build to call act(); force dev here.
    env: { NODE_ENV: "development" },
    coverage: {
      // CSS modules and barrel re-exports can't be meaningfully tested.
      // Exclude them so the coverage % reflects the actual code surface.
      exclude: [
        "**/*.module.css",
        "**/index.ts",
      ],
    },
  },
});
