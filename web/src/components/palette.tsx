import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import type { Repository } from "../lib/types";
import { Icon } from "./icons";

interface Item {
  id: string;
  group: "repo" | "action";
  icon: string;
  label: string;
  hint?: string;
  run: () => void;
}

const TOP_LEVEL = new Set([
  "login", "recover", "new", "search", "notifications", "spaces", "settings", "admin",
]);

/** ⌘K / Ctrl+K / "/" — fuzzy jump across repositories and app actions. */
export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const { resolved, setTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [q, setQ] = useState("");
  const [repos, setRepos] = useState<Repository[] | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Repo context: /ns/name/… where ns isn't a reserved top-level route.
  const segs = pathname.split("/").filter(Boolean);
  const repoBase =
    segs.length >= 2 && !TOP_LEVEL.has(segs[0]) ? `/${segs[0]}/${segs[1]}` : null;

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    inputRef.current?.focus();
    if (repos === null) {
      api
        .get<{ repositories: Repository[] }>("/repos")
        .then((d) => setRepos(d.repositories || []))
        .catch(() => setRepos([]));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const go = (to: string) => () => {
      onClose();
      navigate(to);
    };
    const href = (to: string) => () => {
      onClose();
      window.location.href = to;
    };

    if (repoBase) {
      for (const [path, key, icon] of [
        ["", "repo.code", "code"],
        ["/issues", "repo.issues", "issue"],
        ["/merges", "repo.merges", "merge"],
        ["/commits", "repo.commits", "commit"],
        ["/ci", "repo.ci", "ci"],
        ["/packages", "repo.packages", "box"],
        ["/search", "repo.search", "search"],
        ["/settings", "repo.settings", "gear"],
      ] as const)
        out.push({
          id: `r:${path}`,
          group: "action",
          icon,
          label: t(key),
          hint: repoBase + path,
          run: go(repoBase + path),
        });
    }

    const nav: [string, string, string][] = [
      ["nav.projects", "/", "repo"],
      ["nav.search", "/search", "search"],
    ];
    if (user) {
      nav.push(
        ["nav.notifications", "/notifications", "bell"],
        ["nav.spaces", "/spaces", "users"],
        ["repos.new", "/new", "plus"],
        ["nav.profile", "/settings/profile", "users"],
        ["nav.tokens", "/settings/tokens", "key"],
      );
      if (user.admin) nav.push(["nav.admin", "/admin", "gear"]);
    }
    for (const [key, to, icon] of nav)
      out.push({ id: `a:${to}`, group: "action", icon, label: t(key), hint: to, run: go(to) });
    out.push({
      id: "a:theme",
      group: "action",
      icon: "eye",
      label: t("palette.theme"),
      hint: resolved === "dark" ? t("theme.light") : t("theme.dark"),
      run: () => {
        onClose();
        setTheme(resolved === "dark" ? "light" : "dark");
      },
    });
    out.push(
      { id: "a:docs", group: "action", icon: "book", label: t("nav.docs"), hint: "/docs", run: href("/docs") },
      { id: "a:source", group: "action", icon: "download", label: t("nav.source"), hint: "/source.tar.gz", run: href("/source.tar.gz") },
    );

    const query = q.trim().toLowerCase();
    if (!query) {
      // No query: recent repos first, then actions.
      const head = (repos || []).slice(0, 6).map(repoItem);
      return [...head, ...out];
    }
    const scored = (repos || [])
      .map((r) => {
        const full = `${r.namespace}/${r.name}`.toLowerCase();
        const idx = full.indexOf(query);
        const nameIdx = r.name.toLowerCase().indexOf(query);
        if (idx < 0 && nameIdx < 0 && !(r.description || "").toLowerCase().includes(query))
          return null;
        return { r, score: nameIdx === 0 ? 0 : nameIdx > 0 ? 1 : idx >= 0 ? 2 : 3 };
      })
      .filter(Boolean)
      .sort((a, b) => a!.score - b!.score)
      .slice(0, 8)
      .map((s) => repoItem(s!.r));
    const acts = out.filter((i) => i.label.toLowerCase().includes(query));
    return [...scored, ...acts];

    function repoItem(r: Repository): Item {
      const to = `/${r.namespace}/${encodeURIComponent(r.name)}`;
      return {
        id: `repo:${r.id}`,
        group: "repo",
        icon: "repo",
        label: `${r.namespace} / ${r.name}`,
        hint: r.description,
        run: () => {
          onClose();
          navigate(to);
        },
      };
    }
  }, [q, repos, repoBase, user, resolved, t, navigate, onClose, setTheme]);

  useEffect(() => setActive(0), [items.length]);

  useEffect(() => {
    const el = listRef.current?.querySelector(".pal-item.active");
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[active]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastGroup = "";
  return (
    <div className="modal-veil pal-veil" onClick={onClose} role="presentation">
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label={t("palette.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pal-input">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={t("palette.placeholder")}
            aria-label={t("palette.placeholder")}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>esc</kbd>
        </div>
        <div className="pal-list" ref={listRef} role="listbox">
          {items.length === 0 && (
            <div className="pal-empty">{t("palette.empty")}</div>
          )}
          {items.map((item, i) => {
            const head =
              item.group !== lastGroup ? (
                <div className="pal-group">
                  {t(item.group === "repo" ? "palette.repos" : "palette.actions")}
                </div>
              ) : null;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {head}
                <button
                  className={`pal-item${i === active ? " active" : ""}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={item.run}
                >
                  <Icon name={item.icon} size={15} />
                  <span className="pal-label">{item.label}</span>
                  {item.hint && <span className="pal-hint">{item.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="pal-foot">
          <span>
            <kbd>↑↓</kbd> {t("palette.nav")}
          </span>
          <span>
            <kbd>↵</kbd> {t("palette.open")}
          </span>
        </div>
      </div>
    </div>
  );
}
