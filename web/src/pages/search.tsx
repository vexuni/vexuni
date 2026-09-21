import { Link, useSearchParams } from "react-router-dom";
import { qs } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useT } from "../lib/i18n";
import type { SearchHit } from "../lib/types";
import { PageTitle, Shell } from "../components/layout";
import { Empty, ErrorBox, SkeletonRows } from "../components/ui";
import { Icon } from "../components/icons";

interface SearchResponse {
  results?: SearchHit[];
  code?: SearchHit[];
  issues?: SearchHit[];
  repositories?: SearchHit[];
}

function HitRow({ hit, base }: { hit: SearchHit; base: string }) {
  const ns = hit.namespace || "";
  const repo = hit.repo || hit.name || "";
  const repoBase = ns && repo ? `/${ns}/${repo}` : "";
  if (hit.kind === "code" || (hit.path && hit.line)) {
    return (
      <div className="row">
        <Icon name="file" />
        <div className="grow">
          <Link className="rowlink mono small" to={`${repoBase}/blob/${hit.path}`}>
            {ns}/{repo}:{hit.path}:{hit.line}
          </Link>
          {hit.text && (
            <div className="meta">
              <code>{hit.text.trim()}</code>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (hit.kind === "issue" || hit.title) {
    return (
      <div className="row">
        <Icon name="issue" />
        <Link className="rowlink grow" to={hit.id ? `${repoBase}/issues/${hit.id}` : repoBase}>
          {hit.title}
        </Link>
      </div>
    );
  }
  return (
    <div className="row">
      <Icon name="repo" />
      <Link className="rowlink grow" to={repoBase || base}>
        {ns ? `${ns} / ` : ""}
        {repo || hit.name}
      </Link>
      {hit.description && <span className="faint small">{hit.description}</span>}
    </div>
  );
}

export function SearchPage() {
  const { t } = useT();
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const { data, error, loading } = useApi<SearchResponse | SearchHit[]>(
    q ? `/search${qs({ q })}` : null,
    [q],
  );

  const hits: SearchHit[] = Array.isArray(data)
    ? data
    : [
        ...(data?.results || []),
        ...(data?.code || []).map((h) => ({ ...h, kind: "code" })),
        ...(data?.issues || []).map((h) => ({ ...h, kind: "issue" })),
        ...(data?.repositories || []).map((h) => ({ ...h, kind: "repo" })),
      ];

  return (
    <Shell crumbs={[{ label: t("search.title") }]}>
      <PageTitle title={t("search.title")} />
      <form className="toolbar" method="get" action="/search">
        <div className="search">
          <Icon name="search" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("search.ph")}
            aria-label={t("common.search")}
            autoFocus
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
          <Empty icon="search" title={t("search.empty")} body={t("search.emptyBody")} />
        </div>
      )}
      {data && (
        <div className="panel">
          <div className="panelhead">
            <strong>
              {hits.length} · <code>{q}</code>
            </strong>
          </div>
          {hits.length === 0 ? (
            <Empty icon="search" title={t("repos.emptySearch")} />
          ) : (
            hits.map((h, i) => <HitRow key={i} hit={h} base="/" />)
          )}
        </div>
      )}
    </Shell>
  );
}
