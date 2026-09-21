import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api, qs } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { useApi } from "../lib/hooks";
import { fullDate } from "../lib/format";
import type { Repository } from "../lib/types";
import { Shell, PageTitle } from "../components/layout";
import { Empty, ErrorBox, Field, Pager, Pill, SkeletonRows } from "../components/ui";
import { Icon } from "../components/icons";

export function ReposPage() {
  const { t } = useT();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const page = Number(params.get("page") || 0);
  const { data, error, loading, reload } = useApi<{
    repositories: Repository[];
    next_cursor?: string;
  }>(`/repos${qs({ q, page })}`, [q, page]);

  const repos = data?.repositories;
  return (
    <Shell crumbs={[{ label: t("repos.title") }]}>
      <PageTitle
        title={t("repos.title")}
        sub={t("repos.sub")}
        actions={
          user ? (
            <Link className="btn primary" to="/new">
              <Icon name="plus" /> {t("repos.new")}
            </Link>
          ) : (
            <Link className="btn primary" to="/login">
              {t("repos.loginToCreate")}
            </Link>
          )
        }
      />
      {repos && (
        <div className="stats">
          <div className="stat">
            <div className="lbl">{t("repos.statList")}</div>
            <div className="num">
              {repos.length}
              <small>{t("repos.statUnit")}</small>
            </div>
          </div>
          <div className="stat">
            <div className="lbl">{t("repos.statPublic")}</div>
            <div className="num">
              {repos.filter((r) => r.visibility === "public").length}
              <small>{t("repos.statUnit")}</small>
            </div>
          </div>
          <div className="stat">
            <div className="lbl">{t("repos.statPrivate")}</div>
            <div className="num">
              {repos.filter((r) => r.visibility === "private").length}
              <small>{t("repos.statUnit")}</small>
            </div>
          </div>
        </div>
      )}
      <form className="toolbar" action="/" method="get">
        <div className="search">
          <Icon name="search" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("repos.searchPh")}
            aria-label={t("common.search")}
          />
        </div>
        <button className="btn" type="submit">
          {t("common.search")}
        </button>
        <span className="faint small">↓ {t("repos.recent")}</span>
      </form>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <SkeletonRows />}
      {repos && (
        <div className="panel">
          <div className="panelhead">
            <strong>{q ? t("repos.results") : t("repos.all")}</strong>
            <span className="muted small">
              {repos.length} {t("repos.statUnit")}
            </span>
          </div>
          {repos.length === 0 ? (
            <Empty
              title={q ? t("repos.emptySearch") : t("repos.emptyTitle")}
              body={q ? t("repos.emptySearchBody") : t("repos.emptyBody")}
              action={
                user && !q ? (
                  <Link className="btn primary" to="/new">
                    {t("repos.first")}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            repos.map((r) => (
              <article className="repo-row" key={r.id}>
                <div className="repo-icon">
                  <Icon name="repo" size={17} />
                </div>
                <div className="grow">
                  <Link
                    className="repo-name"
                    to={`/${r.namespace}/${encodeURIComponent(r.name)}`}
                  >
                    <span className="ns">{r.namespace} / </span>
                    {r.name}
                  </Link>
                  <p className="repo-desc">{r.description || t("repos.none")}</p>
                  <div className="rowmeta">
                    <span>
                      <Icon name="branch" size={12} /> {r.default_branch}
                    </span>
                    {r.created_at && (
                      <span>
                        {t("common.created")} {fullDate(r.created_at)}
                      </span>
                    )}
                  </div>
                </div>
                <Pill tone={r.visibility === "private" ? "yellow" : ""}>
                  {r.visibility === "private"
                    ? t("common.private")
                    : t("common.public")}
                </Pill>
              </article>
            ))
          )}
        </div>
      )}
      {repos && repos.length > 0 && (
        <Pager
          page={page}
          hasNext={repos.length === 50 || !!data?.next_cursor}
          make={(p) => `/?page=${p}&q=${encodeURIComponent(q)}`}
        />
      )}
      <p className="footer-note">{t("repos.footnote")}</p>
    </Shell>
  );
}

export function NewRepoPage() {
  const { t } = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    setBusy(true);
    setError("");
    try {
      const repo = await api.post<Repository>("/repos", {
        name: data.name,
        namespace: data.namespace || undefined,
        description: data.description || "",
        visibility: data.visibility || "private",
        default_branch: data.default_branch || "main",
      });
      navigate(`/${repo.namespace}/${encodeURIComponent(repo.name)}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Shell crumbs={[{ label: t("repos.title"), to: "/" }, { label: t("new.title") }]}>
      <PageTitle title={t("new.title")} sub={t("new.sub")} />
      <div className="panel panelpad narrow">
        <form onSubmit={submit}>
          {error && <div className="errbox">{error}</div>}
          <Field label={t("new.name")} hint={t("new.nameHint")}>
            <input
              name="name"
              required
              pattern="[a-z0-9][a-z0-9_-]*"
              autoFocus
              placeholder="my-project"
            />
          </Field>
          <Field label={t("new.description")} optional>
            <input name="description" maxLength={240} />
          </Field>
          <Field label={t("new.visibility")}>
            <select name="visibility" defaultValue="private">
              <option value="private">
                {t("common.private")} — {t("new.privateHint")}
              </option>
              <option value="public">
                {t("common.public")} — {t("new.publicHint")}
              </option>
            </select>
          </Field>
          <Field label={t("new.branch")}>
            <input name="default_branch" defaultValue="main" />
          </Field>
          <div className="btn-group">
            <button className="btn primary" type="submit" disabled={busy}>
              {t("new.submit")}
            </button>
            <Link className="btn" to="/">
              {t("common.cancel")}
            </Link>
          </div>
        </form>
      </div>
    </Shell>
  );
}
