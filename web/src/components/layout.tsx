import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useT, type Locale } from "../lib/i18n";
import { useTheme, type Theme } from "../lib/theme";
import { Avatar, Modal, Pill } from "./ui";
import { CommandPalette } from "./palette";
import { Icon } from "./icons";

export function Wordmark() {
  return (
    <Link to="/" className="wordmark">
      <span className="prompt">$</span>
      vexuni
      <span className="cursor" aria-hidden="true" />
    </Link>
  );
}

function NavItem({ to, icon, label, end }: { to: string; icon: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `navlink${isActive ? " active" : ""}`}
    >
      <Icon name={icon} />
      {label}
    </NavLink>
  );
}

/** Routes that live at the top level rather than inside /ns/repo. */
const TOP_LEVEL = new Set([
  "login",
  "recover",
  "new",
  "search",
  "notifications",
  "spaces",
  "settings",
  "admin",
]);

function RailLink({
  to,
  icon,
  label,
  end,
  forceActive,
}: {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
  forceActive?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      data-tip={label}
      aria-label={label}
      className={({ isActive }) =>
        `rail-item${isActive || forceActive ? " active" : ""}`
      }
    >
      <Icon name={icon} size={17} />
    </NavLink>
  );
}

/** Slim desktop rail: anchors only — the command palette carries real navigation. */
function Rail() {
  const { t, locale, setLocale } = useT();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const prefsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prefsOpen) return;
    const close = (e: MouseEvent) => {
      if (!prefsRef.current?.contains(e.target as Node)) setPrefsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPrefsOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [prefsOpen]);

  const segs = pathname.split("/").filter(Boolean);
  const inRepo = segs.length >= 2 && !TOP_LEVEL.has(segs[0]);
  const prefsTip = `${t("common.language")} / ${t("common.theme")}`;

  return (
    <nav className="rail" aria-label={t("nav.section.workspace")}>
      <Link to="/" className="rail-logo" data-tip="vexuni" aria-label="vexuni">
        <span className="prompt">$</span>
        <span className="cursor" aria-hidden="true" />
      </Link>
      <div className="rail-sep" />
      <RailLink
        to="/"
        icon="repo"
        label={t("nav.projects")}
        end
        forceActive={inRepo}
      />
      <RailLink to="/search" icon="search" label={t("nav.search")} />
      {user && (
        <>
          <RailLink to="/notifications" icon="bell" label={t("nav.notifications")} />
          <RailLink to="/spaces" icon="users" label={t("nav.spaces")} />
        </>
      )}
      <div className="rail-flex" />
      {user && (
        <RailLink to="/settings" icon="gear" label={t("nav.section.settings")} />
      )}
      {user?.admin && (
        <RailLink to="/admin" icon="lock" label={t("nav.admin")} />
      )}
      <a
        className="rail-item"
        href="/docs"
        target="_blank"
        rel="noreferrer"
        data-tip={t("nav.docs")}
        aria-label={t("nav.docs")}
      >
        <Icon name="book" size={17} />
      </a>
      <a
        className="rail-item"
        href="/source.tar.gz"
        download
        data-tip={t("nav.source")}
        aria-label={t("nav.source")}
      >
        <Icon name="download" size={17} />
      </a>
      <div className="rail-sep" />
      <div className="rail-menu-wrap" ref={prefsRef}>
        <button
          className="rail-item"
          data-tip={prefsTip}
          aria-label={prefsTip}
          aria-haspopup="menu"
          aria-expanded={prefsOpen}
          onClick={() => setPrefsOpen(!prefsOpen)}
        >
          <Icon name="globe" size={17} />
        </button>
        {prefsOpen && (
          <div className="menu rail-menu" role="menu">
            <div className="rail-field">
              <label htmlFor="rail-lang">{t("common.language")}</label>
              <select
                id="rail-lang"
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
              >
                <option value="zh-CN">简体中文</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="rail-field">
              <label htmlFor="rail-theme">{t("common.theme")}</label>
              <select
                id="rail-theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
              >
                <option value="auto">{t("theme.auto")}</option>
                <option value="light">{t("theme.light")}</option>
                <option value="dark">{t("theme.dark")}</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale, setLocale } = useT();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const { pathname } = useLocation();
  useEffect(onClose, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className={`sidebar${open ? " open" : ""}`}>
      <Wordmark />
      <div className="ws-chip">
        <Avatar name={user?.username || "O"} />
        <div>
          <div className="ws-name">{user?.username || t("ws.public")}</div>
          <div className="ws-sub">
            {user ? t("ws.personal") : t("ws.explore")}
          </div>
        </div>
      </div>
      <div className="nav-label">{t("nav.section.workspace")}</div>
      <nav>
        <NavItem to="/" icon="repo" label={t("nav.projects")} end />
        <NavItem to="/search" icon="search" label={t("nav.search")} />
        {user && (
          <>
            <NavItem to="/notifications" icon="bell" label={t("nav.notifications")} />
            <NavItem to="/spaces" icon="users" label={t("nav.spaces")} />
          </>
        )}
      </nav>
      {user && (
        <>
          <div className="nav-label">{t("nav.section.settings")}</div>
          <nav>
            <NavItem to="/settings/profile" icon="users" label={t("nav.profile")} />
            <NavItem to="/settings/security" icon="lock" label={t("nav.account")} />
            <NavItem to="/settings/tokens" icon="key" label={t("nav.tokens")} />
            {user.admin && (
              <NavItem to="/admin" icon="gear" label={t("nav.admin")} />
            )}
          </nav>
        </>
      )}
      <footer>
        <div className="foot-links">
          <a href="/docs" target="_blank" rel="noreferrer">
            {t("nav.docs")}
          </a>
          <a href="/source.tar.gz" download>
            {t("nav.source")} ↓
          </a>
        </div>
        <div className="foot-links">
          <select
            aria-label={t("common.language")}
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
          <select
            aria-label={t("common.theme")}
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            <option value="auto">{t("theme.auto")}</option>
            <option value="light">{t("theme.light")}</option>
            <option value="dark">{t("theme.dark")}</option>
          </select>
        </div>
      </footer>
    </aside>
  );
}

function UserMenu() {
  const { t } = useT();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!user) return null;
  return (
    <div ref={ref} className="menu-wrap">
      <button
        className="btn text"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={user.username} />
        {user.username}
        <Icon name="chevD" size={12} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <Link to="/settings/profile" onClick={() => setOpen(false)}>
            <Icon name="users" /> {t("nav.profile")}
          </Link>
          <Link to="/settings/tokens" onClick={() => setOpen(false)}>
            <Icon name="key" /> {t("nav.tokens")}
          </Link>
          <button
            onClick={async () => {
              await logout();
              navigate("/");
            }}
          >
            <Icon name="x" /> {t("top.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

function isTyping(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return (
    !!node &&
    (node.tagName === "INPUT" ||
      node.tagName === "TEXTAREA" ||
      node.tagName === "SELECT" ||
      node.isContentEditable)
  );
}

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const rows: [string, string][] = [
    ["⌘K / Ctrl+K", t("help.palette")],
    ["/", t("help.palette")],
    ["?", t("help.this")],
    ["Esc", t("help.esc")],
  ];
  return (
    <Modal title={t("help.title")} onClose={onClose}>
      <div className="help-grid">
        {rows.map(([key, desc]) => (
          <div className="help-row" key={key}>
            <kbd>{key}</kbd>
            <span>{desc}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** App frame: icon rail + drawer (mobile) + sticky topbar + content column. */
export function Shell({
  crumbs,
  children,
  wide,
}: {
  crumbs: { label: string; to?: string }[];
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [palOpen, setPalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === "k") {
        e.preventDefault();
        setPalOpen((v) => !v);
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (k === "/") {
        e.preventDefault();
        setPalOpen(true);
      } else if (k === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="shell">
      <Rail />
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && (
        <div className="drawer-veil" onClick={() => setNavOpen(false)} />
      )}
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="hamburger"
              aria-label="Menu"
              onClick={() => setNavOpen(true)}
            >
              <Icon name="menu" />
            </button>
            {crumbs.map((c, i) => (
              <span key={i} className="crumb-wrap">
                {i > 0 && <span className="sep">/</span>}
                {c.to && i < crumbs.length - 1 ? (
                  <Link to={c.to}>{c.label}</Link>
                ) : (
                  <span className="current">{c.label}</span>
                )}
              </span>
            ))}
          </div>
          <button
            className="search-trigger"
            onClick={() => setPalOpen(true)}
            aria-label={t("top.search")}
          >
            <Icon name="search" size={14} />
            <span className="st-label">{t("top.search")}</span>
            <kbd>⌘K</kbd>
          </button>
          <div className="right">
            <Pill>{t("top.selfhosted")}</Pill>
            {user ? (
              <UserMenu />
            ) : (
              <Link className="btn small" to="/login">
                {t("top.login")}
              </Link>
            )}
          </div>
        </header>
        <div className={`content${wide ? " wide" : ""}`}>{children}</div>
      </div>
      <CommandPalette open={palOpen} onClose={() => setPalOpen(false)} />
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

export function PageTitle({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="titlebar">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="btn-group">{actions}</div>}
    </div>
  );
}

export function Tabs({
  base,
  items,
}: {
  base: string;
  items: { to: string; label: string; icon: string; count?: number }[];
}) {
  const { pathname } = useLocation();
  return (
    <nav className="tabs">
      {items.map((item) => {
        const to = item.to === "." ? base : base + item.to;
        const active =
          item.to === "." ? pathname === base || pathname === base + "/" : pathname.startsWith(to);
        return (
          <Link key={item.to} to={to} className={active ? "active" : ""}>
            <Icon name={item.icon} size={14} />
            {item.label}
            {item.count !== undefined && <span className="count">{item.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
