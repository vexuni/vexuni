import { Link, useParams } from "react-router-dom";
import { api, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { fullDate, shortSha } from "../../lib/format";
import { useAuth } from "../../lib/auth";
import type { CIRun } from "../../lib/types";
import { Chip, Empty, ErrorBox, Spinner, StatePill } from "../../components/ui";
import { Icon } from "../../components/icons";
import { useRepo } from "./layout";

interface RunDetail extends CIRun {
  jobs?: {
    id?: string | number;
    name?: string;
    status?: string;
    started_at?: string | number;
    finished_at?: string | number;
    duration_ms?: number;
  }[];
  logs?: string;
}

export function CIPage() {
  const { t } = useT();
  const { ns, name, base } = useRepo();
  const { data, error, loading, reload } = useApi<{ runs: CIRun[] }>(
    repoPath(ns, name) + "/ci/runs",
    [ns, name],
  );
  const runs = data?.runs;

  return (
    <>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <Spinner />}
      {runs &&
        (runs.length === 0 ? (
          <div className="panel">
            <Empty icon="ci" title={t("ci.empty")} body={t("ci.emptyBody")} />
          </div>
        ) : (
          <div className="panel">
            <div className="panelhead">
              <strong>{t("repo.ci")}</strong>
              <span className="muted small">{runs.length}</span>
            </div>
            {runs.map((r) => (
              <div className="row" key={r.id}>
                <Icon name="ci" />
                <div className="grow">
                  <Link className="rowlink title" to={`${base}/ci/${r.id}`}>
                    {r.title || `${t("ci.run")} #${r.id}`}
                  </Link>
                  <div className="meta">
                    {r.ref && <span className="mono">{r.ref}</span>}
                    {r.sha && <span className="mono">{shortSha(r.sha)}</span>}
                    {r.event && <span>{r.event}</span>}
                    <span>{fullDate(r.created_at)}</span>
                  </div>
                </div>
                <StatePill state={r.status} />
              </div>
            ))}
          </div>
        ))}
    </>
  );
}

export function CIRunPage() {
  const { t } = useT();
  const { ns, name, base } = useRepo();
  const { id } = useParams();
  const { user } = useAuth();
  const { data: run, error, loading, reload } = useApi<RunDetail>(
    repoPath(ns, name) + `/ci/runs/${id}`,
    [ns, name, id],
  );

  async function act(action: "cancel" | "retry") {
    await api.post(repoPath(ns, name) + `/ci/runs/${id}/${action}`);
    reload();
  }

  if (loading) return <Spinner />;
  if (error || !run) return <ErrorBox error={error || new Error("404")} onRetry={reload} />;

  return (
    <div className="stack">
      <div className="panel panelpad">
        <div className="titlebar">
          <div>
            <h1 className="fs-lg">
              {run.title || `${t("ci.run")} #${run.id}`}
            </h1>
            <div className="rowmeta mt-sm">
              <StatePill state={run.status} />
              {run.ref && <span className="mono">{run.ref}</span>}
              {run.sha && <Chip>{shortSha(run.sha)}</Chip>}
              <span>{fullDate(run.created_at)}</span>
            </div>
          </div>
          {user && (
            <div className="btn-group">
              {(run.status === "running" || run.status === "queued") && (
                <button className="btn" onClick={() => act("cancel")}>
                  {t("ci.cancel")}
                </button>
              )}
              <button className="btn" onClick={() => act("retry")}>
                {t("ci.retry")}
              </button>
            </div>
          )}
        </div>
      </div>
      {run.jobs && run.jobs.length > 0 && (
        <div className="panel">
          <div className="panelhead">
            <strong>Jobs</strong>
            <span className="muted small">{run.jobs.length}</span>
          </div>
          {run.jobs.map((j, i) => (
            <div className="row" key={j.id ?? i}>
              <Icon name="ci" />
              <span className="grow">{j.name || `Job ${i + 1}`}</span>
              {j.duration_ms != null && (
                <span className="faint small">{Math.round(j.duration_ms / 1000)}s</span>
              )}
              <StatePill state={j.status} />
            </div>
          ))}
        </div>
      )}
      {run.logs && (
        <div className="diff-panel">
          <pre className="codeview">
            <code>{run.logs}</code>
          </pre>
        </div>
      )}
      <p className="faint small">
        <Link to={`${base}/ci`}>← {t("repo.ci")}</Link>
      </p>
    </div>
  );
}
