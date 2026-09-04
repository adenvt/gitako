import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";

// Tauri expects a fixed port and no clearing of the terminal.
export default defineConfig({
  fmt: {
    ignorePatterns: [],
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Lets CSS @font-face url() and any TS imports resolve /assets/*.
      "@assets": fileURLToPath(new URL("./assets", import.meta.url)),
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
      exclude: ["**/*.module.css", "**/index.ts"],
      // GitHub Actions uses the json-summary + json reporters to render
      // a per-PR coverage comment and trend line
      // (davelosert/vitest-coverage-report-action). The `text` reporter
      // gives the local terminal the same table the user is used to
      // seeing from `npm run coverage`. `reportOnFailure` lets the
      // reporter emit even if a test fails, so the PR comment is
      // still posted on red.
      reporter: ["text", "json-summary", "json", "lcov"],
      reportOnFailure: true,
    },
  },
  css: {
    postcss: {
      plugins: [autoprefixer()],
    },
  },
  staged: {
    "*.{js,ts,tsx,vue,svelte}": "vp check --fix",
  },
});
