import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { timeAgo, shortSha } from "../../lib/format";
import { useAuth } from "../../lib/auth";
import type { Branch, MergeDetail, MergeDiscussion, MergeRequest } from "../../lib/types";
import { DiffView } from "../../components/code";
import { Markdown } from "../../components/markdown";
import {
  Avatar,
  Empty,
  ErrorBox,
  Field,
  Pill,
  SkeletonRows,
  StatePill,
} from "../../components/ui";
import { Icon } from "../../components/icons";
import { PageTitle } from "../../components/layout";
import { useRepo } from "./layout";

export function MergesPage() {
  const { t } = useT();
  const { ns, name, base } = useRepo();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const state = params.get("state") || "open";
  const { data, error, loading, reload } = useApi<{ merges: MergeRequest[] }>(
    repoPath(ns, name) + "/merges",
    [ns, name],
  );
  const merges = (data?.merges || []).filter(
    (m) => state === "all" || m.state === state,
  );

  return (
    <>
      <div className="toolbar">
        <div className="seg">
          {["open", "merged", "closed", "all"].map((s) => (
            <Link key={s} to={`${base}/merges?state=${s}`}>
              <button type="button" className={state === s ? "on" : ""}>
                {s === "all"
                  ? t("common.all")
                  : s === "merged"
                    ? t("common.merged")
                    : s === "open"
                      ? t("issues.open")
                      : t("issues.closed")}
              </button>
            </Link>
          ))}
        </div>
        <span className="mark-read" />
        <Link className="btn primary" to={user ? `${base}/merges/new` : "/login"}>
          <Icon name="plus" /> {user ? t("merges.new") : t("repos.loginToCreate")}
        </Link>
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <SkeletonRows />}
      {merges &&
        (merges.length === 0 ? (
          <div className="panel">
            <Empty
              icon="merge"
              title={t("merges.empty")}
              body={t("merges.emptyBody")}
              action={
                <Link className="btn primary" to={user ? `${base}/merges/new` : "/login"}>
                  {user ? t("merges.first") : t("repos.loginToCreate")}
                </Link>
              }
            />
          </div>
        ) : (
          <div className="panel">
            {merges.map((m) => (
              <div className="row" key={m.id}>
                <Icon name="merge" />
                <div className="grow">
                  <Link className="rowlink title" to={`${base}/merges/${m.id}`}>
                    {m.title}
                  </Link>
                  <div className="meta">
                    <span>#{m.id}</span>
                    <span className="mono">
                      {m.source_namespace
                        ? `${m.source_namespace}:${m.source}`
                        : m.source}{" "}
                      → {m.target}
                    </span>
                    <span>{m.author}</span>
                    <span>{timeAgo(m.created_at)}</span>
                  </div>
                </div>
                <StatePill state={m.state} />
              </div>
            ))}
          </div>
        ))}
    </>
  );
}

const VERDICTS: Record<string, { icon: string; tone: string }> = {
  approve: { icon: "check", tone: "green" },
  changes: { icon: "alert", tone: "red" },
  comment: { icon: "issue", tone: "" },
};

