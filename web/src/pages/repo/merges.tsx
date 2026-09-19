import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, qs, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { timeAgo, shortSha } from "../../lib/format";
import { useAuth } from "../../lib/auth";
import type { Branch, MergeRequest } from "../../lib/types";
import { Markdown } from "../../components/markdown";
import {
  Empty,
  ErrorBox,
  Field,
  Spinner,
  StatePill,
} from "../../components/ui";
import { Icon } from "../../components/icons";
import { PageTitle } from "../../components/layout";
import { useRepo } from "./layout";

export function MergesPage() {
  const { t } = useT();
  const { ns, name, base } = useRepo();
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
        <Link className="btn primary" to={`${base}/merges/new`}>
          <Icon name="plus" /> {t("merges.new")}
        </Link>
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <Spinner />}
      {merges &&
        (merges.length === 0 ? (
          <div className="panel">
            <Empty
              icon="merge"
              title={t("merges.empty")}
              body={t("merges.emptyBody")}
              action={
                <Link className="btn primary" to={`${base}/merges/new`}>
                  {t("merges.first")}
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
                      {m.source_branch} → {m.target_branch}
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

export function MergeDetailPage() {
  const { t } = useT();
  const { ns, name } = useRepo();
  const { id } = useParams();
  const { user } = useAuth();
  const { data: mr, error, loading, reload } = useApi<MergeRequest>(
    repoPath(ns, name) + `/merges/${id}`,
    [ns, name, id],
  );
  const { data: preview } = useApi<{ conflict?: boolean; files?: { path: string }[] }>(
    mr && mr.state === "open"
      ? repoPath(ns, name) +
          `/merge/preview${qs({ source_branch: mr.source_branch, target_branch: mr.target_branch })}`
      : null,
    [ns, name, mr?.id],
  );
  const [busy, setBusy] = useState(false);

  async function merge() {
    if (!confirm(t("merges.mergeConfirm"))) return;
    setBusy(true);
    try {
      await api.post(repoPath(ns, name) + `/merges/${id}/merge`);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (error || !mr) return <ErrorBox error={error || new Error("404")} onRetry={reload} />;

  return (
    <div className="stack">
      <PageTitle
        title={mr.title}
        sub={`#${mr.id} · ${mr.author || ""} · ${timeAgo(mr.created_at)}`}
        actions={
          user && mr.state === "open" ? (
            <button className="btn accent" onClick={merge} disabled={busy}>
              <Icon name="merge" /> {t("merges.merge")}
            </button>
          ) : undefined
        }
      />
      <div className="panel panelpad">
        <div className="rowmeta">
          <StatePill state={mr.state} />
          <span className="mono">
            {mr.source_branch} → {mr.target_branch}
          </span>
          {mr.merged_sha && <span className="mono">{shortSha(mr.merged_sha)}</span>}
        </div>
        {preview && mr.state === "open" && (
          <div className="notebox mt">
            {preview.conflict
              ? t("merges.conflict")
              : t("merges.preview") +
                (preview.files ? ` — ${preview.files.length} files` : "")}
          </div>
        )}
        {mr.body ? (
          <Markdown text={mr.body} />
        ) : (
          <p className="faint mt">{t("issues.noBody")}</p>
        )}
      </div>
    </div>
  );
}

export function NewMergePage() {
  const { t } = useT();
  const { repo, ns, name, base } = useRepo();
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
