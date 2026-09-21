import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useT } from "../lib/i18n";
import { timeAgo } from "../lib/format";
import type { Notification } from "../lib/types";
import { PageTitle, Shell } from "../components/layout";
import { Empty, ErrorBox, SkeletonRows } from "../components/ui";

export function NotificationsPage() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi<{
    notifications: Notification[];
  }>("/notifications");
  const items = data?.notifications;

  async function markAll() {
    await api.post("/notifications/read", { all: true });
    reload();
  }

  return (
    <Shell crumbs={[{ label: t("notif.title") }]}>
      <PageTitle
        title={t("notif.title")}
        actions={
          items && items.length > 0 ? (
            <button className="btn" onClick={markAll}>
              {t("notif.markAll")}
            </button>
          ) : undefined
        }
      />
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <SkeletonRows />}
      {items &&
        (items.length === 0 ? (
          <div className="panel">
            <Empty icon="bell" title={t("notif.empty")} body={t("notif.emptyBody")} />
          </div>
        ) : (
          <div className="panel">
            {items.map((n) => {
              const target =
                n.url ||
                (n.namespace && n.repo_name ? `/${n.namespace}/${n.repo_name}` : "/");
              const unread = !n.read && !n.read_at;
              return (
                <div className="row" key={n.id}>
                  <span className={`dot${unread ? " blue" : ""}`} />
                  <div className="grow">
                    <Link className="rowlink" to={target}>
                      {n.title || n.type || `#${n.id}`}
                    </Link>
                    <div className="meta">
                      {n.namespace && n.repo_name && (
                        <span className="mono">
                          {n.namespace}/{n.repo_name}
                        </span>
                      )}
                      <span>{timeAgo(n.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
    </Shell>
  );
}
