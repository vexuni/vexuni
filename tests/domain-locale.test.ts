import test from "node:test";
import assert from "node:assert/strict";
import {
  requestLocale,
  supportedLocale,
  negotiateLocale,
} from "../src/i18n/locale";
import { canonicalPageURL } from "../src/domain";
test("language negotiation honors explicit choice, cookie and weighted browser preferences", () => {
  assert.equal(negotiateLocale("en-US;q=0.8,zh-CN;q=0.9"), "zh-CN");
  assert.equal(negotiateLocale("fr, en-GB;q=0.7"), "en");
  assert.equal(negotiateLocale("en;q=0,zh-CN;q=1"), "zh-CN");
  assert.equal(negotiateLocale("de;q=1,en;q=invalid"), "zh-CN");
  assert.equal(supportedLocale("<script>"), null);
  assert.equal(
    requestLocale(
      new Request("https://example.com/?lang=en", {
        headers: {
          cookie: "vexuni_locale=zh-CN",
          "accept-language": "zh-CN",
        },
      }),
    ),
    "en",
  );
  assert.equal(
    requestLocale(
      new Request("https://example.com/", {
        headers: {
          cookie: "vexuni_locale=zh-CN",
          "accept-language": "en-US",
        },
      }),
    ),
    "zh-CN",
  );
});
test("domain migration redirects browser pages without redirecting native Git and API requests", () => {
  const url = (path: string, method = "GET") =>
    canonicalPageURL(
      new Request("https://git.example.com" + path, { method }),
      "https://example.com",
      "https://git.example.com",
    );
  assert.equal(
    url("/vexuni/nb?path=README.md&lang=en"),
    "https://example.com/vexuni/nb?path=README.md&lang=en",
  );
  assert.equal(
    url("/docs/en/index.html", "HEAD"),
    "https://example.com/docs/en/index.html",
  );
  assert.equal(url("/vexuni/nb.git/info/refs?service=git-upload-pack"), null);
  assert.equal(url("/vexuni/nb.git/git-receive-pack", "POST"), null);
  assert.equal(url("/api/repos"), null);
  assert.equal(url("/mcp"), null);
  assert.equal(
    canonicalPageURL(
      new Request("https://unrelated.test/"),
      "https://example.com",
      "https://git.example.com",
    ),
    null,
  );
});
test("malformed URLs do not crash canonicalization and encoded APIs stay compatible", () => {
  for (const path of ["/%ZZ", "/%61pi/repos"])
    assert.equal(
      canonicalPageURL(
        new Request("https://git.example.com" + path),
        "https://example.com",
        "https://git.example.com",
      ),
      null,
    );
});
