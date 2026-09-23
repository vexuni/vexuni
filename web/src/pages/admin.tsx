import { useApi } from "../lib/hooks";
import { useAuth } from "../lib/auth";
import { useT } from "../lib/i18n";
import { fullDate } from "../lib/format";
import type { Repository, User, Workspace } from "../lib/types";
import { PageTitle, Shell } from "../components/layout";
import { Empty, ErrorBox, Pill, SkeletonRows } from "../components/ui";
import { Icon } from "../components/icons";

interface Overview {
  users?: number;
  repositories?: number;
  workspaces?: number;
  issues?: number;
}

export function AdminPage() {
  const { t } = useT();
  const { user } = useAuth();
  const overview = useApi<Overview>("/admin/overview");
  const users = useApi<{ users: User[] }>("/admin/users");
  const spaces = useApi<{ workspaces: Workspace[] }>("/admin/workspaces");
  const repos = useApi<{ repositories: Repository[] }>("/admin/repositories");
  const audit = useApi<{ events: { id: number; action?: string; actor?: string; created_at?: number | string; repo_id?: string }[] }>(
    "/admin/audit",
  );

  if (!user?.admin)
    return (
      <Shell crumbs={[{ label: t("admin.title") }]}>
        <Empty icon="lock" title={t("err.notFound")} body={t("err.notFoundBody")} />
      </Shell>
    );

  const o = overview.data;
  return (
    <Shell crumbs={[{ label: t("admin.title") }]} wide>
      <PageTitle title={t("admin.title")} />
      {o && (
        <div className="metrics">
          {(["users", "repositories", "workspaces", "issues"] as const).map(
            (k) =>
              o[k] !== undefined && (
                <div className="metric" key={k}>
                  <span className="lbl">{t(`admin.${k}`)}</span>
                  <span className="num">{o[k]}</span>
                </div>
              ),
          )}
        </div>
      )}
      <div className="grid2">
        <div className="panel">
          <div className="panelhead">
            <strong>{t("admin.users")}</strong>
            <span className="muted small">{users.data?.users.length}</span>
          </div>
          {users.loading && <SkeletonRows rows={4} />}
          {users.error && <ErrorBox error={users.error} />}
          {users.data?.users.slice(0, 20).map((u) => (
            <div className="row" key={u.id}>
              <span className="avatar">{u.username?.charAt(0).toUpperCase()}</span>
              <span className="grow">{u.username}</span>
              {u.admin && <Pill tone="violet">{t("admin.role")}</Pill>}
            </div>
          ))}
        </div>
        <div className="stack">
          <div className="panel">
            <div className="panelhead">
              <strong>{t("admin.workspaces")}</strong>
              <span className="muted small">{spaces.data?.workspaces.length}</span>
            </div>
            {spaces.data?.workspaces.slice(0, 10).map((w) => (
              <div className="row" key={w.id}>
                <Icon name="users" />
                <span className="grow">{w.name || w.slug}</span>
                <span className="faint small mono">@{w.slug}</span>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panelhead">
              <strong>{t("admin.repositories")}</strong>
              <span className="muted small">{repos.data?.repositories.length}</span>
            </div>
            {repos.data?.repositories.slice(0, 10).map((r) => (
              <div className="row" key={r.id}>
                <Icon name="repo" />
                <span className="grow mono small">
                  {r.namespace}/{r.name}
                </span>
                <Pill tone={r.visibility === "private" ? "yellow" : ""}>
                  {r.visibility}
                </Pill>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="panel mt">
        <div className="panelhead">
          <strong>{t("admin.audit")}</strong>
        </div>
        {audit.data?.events.slice(0, 30).map((e) => (
          <div className="row" key={e.id}>
            <Icon name="clock" />
            <span className="grow mono small">{e.action}</span>
            <span className="faint small">{e.actor}</span>
            <span className="faint small">{fullDate(e.created_at)}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}
