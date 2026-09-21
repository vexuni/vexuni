import { useSearchParams, Link } from "react-router-dom";
import { qs, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { Empty, ErrorBox, SkeletonRows } from "../../components/ui";
import { Icon } from "../../components/icons";
import { useRepo } from "./layout";

interface SearchResult {
  matches: { path: string; line: number; text: string }[];
  truncated: boolean;
}

export function RepoSearchPage() {
  const { t } = useT();
  const { repo, ns, name, base } = useRepo();
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const { data, error, loading } = useApi<SearchResult>(
    q ? repoPath(ns, name) + `/search${qs({ q, ref: repo.default_branch })}` : null,
    [ns, name, q],
  );

  return (
    <>
      <form className="toolbar" method="get" action={`${base}/search`}>
        <div className="search">
          <Icon name="search" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("repoSearch.ph")}
            aria-label={t("common.search")}
          />
        </div>
        <button className="btn" type="submit">
          {t("common.search")}
        </button>
      </form>
      {error && <ErrorBox error={error} />}
      {loading && <SkeletonRows />}
      {!q && (
        <div className="panel">
          <Empty
            icon="search"
            title={t("repoSearch.empty")}
            body={t("repoSearch.emptyBody")}
          />
        </div>
      )}
      {data && (
        <div className="panel">
          <div className="panelhead">
            <strong>
              {data.matches.length} · <code>{q}</code>
            </strong>
            {data.truncated && (
              <span className="muted small">{t("repoSearch.truncated")}</span>
            )}
          </div>
          {data.matches.length === 0 && (
            <Empty icon="search" title={t("repos.emptySearch")} />
          )}
          {data.matches.map((m, i) => (
            <div className="row" key={i}>
              <Icon name="file" />
              <div className="grow">
                <Link
                  className="rowlink mono small"
                  to={`${base}/blob/${m.path}?ref=${encodeURIComponent(repo.default_branch)}`}
                >
                  {m.path}:{m.line}
                </Link>
                <div className="meta">
                  <code>{m.text.trim()}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
