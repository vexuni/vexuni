import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useT, type Locale } from "../lib/i18n";
import { useTheme, type Theme } from "../lib/theme";
import { Avatar, Pill } from "./ui";
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
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
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

/** App frame: sidebar + sticky topbar + content column. */
export function Shell({
  crumbs,
  children,
}: {
  crumbs: { label: string; to?: string }[];
  children: ReactNode;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  return (
    <div className="shell">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
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
        <div className="content">{children}</div>
      </div>
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
