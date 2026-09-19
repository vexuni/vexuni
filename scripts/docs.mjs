import fs from "node:fs/promises";
import path from "node:path";
import MarkdownIt from "markdown-it";
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const files = (await fs.readdir("docs"))
  .filter((f) => f.endsWith(".md"))
  .sort();
const rootPages = ["README", "CONTRIBUTING", "SECURITY"];
const pages = [
  ...rootPages.map((name) => ({ name, zh: name + ".md", en: name + ".en.md" })),
  ...files.map((f) => ({
    name: f.slice(0, -3),
    zh: "docs/" + f,
    en: "docs/en/" + f,
  })),
];
const sources = new Map();
for (const page of pages)
  for (const lang of ["zh-CN", "en"]) {
    const source = lang === "en" ? page.en : page.zh;
    const text = await fs.readFile(source, "utf8");
    sources.set(source, {
      page,
      lang,
      text,
      title: text.match(/^#\s+(.+)$/m)?.[1] || page.name,
    });
  }
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_ -]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
const startNames = [
  "README",
  "DEPLOYMENT",
  "ARCHITECTURE",
  "LIMITS",
  "CONTRIBUTING",
  "SECURITY",
];
const groups = (items) => {
  const start = [],
    guides = [],
    reports = [];
  for (const item of items) {
    if (startNames.includes(item.page.name)) start.push(item);
    else if (/^VERIFICATION/.test(item.page.name)) reports.push(item);
    else guides.push(item);
  }
  start.sort((a, b) => startNames.indexOf(a.page.name) - startNames.indexOf(b.page.name));
  return [
    { en: "Start here", zh: "从这里开始", items: start },
    { en: "Guides", zh: "指南", items: guides },
    { en: "Verification reports", zh: "历史验收报告", items: reports },
  ].filter((g) => g.items.length);
};
for (const lang of ["zh-CN", "en"]) {
  await fs.mkdir(`public/docs/${lang}`, { recursive: true });
  const english = lang === "en",
    other = english ? "zh-CN" : "en";
  const items = pages.map((p) => sources.get(english ? p.en : p.zh));
  const grouped = groups(items);
  const link = ({ page, title }, current) =>
    `<a href="/docs/${lang}/${page.name}.html"${page.name === current ? ' class="active" aria-current="page"' : ""}>${escape(title)}</a>`;
  const navFor = (current) =>
    grouped
      .map(
        (g) =>
          `<p class="nav-group">${english ? g.en : g.zh}</p>` +
          g.items.map((item) => link(item, current)).join(""),
      )
      .join("");
  for (const { page, text, title } of items) {
    const source = english ? page.en : page.zh;
    const md = new MarkdownIt({
      html: false,
      linkify: true,
      typographer: false,
    });
    const normalImage = md.renderer.rules.image;
    md.renderer.rules.image = (tokens, idx, options, env, self) => {
      if (
        tokens[idx].attrGet("src") ===
        "https://deploy.workers.cloudflare.com/button"
      )
        return `<strong>${english ? "Deploy to Cloudflare →" : "部署到 Cloudflare →"}</strong>`;
      return normalImage(tokens, idx, options, env, self);
    };
    const normalLink =
      md.renderer.rules.link_open ||
      ((tokens, idx, options, env, self) =>
        self.renderToken(tokens, idx, options));
    md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
      const token = tokens[idx],
        href = token.attrGet("href");
      if (href && !/^(?:[a-z]+:|\/|#)/i.test(href)) {
        const [file, hash] = href.split("#"),
          resolved = path.posix.normalize(
            path.posix.join(
              path.posix.dirname(source),
              decodeURIComponent(file),
            ),
          );
        const target = sources.get(resolved);
        if (target)
          token.attrSet(
            "href",
            `/docs/${target.lang}/${target.page.name}.html${hash ? "#" + hash : ""}`,
          );
        else
          token.attrSet(
            "href",
            `https://github.com/vexuni/vexuni/blob/main/${resolved}${hash ? "#" + hash : ""}`,
          );
      }
      return normalLink(tokens, idx, options, env, self);
    };
    const used = new Map();
    md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
      const base = slug(tokens[idx + 1].content),
        count = used.get(base) || 0;
      used.set(base, count + 1);
      tokens[idx].attrSet("id", base + (count ? "-" + count : ""));
      return self.renderToken(tokens, idx, options);
    };
    const content = md.render(text);
    const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · vexuni Docs</title><link rel="stylesheet" href="/docs/site.css"><link rel="icon" href="/favicon.svg"><link rel="alternate" hreflang="${other}" href="/docs/${other}/${page.name}.html"><script defer src="/docs-client.js"></script></head><body><a class="skip" href="#content">${english ? "Skip to content" : "跳到正文"}</a><header><a class="brand" href="/?lang=${lang}">vexuni</a><a class="crumb" href="/docs/${lang}/index.html">${english ? "Documentation" : "文档"}</a><nav aria-label="Language / 语言"><a lang="zh-CN" href="/docs/zh-CN/${page.name}.html" ${!english ? 'aria-current="page"' : ""}>简体中文</a><a lang="en" href="/docs/en/${page.name}.html" ${english ? 'aria-current="page"' : ""}>English</a></nav></header><div class="layout"><aside><nav aria-label="${english ? "All documents" : "全部文档"}">${navFor(page.name)}</nav></aside><main id="content"><div class="source"><a href="https://github.com/vexuni/vexuni/blob/main/${source}">${english ? "Markdown source" : "Markdown 源文档"}</a></div>${content}</main></div><footer>vexuni · AGPL-3.0-only</footer></body></html>`;
    await fs.writeFile(`public/docs/${lang}/${page.name}.html`, html);
  }
  const index = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>vexuni · ${english ? "Documentation" : "文档"}</title><link rel="stylesheet" href="/docs/site.css"><script defer src="/docs-client.js"></script></head><body><header><a class="brand" href="/?lang=${lang}">vexuni</a><nav aria-label="Language / 语言"><a href="/docs/zh-CN/index.html" lang="zh-CN">简体中文</a><a href="/docs/en/index.html" lang="en">English</a></nav></header><main class="index"><div class="index-hero"><p class="eyebrow">vexuni</p><h1>${english ? "Documentation" : "项目文档"}</h1><p>${english ? "Learn to deploy, use, and maintain your own Cloudflare Git platform. Feature guides include their supported scope; verification reports describe historical releases." : "了解如何部署、使用和维护自己的 Cloudflare Git 平台。功能指南包含支持边界；验收报告记录对应历史版本。"}</p></div>${grouped
      .map(
        (g) =>
          `<section><h2 class="index-group">${english ? g.en : g.zh}</h2><div class="doc-grid">${g.items.map((item) => link(item)).join("")}</div></section>`,
      )
      .join("")}</main><footer>vexuni · AGPL-3.0-only</footer></body></html>`;
  await fs.writeFile(`public/docs/${lang}/index.html`, index);
}
await fs.writeFile(
  "public/docs/site.css",
  `:root{--bg:#fbfaf7;--panel:#ffffff;--ink:#232019;--mut:#6f695c;--line:#e6e0d2;--accent:#9a6700;--accent-soft:#f4ead2;--code-bg:#f4f0e6;--shadow:0 1px 2px rgba(35,32,25,.04),0 8px 24px rgba(35,32,25,.06)}
@media(prefers-color-scheme:dark){:root{--bg:#15161a;--panel:#1c1e24;--ink:#e9e5db;--mut:#a49d8d;--line:#33363f;--accent:#d29922;--accent-soft:#2c2a20;--code-bg:#23252c;--shadow:none}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.75 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:3px}
header{position:sticky;top:0;z-index:2;display:flex;align-items:baseline;gap:8px;padding:16px 32px;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.brand{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-weight:700;color:var(--ink);font-size:19px;letter-spacing:-.5px}
.crumb{color:var(--mut);font-size:14px}.crumb::before{content:"/";margin:0 8px;color:var(--line)}
header nav{margin-left:auto;display:flex;gap:18px;font-size:14px}header nav a{color:var(--mut)}header nav a[aria-current]{color:var(--ink);font-weight:600;text-decoration:none}
.layout{display:grid;grid-template-columns:280px minmax(0,920px);max-width:1280px;margin:auto}
aside{padding:32px 24px 32px 32px;height:calc(100vh - 62px);overflow:auto;position:sticky;top:62px;border-right:1px solid var(--line)}
aside nav{display:flex;flex-direction:column}
.nav-group{margin:20px 0 6px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
.nav-group:first-child{margin-top:0}
aside nav a{padding:4px 10px;margin:1px 0;border-radius:6px;font-size:13.5px;line-height:1.5;color:var(--ink)}
aside nav a:hover{background:var(--accent-soft);text-decoration:none}
aside nav a.active{background:var(--accent-soft);color:var(--accent);font-weight:600;box-shadow:inset 2px 0 0 var(--accent)}
main{padding:44px 56px 64px;min-width:0;background:var(--panel);border-left:1px solid var(--line)}
.source{text-align:right;font-size:13px;margin-bottom:8px}.source a{color:var(--mut)}
h1{font-size:32px;line-height:1.25;letter-spacing:-.02em;margin:0 0 16px}
h2{font-size:22px;letter-spacing:-.01em;margin:40px 0 12px;padding-top:24px;border-top:1px solid var(--line)}
h3{font-size:17px;margin:28px 0 8px}
h1,h2,h3{scroll-margin-top:88px}
h1+h2,h1+p+h2{border-top:0;padding-top:0}
p{margin:12px 0}ul,ol{padding-left:24px}li{margin:4px 0}
pre{overflow:auto;padding:16px 18px;background:var(--code-bg);border:1px solid var(--line);border-radius:8px;font-size:13px;line-height:1.6}
code{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:.86em;background:var(--code-bg);padding:.15em .4em;border-radius:5px;overflow-wrap:anywhere}
pre code{background:none;padding:0;overflow-wrap:normal}
table{border-collapse:collapse;width:100%;display:block;overflow:auto;font-size:14px;margin:16px 0}
td,th{border:1px solid var(--line);padding:8px 14px;text-align:left}
th{background:var(--code-bg);font-weight:600}
img{max-width:100%}
blockquote{margin:16px 0;padding:4px 18px;border-left:3px solid var(--accent);color:var(--mut)}
hr{border:0;border-top:1px solid var(--line);margin:32px 0}
.index{max-width:1080px;margin:auto;padding:56px 40px 64px}
.index-hero{padding-bottom:32px;border-bottom:1px solid var(--line);margin-bottom:8px}
.index-hero .eyebrow{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;letter-spacing:.14em;color:var(--accent);margin:0 0 8px}
.index-hero h1{font-size:40px}
.index-hero p{max-width:640px;color:var(--mut);font-size:17px}
.index-group{font-size:13px;font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);border:0;padding-top:0;margin:36px 0 12px}
.doc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.doc-grid a{display:block;padding:13px 16px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);font-size:14px;font-weight:500;transition:border-color .15s,box-shadow .15s}
.doc-grid a:hover{border-color:var(--accent);box-shadow:var(--shadow);text-decoration:none}
footer{padding:28px;text-align:center;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;color:var(--mut);border-top:1px solid var(--line)}
.skip{position:absolute;left:-9999px}.skip:focus{left:20px;top:80px;background:var(--panel);padding:10px;z-index:3;border-radius:6px}
@media(max-width:760px){header{padding:12px 16px;gap:12px;flex-wrap:wrap}.layout{display:block}aside{position:static;height:auto;max-height:none;border-right:0;border-bottom:1px solid var(--line);padding:16px}main{padding:28px 20px;border-left:0}.source{text-align:left}.index{padding:32px 20px}.doc-grid{grid-template-columns:1fr}}`,
);
console.log(`Documentation: ${pages.length} pages × 2 languages`);
