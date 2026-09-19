import { Link, useParams, useSearchParams } from "react-router-dom";
import { qs, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { fullDate, shortSha } from "../../lib/format";
import type { CommitItem } from "../../lib/types";
import { DiffView } from "../../components/code";
import { Empty, ErrorBox, Chip, Spinner } from "../../components/ui";
import { Icon } from "../../components/icons";
import { useRepo } from "./layout";

interface CommitDetail {
  sha?: string;
  commit?: { sha?: string; message?: string; author?: string; date?: string; parents?: string[] };
  message?: string;
  author?: string;
  date?: string;
  parents?: string[];
  files?: { path: string; status?: string }[];
  changes?: { path: string; status?: string }[];
  diff?: string;
  patch?: string;
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
  const commits = data?.commits;
  return (
    <>
      {path && (
        <div className="notebox">
          {t("commits.forPath")}: <code>{path}</code>
        </div>
      )}
      {error && <ErrorBox error={error} />}
      {loading && <Spinner />}
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
              <Chip>{shortSha(c.sha)}</Chip>
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

  const commit = data?.commit?.sha ? data.commit : data;
  const files = data?.files || data?.changes || [];
  const patch = data?.diff || data?.patch;

  return (
    <>
      {error && <ErrorBox error={error} />}
      {loading && <Spinner />}
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
            {commit.parents && commit.parents.length > 0 && (
              <div className="rowmeta mt-sm">
                <span className="faint small">
                  {t("commit.parents")}:{" "}
                  {commit.parents.map((p) => (
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
                  <span className="mono small">{f.path}</span>
                  {f.status && <span className="faint small">{f.status}</span>}
                </div>
              ))}
            </div>
          )}
          {patch && (
            <div className="diff-panel">
              <DiffView text={patch} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
