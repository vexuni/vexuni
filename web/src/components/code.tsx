import { useMemo } from "react";
import hljs from "highlight.js/lib/common";
import { extOf } from "../lib/format";

const ALIAS: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  yml: "yaml",
  md: "markdown",
  sh: "bash",
  zsh: "bash",
  dockerfile: "dockerfile",
  rs: "rust",
  kt: "kotlin",
  cs: "csharp",
  cpp: "cpp",
  cxx: "cpp",
  h: "c",
  hpp: "cpp",
  vue: "xml",
  svelte: "xml",
  html: "xml",
  svg: "xml",
  conf: "nginx",
  toml: "ini",
  lock: "json",
  ipynb: "json",
};

/** Syntax-highlighted, line-numbered source view. */
export function CodeView({ path, text }: { path: string; text: string }) {
  const lines = useMemo(() => {
    const lang = ALIAS[extOf(path)] || extOf(path);
    let html: string;
    try {
      html = hljs.getLanguage(lang)
        ? hljs.highlight(text, { language: lang }).value
        : hljs.highlightAuto(text).value;
    } catch {
      html = escapeHtml(text);
    }
    return html.split("\n");
  }, [path, text]);
  return (
    <pre className="codeview hljs" aria-label={path}>
      {lines.map((line, i) => (
        <div className="cline" key={i}>
          <span className="ln">{i + 1}</span>
          <span dangerouslySetInnerHTML={{ __html: line || " " }} />
        </div>
      ))}
    </pre>
  );
}

/** Plain unified-diff view with added/removed line tinting. */
export function DiffView({ text }: { text: string }) {
  const lines = useMemo(() => (text || "").split("\n"), [text]);
  return (
    <pre className="codeview" aria-label="diff">
      {lines.map((line, i) => {
        const cls = line.startsWith("@@")
          ? "cline diff-hunk"
          : line.startsWith("+")
            ? "cline diff-add"
            : line.startsWith("-")
              ? "cline diff-del"
              : "cline";
        return (
          <div className={cls} key={i}>
            <span className="ln">{i + 1}</span>
            <span>{line || " "}</span>
          </div>
        );
      })}
    </pre>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      c
    ]!,
  );
}
