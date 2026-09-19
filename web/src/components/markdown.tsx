import { useMemo } from "react";
import MarkdownIt from "markdown-it";
import { Icon } from "./icons";

/** Same policy as the server renderer: no raw HTML, safe link protocols. */
const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet("href") || "";
  if (!/^(https?:|mailto:|#|\/|\.)/i.test(href)) tokens[idx].attrSet("href", "#");
  else if (/^https?:/i.test(href)) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => md.render(text || ""), [text]);
  return (
    <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/** README block under the file tree. */
export function Readme({ name, text }: { name: string; text: string }) {
  return (
    <div className="panel mt">
      <div className="md-title">
        <Icon name="book" size={13} />
        {name}
      </div>
      <Markdown text={text} />
    </div>
  );
}
