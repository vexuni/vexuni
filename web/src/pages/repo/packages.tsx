import { repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { timeAgo } from "../../lib/format";
import type { PackageItem } from "../../lib/types";
import { Empty, ErrorBox, Pill, Spinner } from "../../components/ui";
import { Icon } from "../../components/icons";
import { useRepo } from "./layout";

export function PackagesPage() {
  const { t } = useT();
  const { ns, name } = useRepo();
  const { data, error, loading, reload } = useApi<{
    packages: PackageItem[];
  }>(repoPath(ns, name) + "/packages", [ns, name]);
  const packages = data?.packages;

  return (
    <>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <Spinner />}
      {packages &&
        (packages.length === 0 ? (
          <div className="panel">
            <Empty
              icon="box"
              title={t("packages.empty")}
              body={t("packages.emptyBody")}
            />
          </div>
        ) : (
          <div className="panel">
            <div className="panelhead">
              <strong>{t("repo.packages")}</strong>
              <span className="muted small">{packages.length}</span>
            </div>
            {packages.map((p) => (
              <div className="row" key={p.id || p.name}>
                <Icon name="box" />
                <div className="grow">
                  <div className="title mono">{p.name}</div>
                  <div className="meta">
                    {p.latest && (
                      <span>
                        {p.latest} · {t("packages.version")}
                      </span>
                    )}
                    {p.updated_at && <span>{timeAgo(p.updated_at)}</span>}
                  </div>
                </div>
                {(p.ecosystem || p.kind) && (
                  <Pill tone="blue">{p.ecosystem || p.kind}</Pill>
                )}
              </div>
            ))}
          </div>
        ))}
    </>
  );
}