export function MergeDetailPage() {
  const { t } = useT();
  const { repo, ns, name, base } = useRepo();
  const { id } = useParams();
  const { user } = useAuth();
  const { data: mr, error, loading, reload } = useApi<MergeDetail>(
    repoPath(ns, name) + `/merges/${id}`,
    [ns, name, id],
  );
  const [busy, setBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [err2, setErr2] = useState("");

  const rank: Record<string, number> = {
    reader: 1,
    developer: 2,
    maintainer: 3,
    owner: 4,
  };
  const canMaintain = (rank[repo.role || ""] || 0) >= 3;
  const canClose =
    !!user && (user.username === mr?.author || canMaintain) && mr?.state !== "merged";

  async function act(fn: () => Promise<unknown>) {
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
  const merge = (squash: boolean) =>
    act(() =>
      api.post(repoPath(ns, name) + `/merges/${id}/merge`, {
        strategy: "ff_prefer",
        squash,
      }),
    );
  const setState = (state: "open" | "closed") =>
    act(() => api.patch(repoPath(ns, name) + `/merges/${id}`, { state }));

  async function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (!mr?.source_sha || !mr?.target_sha) return;
    setReviewBusy(true);
    try {
      await api.post(repoPath(ns, name) + `/merges/${id}/reviews`, {
        verdict: d.verdict,
        body: d.body || "",
        source_sha: mr.source_sha,
        target_sha: mr.target_sha,
      });
      form.reset();
      await reload();
    } catch (err) {
      setErr2((err as Error).message);
    } finally {
      setReviewBusy(false);
    }
  }

  async function discuss(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = String(new FormData(form).get("body") || "");
    if (!body.trim()) return;
    setReviewBusy(true);
    try {
      await api.post(repoPath(ns, name) + `/merges/${id}/discussions`, { body });
      form.reset();
      await reload();
    } catch (err) {
      setErr2((err as Error).message);
    } finally {
      setReviewBusy(false);
    }
  }

  if (loading) return <SkeletonRows />;
  if (error || !mr) return <ErrorBox error={error || new Error("404")} onRetry={reload} />;

  const gate = mr.gate;
  const reviews = gate?.reviews || [];
  const sourceLabel = mr.source_namespace
    ? `${mr.source_namespace}:${mr.source}`
    : mr.source;

  return (
    <div className="stack">
      <PageTitle
        title={mr.title}
        sub={`#${mr.id} · ${mr.author || ""} · ${timeAgo(mr.created_at)}`}
        actions={
          canClose ? (
            mr.state === "open" ? (
              <button className="btn" onClick={() => setState("closed")} disabled={busy}>
                {t("issues.close")}
              </button>
            ) : (
              <button className="btn" onClick={() => setState("open")} disabled={busy}>
                {t("issues.reopen")}
              </button>
            )
          ) : undefined
        }
      />
      {err2 && <div className="errbox">{err2}</div>}

      <div className="panel panelpad">
        <div className="rowmeta">
          <StatePill state={mr.state} />
          <span className="mono">
            {sourceLabel} → {mr.target}
          </span>
          {mr.merged_sha && (
            <Link className="mono chip-link" to={`${base}/commit/${mr.merged_sha}`}>
              {shortSha(mr.merged_sha)}
            </Link>
          )}
          {(mr.closing_issues?.length ?? 0) > 0 && (
            <span className="faint small">
              {t("merges.closes")}{" "}
              {mr.closing_issues!.map((i) => (
                <Link key={i.id} className="mono" to={`${base}/issues/${i.id}`}>
                  #{i.id}
                </Link>
              ))}
            </span>
          )}
        </div>
        {mr.body ? (
          <Markdown text={mr.body} />
        ) : (
          <p className="faint mt">{t("issues.noBody")}</p>
        )}
      </div>

      {mr.state === "open" && (
        <div className="panel">
          <div className="panelhead">
            <strong>{t("merges.review")}</strong>
            {gate?.allowed ? (
              <Pill tone="green">{t("merges.ready")}</Pill>
            ) : (
              <Pill tone="yellow">{t("merges.blocked")}</Pill>
            )}
          </div>
          <div className="panelpad">
            {mr.stale && (
              <div className="notebox warn">
                {t("merges.stale")}
              </div>
            )}
            {gate && gate.reasons && gate.reasons.length > 0 && (
              <ul className="gate-list">
                {gate.reasons.map((r, i) => (
                  <li key={i}>
                    <Icon name="alert" size={13} /> {r}
                  </li>
                ))}
              </ul>
            )}
            {gate && (
              <div className="rowmeta small faint">
                {gate.approvals != null && (
                  <span>
                    {t("merges.approvals")}: {gate.approvals}
                  </span>
                )}
                {gate.unresolved != null && gate.unresolved > 0 && (
                  <span>
                    {t("merges.unresolved")}: {gate.unresolved}
                  </span>
                )}
                {gate.ci && (
                  <span>
                    CI: {String((gate.ci as { status?: string }).status || "")}
                  </span>
                )}
              </div>
            )}
            <div className="btn-group mt">
              {canMaintain && (
                <>
                  <button
                    className="btn accent"
                    onClick={() => merge(false)}
                    disabled={busy || !gate?.allowed}
                    title={!gate?.allowed ? t("merges.blocked") : ""}
                  >
                    <Icon name="merge" /> {t("merges.merge")}
                  </button>
                  <button
                    className="btn"
                    onClick={() => merge(true)}
                    disabled={busy || !gate?.allowed}
                  >
                    {t("merges.squash")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="panel">
          <div className="panelhead">
            <strong>{t("merges.reviews")}</strong>
            <span className="muted small">{reviews.length}</span>
          </div>
          {reviews.map((r, i) => (
            <div className="comment" key={i}>
              <div className="chead">
                <Avatar name={r.username || r.user_id || "?"} />
                <strong>{r.username || r.user_id}</strong>
                <Pill tone={VERDICTS[r.verdict]?.tone || ""}>
                  {t("merges.verdict." + r.verdict) !== `merges.verdict.${r.verdict}`
                    ? t("merges.verdict." + r.verdict)
                    : r.verdict}
                </Pill>
                {r.created_at && (
                  <span className="mark-read faint">{timeAgo(r.created_at)}</span>
                )}
              </div>
              {r.body && (
                <div className="cbody">
                  <Markdown text={r.body} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(mr.discussions?.length ?? 0) > 0 && (
        <div className="panel">
          <div className="panelhead">
            <strong>{t("merges.discussions")}</strong>
            <span className="muted small">{mr.discussions!.length}</span>
          </div>
          {mr.discussions!.map((d: MergeDiscussion) => (
            <div className="comment" key={String(d.id)}>
              <div className="chead">
                <Avatar name={d.author || "?"} />
                <strong>{d.author}</strong>
                {d.path && (
                  <code className="faint small">
                    {d.path}
                    {d.line ? `:${d.line}` : ""}
                  </code>
                )}
                {!!d.resolved && <Pill tone="green">{t("merges.resolved")}</Pill>}
                <span className="mark-read faint">{timeAgo(d.created_at)}</span>
              </div>
              <div className="cbody">
                <Markdown text={d.body} />
                <div className="btn-group mt-sm">
                  {user && !d.resolved && (
                    <button
                      className="btn small"
                      onClick={() =>
                        act(() =>
                          api.patch(
                            repoPath(ns, name) +
                              `/merges/${id}/discussions/${d.id}`,
                            { resolved: true },
                          ),
                        )
                      }
                    >
                      <Icon name="check" size={13} /> {t("merges.resolve")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {user && mr.state === "open" && (
        <div className="panel panelpad">
          <form onSubmit={discuss}>
            <Field label={t("merges.discussPh")} optional>
              <textarea name="body" placeholder={t("issues.commentPh")} />
            </Field>
            <button className="btn" disabled={reviewBusy}>
              {t("issues.comment")}
            </button>
          </form>
          <form onSubmit={review} className="mt">
            <div className="form-row">
              <Field label={t("merges.verdictLabel")}>
                <select name="verdict" defaultValue="comment">
                  <option value="comment">{t("merges.verdict.comment")}</option>
                  <option value="approve">{t("merges.verdict.approve")}</option>
                  <option value="changes">{t("merges.verdict.changes")}</option>
                </select>
              </Field>
            </div>
            <Field label={t("issues.body")} optional>
              <textarea name="body" />
            </Field>
            <button className="btn primary" disabled={reviewBusy}>
              {t("merges.submitReview")}
            </button>
          </form>
        </div>
      )}

      {mr.diff && (
        <div className="panel">
          <div className="panelhead">
            <strong>{t("commit.changes")}</strong>
          </div>
          <div className="codewrap">
            <DiffView text={mr.diff} />
          </div>
        </div>
      )}
    </div>
  );
}

export function NewMergePage() {
  const { t } = useT();
  const { repo, ns, name, base } = useRepo();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: branches } = useApi<{ branches: Branch[] }>(
    repoPath(ns, name) + "/branches",
    [ns, name],
  );
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
      const r = await api.post<{ id: number }>(repoPath(ns, name) + "/merges", {
        title: d.title,
        body: d.body || "",
        source: d.source,
        target: d.target,
      });
      navigate(`${base}/merges/${r.id}`);
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
      <PageTitle title={t("merges.new")} />
      <form onSubmit={submit}>
        {error && <div className="errbox">{error}</div>}
        <Field label={t("issues.title")}>
          <input name="title" required maxLength={240} autoFocus />
        </Field>
        <div className="form-row">
          <Field label={t("merges.source")}>
            <select name="source" required>
              {branches?.branches
                .filter((b) => b.name !== repo.default_branch)
                .map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={t("merges.target")}>
            <select name="target" defaultValue={repo.default_branch} required>
              {branches?.branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t("issues.body")} optional hint={t("issues.bodyPh")}>
          <textarea name="body" />
        </Field>
        <div className="btn-group">
          <button className="btn primary" disabled={busy}>
            {t("merges.submit")}
          </button>
          <Link className="btn" to={`${base}/merges`}>
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
