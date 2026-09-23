import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, qs, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { timeAgo } from "../../lib/format";
import { useAuth } from "../../lib/auth";
import type { Issue, Label, Milestone } from "../../lib/types";
import { Markdown } from "../../components/markdown";
import {
  Avatar,
  Empty,
  ErrorBox,
  Field,
  Modal,
  Pill,
  SkeletonRows,
  StatePill,
} from "../../components/ui";
import { Icon } from "../../components/icons";
import { PageTitle } from "../../components/layout";
import { useRepo } from "./layout";

export function IssuesPage() {
  const { t } = useT();
  const { ns, name, base } = useRepo();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const state = params.get("state") || "open";
  const { data, error, loading, reload } = useApi<{ issues: Issue[] }>(
    repoPath(ns, name) + `/issues${qs({ state })}`,
    [ns, name, state],
  );
  const issues = data?.issues;
  const [managing, setManaging] = useState(false);

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
        {user && (
          <button className="btn" onClick={() => setManaging(true)}>
            <Icon name="tag" /> {t("issues.manage")}
          </button>
        )}
        {/* Creation endpoints require auth — send anonymous users to sign in
            rather than to a form that can only fail. */}
        <Link className="btn primary" to={user ? `${base}/issues/new` : "/login"}>
          <Icon name="plus" /> {user ? t("issues.new") : t("repos.loginToCreate")}
        </Link>
      </div>
      {managing && <PlanningModal onClose={() => setManaging(false)} />}
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <SkeletonRows />}
      {issues &&
        (issues.length === 0 ? (
          <div className="panel">
            <Empty
              icon="issue"
              title={t("issues.empty")}
              body={t("issues.emptyBody")}
              action={
                <Link className="btn primary" to={user ? `${base}/issues/new` : "/login"}>
                  {user ? t("issues.first") : t("repos.loginToCreate")}
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

function PlanningModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { ns, name } = useRepo();
  const { data, reload } = useApi<{
    labels: Label[];
    milestones: Milestone[];
  }>(repoPath(ns, name) + "/planning", [ns, name]);
  const [busy, setBusy] = useState(false);
  const [err2, setErr2] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr2("");
    try {
      await fn();
      await reload();
    } catch (e) {
      setErr2((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const addLabel = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    run(() =>
      api.post(repoPath(ns, name) + "/labels", {
        name: String(d.get("name") || ""),
        // The API validates a bare 6-digit hex — the color input yields "#rrggbb".
        color: String(d.get("color") || "#8c8377").replace(/^#/, ""),
      }),
    ).then(() => form.reset());
  };
  const addMilestone = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    run(() =>
      api.post(repoPath(ns, name) + "/milestones", {
        title: String(d.get("title") || ""),
        due_date: String(d.get("due") || "") || null,
      }),
    ).then(() => form.reset());
  };

  return (
    <Modal title={t("issues.manage")} onClose={onClose}>
      {err2 && <div className="errbox">{err2}</div>}
      <div className="side-label">{t("issues.labels")}</div>
      <div className="label-list">
        {(data?.labels || []).map((l) => (
          <span className="chip" key={l.id}>
            <Pill tone="blue">{l.name}</Pill>
            <button
              className="btn small"
              disabled={busy}
              aria-label={t("common.delete")}
              onClick={() =>
                run(() => api.del(repoPath(ns, name) + `/labels/${l.id}`))
              }
            >
              ×
            </button>
          </span>
        ))}
        {(data?.labels || []).length === 0 && (
          <span className="faint small">{t("issues.noLabels")}</span>
        )}
      </div>
      <form onSubmit={addLabel} className="inline-form">
        <input name="name" placeholder={t("issues.labelName")} required maxLength={60} />
        <input name="color" type="color" defaultValue="#8c8377" title={t("issues.labelColor")} />
        <button className="btn" disabled={busy}>
          {t("issues.addLabel")}
        </button>
      </form>
      <div className="side-label mt">{t("issues.milestones")}</div>
      <div className="label-list">
        {(data?.milestones || []).map((m) => (
          <span className="chip" key={m.id}>
            <Icon name="milestone" size={13} /> {m.title}
            {m.due_date && <span className="faint small">{String(m.due_date).slice(0, 10)}</span>}
          </span>
        ))}
        {(data?.milestones || []).length === 0 && (
          <span className="faint small">{t("issues.noMilestones")}</span>
        )}
      </div>
      <form onSubmit={addMilestone} className="inline-form">
        <input name="title" placeholder={t("issues.milestoneTitle")} required maxLength={120} />
        <input name="due" type="date" title={t("issues.due")} />
        <button className="btn" disabled={busy}>
          {t("issues.addMilestone")}
        </button>
      </form>
    </Modal>
  );
}

export function IssueDetailPage() {
  const { t } = useT();
  const { repo, ns, name } = useRepo();
  const { id } = useParams();
  const { user } = useAuth();
  const { data: issue, error, loading, reload } = useApi<Issue>(
    repoPath(ns, name) + `/issues/${id}`,
    [ns, name, id],
  );
  const planning = useApi<{ labels: Label[]; milestones: Milestone[] }>(
    repoPath(ns, name) + "/planning",
    [ns, name],
  );
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [err2, setErr2] = useState("");

  const rank: Record<string, number> = {
    reader: 1,
    developer: 2,
    maintainer: 3,
    owner: 4,
  };
  const canWrite = (rank[repo.role || ""] || 0) >= 2;
  const canEdit = !!user && (user.username === issue?.author || canWrite);

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

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    setBusy(true);
    setErr2("");
    try {
      await api.patch(repoPath(ns, name) + `/issues/${id}`, {
        title: d.title,
        body: d.body || "",
      });
      setEditing(false);
      await reload();
    } catch (err) {
      setErr2((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Planning (labels/assignee/milestone) is a separate endpoint from content
  // edits — the server gates it at write role, so hide it for readers.
  async function savePlanning(patch: Record<string, unknown>) {
    try {
      await api.put(repoPath(ns, name) + `/issues/${id}/planning`, {
        assignee: issue?.assignee ?? null,
        milestone_id: issue?.milestone_id ?? null,
        labels: (issue?.labels || []).map((l) => l.id),
        ...patch,
      });
      await reload();
    } catch (err) {
      setErr2((err as Error).message);
    }
  }

  if (loading) return <SkeletonRows />;
  if (error || !issue) return <ErrorBox error={error || new Error("404")} onRetry={reload} />;

  const labels = planning.data?.labels || [];
  const milestones = planning.data?.milestones || [];
  const selectedLabels = new Set((issue.labels || []).map((l) => l.id));

  return (
    <div className="issue-layout">
      <div className="stack">
        <PageTitle
          title={issue.title}
          sub={`#${issue.id} · ${issue.author || ""} · ${timeAgo(issue.created_at)}`}
          actions={
            user ? (
              <span className="btn-group">
                {canEdit && !editing && (
                  <button className="btn" onClick={() => setEditing(true)}>
                    {t("common.edit")}
                  </button>
                )}
                {issue.state === "open" ? (
                  <button className="btn" onClick={() => setState("closed")}>
                    {t("issues.close")}
                  </button>
                ) : (
                  <button className="btn" onClick={() => setState("open")}>
                    {t("issues.reopen")}
                  </button>
                )}
              </span>
            ) : undefined
          }
        />
        {err2 && <div className="errbox">{err2}</div>}
        <div className="comment">
          <div className="chead">
            <Avatar name={issue.author} />
            <strong>{issue.author}</strong>
            <span className="faint">{t("issues.opened")}</span>
            <span className="mark-read faint">{timeAgo(issue.created_at)}</span>
            <StatePill state={issue.state} />
          </div>
          <div className="cbody">
            {editing ? (
              <form onSubmit={saveEdit}>
                <Field label={t("issues.title")}>
                  <input name="title" defaultValue={issue.title} required maxLength={240} />
                </Field>
                <Field label={t("issues.body")} optional>
                  <textarea name="body" defaultValue={issue.body || ""} rows={8} />
                </Field>
                <div className="btn-group">
                  <button className="btn primary" disabled={busy}>
                    {t("common.save")}
                  </button>
                  <button type="button" className="btn" onClick={() => setEditing(false)}>
                    {t("common.cancel")}
                  </button>
                </div>
              </form>
            ) : issue.body ? (
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
      <aside className="issue-side">
        <div className="side-block">
          <div className="side-label">{t("issues.assignee")}</div>
          {canWrite ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = String(
                  new FormData(e.currentTarget).get("assignee") || "",
                ).trim();
                savePlanning({ assignee: v || null });
              }}
              className="side-edit"
            >
              <input
                name="assignee"
                defaultValue={issue.assignee || ""}
                placeholder={t("issues.noAssignee")}
              />
              <button className="btn small" type="submit">
                {t("common.save")}
              </button>
            </form>
          ) : (
            <span className="small">{issue.assignee || t("issues.noAssignee")}</span>
          )}
        </div>
        <div className="side-block">
          <div className="side-label">{t("issues.labels")}</div>
          <div className="label-list">
            {labels.map((l) => (
              <label className="check" key={l.id}>
                <input
                  type="checkbox"
                  checked={selectedLabels.has(l.id)}
                  disabled={!canWrite}
                  onChange={() => {
                    const next = new Set(selectedLabels);
                    if (next.has(l.id)) next.delete(l.id);
                    else next.add(l.id);
                    savePlanning({ labels: [...next] });
                  }}
                />
                <Pill tone="blue">{l.name}</Pill>
              </label>
            ))}
            {labels.length === 0 && (
              <span className="faint small">{t("issues.noLabels")}</span>
            )}
          </div>
        </div>
        <div className="side-block">
          <div className="side-label">{t("issues.milestone")}</div>
          {canWrite && milestones.length > 0 ? (
            <select
              value={issue.milestone_id || ""}
              onChange={(e) =>
                savePlanning({ milestone_id: e.target.value || null })
              }
            >
              <option value="">{t("issues.noMilestone")}</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          ) : (
            <span className="small">
              {issue.milestone || t("issues.noMilestone")}
            </span>
          )}
        </div>
      </aside>
    </div>
  );
}

export function NewIssuePage() {
  const { t } = useT();
  const { ns, name, base } = useRepo();
  const { user } = useAuth();
  const navigate = useNavigate();
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
      // SPA nav — a full reload would drop scroll position and session fetches.
      navigate(`${base}/issues/${r.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!user)
    return (
      <div className="panel">
        <Empty
          icon="lock"
          title={t("auth.required")}
          body={t("auth.requiredBody")}
          action={
            <Link className="btn primary" to="/login">
              {t("top.login")}
            </Link>
          }
        />
      </div>
    );

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
