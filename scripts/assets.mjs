import "./i18n.mjs";
import "./content.mjs";
import "./highlight.mjs";
// The web UI is a Vite build (web/) emitting public/app.js + public/style.css.
// Content-version the entry points: HTML revalidates; versioned assets stay cached.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
async function update(path, content) {
  if ((await readFile(path, "utf8")) !== content)
    await writeFile(path, content);
}
const appHash = hash(await readFile("public/app.js")),
  styleHash = hash(await readFile("public/style.css"));
let html = await readFile("public/index.html", "utf8");
html = html
  .replace(
    /href="\/style\.css(?:\?v=[a-f0-9]+)?"/,
    `href="/style.css?v=${styleHash}"`,
  )
  .replace(/src="\/app\.js(?:\?v=[a-f0-9]+)?"/, `src="/app.js?v=${appHash}"`);
html = html.replace(/\s*<link rel="modulepreload"[^>]*>(?:\n)?/g, "");
await update("public/index.html", html);
