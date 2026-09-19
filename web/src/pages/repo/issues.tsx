import { useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, qs, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { timeAgo } from "../../lib/format";
import { useAuth } from "../../lib/auth";
import type { Issue } from "../../lib/types";
import { Markdown } from "../../components/markdown";
import {
  Avatar,
  Empty,
  ErrorBox,
  Field,
  Pill,
  Spinner,
  StatePill,
} from "../../components/ui";
import { Icon } from "../../components/icons";
import { PageTitle } from "../../components/layout";
import { useRepo } from "./layout";

export function IssuesPage() {
  const { t } = useT();
  const { ns, name, base } = useRepo();
  const [params] = useSearchParams();
  const state = params.get("state") || "open";
  const { data, error, loading, reload } = useApi<{ issues: Issue[] }>(
    repoPath(ns, name) + `/issues${qs({ state })}`,
    [ns, name, state],
  );
  const issues = data?.issues;

  return (
    <>
      <div className="toolbar">
        <div className="seg">
          {["open", "closed", "all"].map((s) => (
            <Link key={s} to={`${base}/issues?state=${s}`}>
              <button type="button" className={state === s ? "on" : ""}>
                {s === "all"
                  ? t("common.all")
                  : s === "open"
                    ? t("issues.open")
                    : t("issues.closed")}
              </button>
            </Link>
          ))}
        </div>
        <span className="mark-read" />
        <Link className="btn primary" to={`${base}/issues/new`}>
          <Icon name="plus" /> {t("issues.new")}
        </Link>
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <Spinner />}
      {issues &&
        (issues.length === 0 ? (
          <div className="panel">
            <Empty
              icon="issue"
              title={t("issues.empty")}
              body={t("issues.emptyBody")}
              action={
                <Link className="btn primary" to={`${base}/issues/new`}>
                  {t("issues.first")}
                </Link>
              }
            />
          </div>
        ) : (
          <div className="panel">
            {issues.map((i) => (
              <div className="row" key={i.id}>
                <Icon name="issue" />
                <div className="grow">
                  <Link className="rowlink title" to={`${base}/issues/${i.id}`}>
                    {i.title}
                    {i.labels?.map((l) => (
                      <Pill key={l.id} tone="blue">
                        {l.name}
                      </Pill>
                    ))}
                  </Link>
                  <div className="meta">
                    <span>#{i.id}</span>
                    <span>{i.author}</span>
                    <span>{timeAgo(i.created_at)}</span>
                    {!!i.comment_count && (
                      <span>{i.comment_count} {t("issues.comment")}</span>
                    )}
                  </div>
                </div>
                <StatePill state={i.state} />
              </div>
            ))}
          </div>
        ))}
    </>
  );
}

export function IssueDetailPage() {
  const { t } = useT();
  const { ns, name } = useRepo();
  const { id } = useParams();
  const { user } = useAuth();
  const { data: issue, error, loading, reload } = useApi<Issue>(
    repoPath(ns, name) + `/issues/${id}`,
    [ns, name, id],
  );
  const [busy, setBusy] = useState(false);

  async function comment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") || "");
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api.post(repoPath(ns, name) + `/issues/${id}/comments`, { body });
      form.reset();
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function setState(state: "open" | "closed") {
    await api.patch(repoPath(ns, name) + `/issues/${id}`, { state });
    reload();
  }

  if (loading) return <Spinner />;
  if (error || !issue) return <ErrorBox error={error || new Error("404")} onRetry={reload} />;

  return (
    <div className="stack">
      <PageTitle
        title={issue.title}
        sub={`#${issue.id} · ${issue.author || ""} · ${timeAgo(issue.created_at)}`}
        actions={
          user ? (
            issue.state === "open" ? (
              <button className="btn" onClick={() => setState("closed")}>
                {t("issues.close")}
              </button>
            ) : (
              <button className="btn" onClick={() => setState("open")}>
                {t("issues.reopen")}
              </button>
            )
          ) : undefined
        }
      />
      <div className="comment">
        <div className="chead">
          <Avatar name={issue.author} />
          <strong>{issue.author}</strong>
          <span className="faint">{t("issues.opened")}</span>
          <span className="mark-read faint">{timeAgo(issue.created_at)}</span>
          <StatePill state={issue.state} />
        </div>
        <div className="cbody">
          {issue.body ? (
            <Markdown text={issue.body} />
          ) : (
            <p className="faint mt">{t("issues.noBody")}</p>
          )}
        </div>
      </div>
      {issue.comments?.map((c) => (
        <div className="comment" key={c.id}>
          <div className="chead">
            <Avatar name={c.author} />
            <strong>{c.author}</strong>
            <span className="faint">{t("issues.commented")}</span>
            <span className="mark-read faint">{timeAgo(c.created_at)}</span>
          </div>
          <div className="cbody">
            <Markdown text={c.body} />
          </div>
        </div>
      ))}
      {user && (
        <form onSubmit={comment} className="panel panelpad">
          <Field label={t("issues.comment")}>
            <textarea name="body" placeholder={t("issues.commentPh")} />
          </Field>
          <button className="btn primary" disabled={busy}>
            {t("issues.comment")}
          </button>
        </form>
      )}
      {!user && (
        <div className="notebox">
          <Link to="/login">{t("top.login")}</Link> · {t("issues.commentPh")}
        </div>
      )}
    </div>
  );
}

export function NewIssuePage() {
  const { t } = useT();
  const { ns, name, base } = useRepo();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    setBusy(true);
    setError("");
    try {
      const r = await api.post<{ id: number }>(repoPath(ns, name) + "/issues", {
        title: d.title,
        body: d.body || "",
      });
      location.href = `${base}/issues/${r.id}`;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="panel panelpad narrow">
      <PageTitle title={t("issues.new")} />
      <form onSubmit={submit}>
        {error && <div className="errbox">{error}</div>}
        <Field label={t("issues.title")}>
          <input name="title" required maxLength={240} autoFocus />
        </Field>
        <Field label={t("issues.body")} optional hint={t("issues.bodyPh")}>
          <textarea name="body" />
        </Field>
        <div className="btn-group">
          <button className="btn primary" disabled={busy}>
            {t("issues.submit")}
          </button>
          <Link className="btn" to={`${base}/issues`}>
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
