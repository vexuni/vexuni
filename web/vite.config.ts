import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Worker serves a fixed allowlist of asset paths and falls back to
// /index.html for everything else, so the build emits stable filenames
// (app.js / style.css) instead of content-hashed bundles.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "../public",
    emptyOutDir: false,
    target: "es2020",
    rollupOptions: {
      output: {
        entryFileNames: "app.js",
        inlineDynamicImports: true,
        assetFileNames: (asset) =>
          asset.name?.endsWith(".css") ? "style.css" : "assets/[name][extname]",
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
      "/docs": "http://localhost:8787",
    },
  },
});
