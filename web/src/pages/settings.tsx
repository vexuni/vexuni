import { useState, type FormEvent } from "react";
import { NavLink, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { fullDate, timeAgo } from "../lib/format";
import type { Token } from "../lib/types";
import { PageTitle, Shell } from "../components/layout";
import {
  Avatar,
  Empty,
  ErrorBox,
  Field,
  Modal,
  Spinner,
} from "../components/ui";
import { Icon } from "../components/icons";
import { Routes, Route } from "react-router-dom";

function SettingsShell({
  active,
  title,
  sub,
  children,
}: {
  active: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <Shell
      crumbs={[{ label: t("nav.section.settings") }, { label: title }]}
    >
      <PageTitle title={title} sub={sub} />
      <nav className="tabs">
        <NavLink to="/settings/profile" className={active === "profile" ? "active" : ""}>
          {t("nav.profile")}
        </NavLink>
        <NavLink to="/settings/security" className={active === "security" ? "active" : ""}>
          {t("nav.account")}
        </NavLink>
        <NavLink to="/settings/tokens" className={active === "tokens" ? "active" : ""}>
          {t("nav.tokens")}
        </NavLink>
      </nav>
      {children}
    </Shell>
  );
}

function ProfilePage() {
  const { t } = useT();
  const { user, refresh } = useAuth();
  const { data: profile } = useApi<{ user?: { display_name?: string; bio?: string } }>(
    "/profile",
  );
  const [msg, setMsg] = useState("");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api.put("/profile", d);
      await refresh();
      setMsg(t("settings.saved"));
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <SettingsShell active="profile" title={t("profile.title")}>
      <div className="panel panelpad narrow">
        <div className="row row-flush">
          <Avatar name={user?.username} />
          <strong>{user?.username}</strong>
        </div>
        <form onSubmit={save} className="mt">
          {msg && <div className="notebox">{msg}</div>}
          <Field label={t("profile.display")} optional>
            <input
              name="display_name"
              defaultValue={profile?.user?.display_name}
            />
          </Field>
          <Field label={t("profile.bio")} optional>
            <textarea name="bio" defaultValue={profile?.user?.bio} />
          </Field>
          <button className="btn primary">{t("common.save")}</button>
        </form>
      </div>
    </SettingsShell>
  );
}

function SecurityPage() {
  const { t } = useT();
  const [msg, setMsg] = useState("");
  const { data: security } = useApi<{ totp?: boolean; sessions?: unknown[] }>(
    "/account/security",
  );

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await api.post("/password", {
        current: d.current,
        password: d.password,
      });
      form.reset();
      setMsg(t("settings.saved"));
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <SettingsShell active="security" title={t("account.title")}>
      <div className="panel panelpad narrow">
        <h3 className="mt-sm">{t("account.changePassword")}</h3>
        <form onSubmit={changePassword} className="mt">
          {msg && <div className="notebox">{msg}</div>}
          <Field label={t("account.current")}>
            <input name="current" type="password" required autoComplete="current-password" />
          </Field>
          <Field label={t("account.new")} hint={t("auth.passwordHint")}>
            <input name="password" type="password" required minLength={12} autoComplete="new-password" />
          </Field>
          <button className="btn primary">{t("common.save")}</button>
        </form>
      </div>
      {security && (
        <div className="panel panelpad narrow mt">
          <h3>{t("account.identities")}</h3>
          <p className="muted mt-sm">
            TOTP: {security.totp ? "on" : "off"}
            {security.sessions ? ` · ${security.sessions.length} sessions` : ""}
          </p>
        </div>
      )}
    </SettingsShell>
  );
}

function TokensPage() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi<{ tokens: Token[] }>("/tokens");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState("");
  const [err2, setErr2] = useState("");

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    try {
      const r = await api.post<{ id: string; token: string }>("/tokens", {
        name: d.name || "token",
        scopes: d.scopes === "write" ? ["read", "write"] : ["read"],
      });
      setFresh(r.token);
      setCreating(false);
      reload();
    } catch (err) {
      setErr2((err as Error).message);
    }
  }

  const tokens = data?.tokens;
  return (
    <SettingsShell active="tokens" title={t("tokens.title")} sub={t("tokens.sub")}>
      {fresh && (
        <div className="panel panelpad">
          <div className="notebox">{t("tokens.created")}</div>
          <div className="clone-box">
            <code>{fresh}</code>
          </div>
        </div>
      )}
      <div className="panel">
        <div className="panelhead">
          <strong>{t("tokens.title")}</strong>
          <button className="btn small" onClick={() => setCreating(true)}>
            <Icon name="plus" /> {t("tokens.new")}
          </button>
        </div>
        {error && <ErrorBox error={error} />}
        {loading && <Spinner />}
        {tokens && tokens.length === 0 && (
          <Empty icon="key" title={t("common.empty")} />
        )}
        {tokens?.map((tok) => (
          <div className="row" key={tok.id}>
            <Icon name="key" />
            <div className="grow">
              <div className="title">{tok.name || tok.id}</div>
              <div className="meta">
                <span className="mono">{tok.scopes?.join(", ")}</span>
                <span>
                  {t("tokens.lastUsed")}:{" "}
                  {tok.last_used_at ? timeAgo(tok.last_used_at) : t("tokens.never")}
                </span>
                {tok.created_at && <span>{fullDate(tok.created_at)}</span>}
              </div>
            </div>
            <button
              className="copy-btn"
              title={t("common.delete")}
              onClick={async () => {
                await api.del(`/tokens/${tok.id}`);
                reload();
              }}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>
      {creating && (
        <Modal
          title={t("tokens.new")}
          onClose={() => setCreating(false)}
          actions={
            <>
              <button className="btn" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </button>
              <button className="btn primary" type="submit" form="new-token">
                {t("common.create")}
              </button>
            </>
          }
        >
          <form id="new-token" onSubmit={create}>
            {err2 && <div className="errbox">{err2}</div>}
            <Field label={t("tokens.name")}>
              <input name="name" required autoFocus placeholder="ci-deploy" />
            </Field>
            <Field label={t("tokens.scope")}>
              <select name="scopes" defaultValue="read">
                <option value="read">{t("tokens.scope.read")}</option>
                <option value="write">{t("tokens.scope.write")}</option>
              </select>
            </Field>
          </form>
        </Modal>
      )}
    </SettingsShell>
  );
}

export function SettingsRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/settings/profile" replace />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="security" element={<SecurityPage />} />
      <Route path="tokens" element={<TokensPage />} />
    </Routes>
  );
}
