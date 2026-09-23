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
        // Stable entry name keeps index.html static; lazy page chunks land in
        // /assets/ with content hashes so the Worker can cache them immutable.
        entryFileNames: "app.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (asset) =>
          asset.name?.endsWith(".css") ? "style.css" : "assets/[name][extname]",
      },
    },
  },
  server: {
    port: 5173,
    // API_PROXY lets a dev frontend run against a staging/live API when no
    // local worker is running; default stays the local wrangler port.
    proxy: {
      "/api": process.env.API_PROXY || "http://localhost:8787",
      "/docs": process.env.API_PROXY || "http://localhost:8787",
    },
  },
});
