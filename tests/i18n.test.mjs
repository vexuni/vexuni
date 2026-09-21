import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parse } from "acorn";
import { translateLiteral, translateTemplate } from "../src/i18n/core.js";
const messages = JSON.parse(
  await fs.readFile(new URL("../src/i18n/en.json", import.meta.url), "utf8"),
);
test("UI translations preserve interpolation values, including code and template-like user content", () => {
  assert.equal(translateLiteral("当前密码", "en"), "Current password");
  assert.equal(translateLiteral("当前密码", "zh-CN"), "当前密码");
  assert.equal(
    translateLiteral('<label title="当前密码">用户名</label>', "en"),
    '<label title="Current password">Username</label>',
  );
  const untrusted = "项目 <img src=x> ⟦0⟧ ${secret}";
  assert.equal(
    translateTemplate(["使用 ", " 登录"], [untrusted], "en"),
    "使用 " + untrusted + " 登录",
  );
  // This catalog entry has a nonzero placeholder because it originally lives inside a larger HTML template.
  assert.equal(
    translateTemplate(
      ['<a href="', '">使用 ', " 登录</a>"],
      ["/", untrusted],
      "en",
    ),
    '<a href="/">Sign in with ' + untrusted + "</a>",
  );
});
test("every catalog translation preserves its placeholders", () => {
  for (const [key, value] of Object.entries(messages)) {
    assert.deepEqual(
      (key.match(/⟦\d+⟧/g) || []).sort(),
      (value.match(/⟦\d+⟧/g) || []).sort(),
      key,
    );
    assert.equal(/\p{Script=Han}/u.test(value), false, key);
  }
});
test("all application-owned Chinese UI literals are explicitly localized and covered", async () => {
  const files = ["src/browser/notebook.js"];
  const han = /\p{Script=Han}/u;
  for (const file of files) {
    const source = await fs.readFile(
      new URL("../" + file, import.meta.url),
      "utf8",
    );
    const ast = parse(source, { ecmaVersion: "latest", sourceType: "module" });
    function walk(node, parent) {
      let literal;
      if (node.type === "Literal" && typeof node.value === "string")
        literal = node.value;
      if (node.type === "TemplateLiteral")
        literal = node.quasis
          .map(
            (q, i) =>
              q.value.cooked + (i < node.expressions.length ? `⟦${i}⟧` : ""),
          )
          .join("");
      if (literal && han.test(literal)) {
        assert.ok(
          node.type === "Literal"
            ? parent?.type === "CallExpression" &&
                parent.callee.name === "i18nText"
            : parent?.type === "TaggedTemplateExpression" &&
                parent.tag.name === "i18nHTML",
          `${file}: untranslated literal ${literal.slice(0, 80)}`,
        );
        for (const m of literal.matchAll(/[^<>"'`\n]+/g))
          if (han.test(m[0]))
            assert.ok(
              Object.hasOwn(messages, m[0].trim()),
              `${file}: missing ${m[0].trim()}`,
            );
      }
      for (const value of Object.values(node))
        if (Array.isArray(value))
          value.forEach((v) => {
            if (v?.type) walk(v, node);
          });
        else if (value?.type) walk(value, node);
    }
    walk(ast);
  }
});
test("known API errors translate without altering unknown server or user text", async () => {
  const { translateError } = await import("../src/i18n/core.js");
  assert.equal(
    translateError("Invalid username or password", "zh-CN"),
    "用户名或密码错误",
  );
  assert.equal(
    translateError("Invalid username or password", "en"),
    "Invalid username or password",
  );
  assert.equal(
    translateError("user text: Invalid username or password", "zh-CN"),
    "user text: Invalid username or password",
  );
});
test("React frontend keeps Chinese text inside the i18n catalog", async () => {
  // UI strings live in web/src/lib/i18n.tsx and are referenced through t().
  // The only permitted raw Han literal outside the catalog is the locale's
  // own display name used by language pickers.
  const han = /\p{Script=Han}/u;
  const allowed = new Set(["简体中文"]);
  const root = new URL("../web/src/", import.meta.url);
  const scan = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const p = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
      if (entry.isDirectory()) {
        await scan(p);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (p.pathname.endsWith("lib/i18n.tsx")) continue;
      const source = await fs.readFile(p, "utf8");
      for (const m of source.matchAll(/\p{Script=Han}+/gu)) {
        assert.ok(
          allowed.has(m[0]),
          `${entry.name}: untranslated literal ${m[0].slice(0, 60)}`,
        );
      }
    }
  };
  await scan(root);
});
test("React frontend zh and en catalogs carry identical keys", async () => {
  const source = await fs.readFile(
    new URL("../web/src/lib/i18n.tsx", import.meta.url),
    "utf8",
  );
  const grab = (name) => {
    const m = source.match(new RegExp(`const ${name}[^=]*= \\{([\\s\\S]*?)\\};`));
    assert.ok(m, `catalog ${name} not found`);
    return new Set([...m[1].matchAll(/^\s*"([^"]+)":/gm)].map((x) => x[1]));
  };
  const en = grab("en");
  const zh = grab("zh");
  assert.deepEqual([...en].sort(), [...zh].sort());
});
