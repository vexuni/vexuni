import { Link, useParams, useSearchParams } from "react-router-dom";
import { qs, repoPath, revisionMissing } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { fullDate, shortSha } from "../../lib/format";
import type { Branch, CommitItem } from "../../lib/types";
import { DiffView } from "../../components/code";
import { Empty, ErrorBox, Chip, SkeletonRows } from "../../components/ui";
import { Icon } from "../../components/icons";
import { useRepo } from "./layout";

interface CommitDetail {
  sha?: string;
  commit?: {
    sha?: string;
    message?: string;
    author?: string;
    date?: string;
    parents?: string[];
    parent_shas?: string[];
  };
  message?: string;
  author?: string;
  date?: string;
  parents?: string[];
  parent_shas?: string[];
}

interface DiffResult {
  source_sha?: string;
  target_sha?: string;
  diff?: string;
  patch?: string;
  files?: {
    path: string;
    status?: string;
    binary?: boolean;
    patch?: string;
  }[];
}

export function CommitsPage() {
  const { t } = useT();
  const { repo, ns, name, base } = useRepo();
  const [search] = useSearchParams();
  const ref = search.get("ref") || repo.default_branch || "HEAD";
  const path = search.get("path") || "";
  const { data, error, loading } = useApi<{ commits: CommitItem[] }>(
    repoPath(ns, name) + `/commits${qs({ ref, path })}`,
    [ns, name, ref, path],
  );
  const { data: branches } = useApi<{ branches: Branch[] }>(
    repoPath(ns, name) + "/branches",
    [ns, name],
  );
  const commits = data?.commits;
  // A populated repo with a bogus ref also yields "revision missing" — the
  // branch list decides whether "no commits" is true or the error is real.
  const emptyRepo = branches?.branches.length === 0;
  return (
    <>
      {path && (
        <div className="notebox">
          {t("commits.forPath")}: <code>{path}</code>
        </div>
      )}
      {error &&
        (revisionMissing(error) && (!branches || emptyRepo) ? (
          <Empty icon="commit" title={t("commits.empty")} />
        ) : (
          <ErrorBox error={error} />
        ))}
      {loading && <SkeletonRows />}
      {commits && commits.length === 0 && (
        <Empty icon="commit" title={t("commits.empty")} />
      )}
      {commits && commits.length > 0 && (
        <div className="panel">
          <div className="panelhead">
            <strong>
              <Icon name="commit" size={13} /> {ref}
            </strong>
            <span className="muted small">{commits.length}</span>
          </div>
          {commits.map((c) => (
            <div className="row" key={c.sha}>
              <span className="avatar">{c.author?.charAt(0)?.toUpperCase()}</span>
              <div className="grow">
                <Link className="rowlink title" to={`${base}/commit/${c.sha}`}>
                  {c.message}
                </Link>
                <div className="meta">
                  <span>{c.author}</span>
                  <span>{fullDate(c.date)}</span>
                </div>
              </div>
              <Link to={`${base}/commit/${c.sha}`} className="chip-link" title={c.sha}>
                <Chip>{shortSha(c.sha)}</Chip>
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function CommitDetailPage() {
  const { t } = useT();
  const { ns, name, base } = useRepo();
  const { sha = "" } = useParams();
  const { data, error, loading } = useApi<CommitDetail>(
    repoPath(ns, name) + `/commit${qs({ ref: sha })}`,
    [ns, name, sha],
  );
  // The commit endpoint returns metadata only; the diff endpoint produces the
  // change set against the first parent, which is what this page exists for.
  const { data: diff } = useApi<DiffResult>(
    sha ? repoPath(ns, name) + `/diff${qs({ sha })}` : null,
    [ns, name, sha],
  );

  const commit = data?.commit?.sha ? data.commit : data;
  const parents = commit?.parent_shas || commit?.parents || [];
  const files = diff?.files || [];

  return (
    <>
      {error && <ErrorBox error={error} />}
      {loading && <SkeletonRows />}
      {commit && (
        <div className="stack">
          <div className="panel panelpad">
            <h1 className="serif fs-lg">
              {commit.message?.split("\n")[0]}
            </h1>
            {commit.message?.includes("\n") && (
              <p className="muted mt-sm pre-wrap">
                {commit.message.split("\n").slice(1).join("\n").trim()}
              </p>
            )}
            <div className="rowmeta mt-sm">
              <span>
                {t("commit.by")} {commit.author}
              </span>
              {commit.date && <span>{fullDate(commit.date)}</span>}
              <Chip>{sha.slice(0, 10)}</Chip>
            </div>
            {parents.length > 0 && (
              <div className="rowmeta mt-sm">
                <span className="faint small">
                  {t("commit.parents")}:{" "}
                  {parents.map((p) => (
                    <Link key={p} to={`${base}/commit/${p}`} className="mono">
                      {shortSha(p)}{" "}
                    </Link>
                  ))}
                </span>
              </div>
            )}
          </div>
          {files.length > 0 && (
            <div className="panel">
              <div className="panelhead">
                <strong>{t("commit.changes")}</strong>
                <span className="muted small">{files.length}</span>
              </div>
              {files.map((f) => (
                <div className="row" key={f.path}>
                  <Icon name="diff" size={14} />
                  <Link
                    className="rowlink mono small grow"
                    to={`${base}/blob/${f.path}?ref=${encodeURIComponent(sha)}`}
                  >
                    {f.path}
                  </Link>
                  {f.status && <span className="faint small">{f.status}</span>}
                </div>
              ))}
            </div>
          )}
          {files.length > 0 ? (
            files
              .filter((f) => f.patch && !f.binary)
              .map((f) => (
                <div className="diff-panel" key={f.path}>
                  <div className="diff-filehead">
                    <Icon name="file" size={13} />
                    <span className="mono small">{f.path}</span>
                    {f.status && <span className="faint small">{f.status}</span>}
                  </div>
                  {/* The file head already shows path/status, so the patch's
                      own diff --git/index/---/+++ header is noise — keep the hunks. */}
                  <DiffView text={f.patch!.slice(Math.max(0, f.patch!.indexOf("@@")))} />
                </div>
              ))
          ) : diff?.diff || diff?.patch ? (
            <div className="diff-panel">
              <DiffView text={diff.diff || diff.patch || ""} />
            </div>
          ) : null}
          <p className="faint small">
            <Link to={`${base}/commits?ref=${encodeURIComponent(sha)}`}>← {t("repo.commits")}</Link>
          </p>
        </div>
      )}
    </>
  );
}
