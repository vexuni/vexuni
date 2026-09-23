import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, qs } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useT } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { fullDate, timeAgo } from "../lib/format";
import type { Member, Profile, Repository, WorkspaceDetail } from "../lib/types";
import { PageTitle, Shell } from "../components/layout";
import { Empty, Pill, SkeletonRows } from "../components/ui";
import { Icon } from "../components/icons";

function RepoRows({ repos }: { repos: Repository[] }) {
  const { t } = useT();
  if (!repos.length)
    return (
      <div className="panel">
        <Empty icon="repo" title={t("ns.noRepos")} body={t("ns.noReposBody")} />
      </div>
    );
  return (
    <div className="panel">
      {repos.map((r) => (
        <article className="repo-row" key={r.id}>
          <div className="repo-icon">
            <Icon name="repo" size={17} />
          </div>
          <div className="grow">
            <Link
              className="repo-name"
              to={`/${r.namespace}/${encodeURIComponent(r.name)}`}
            >
              <span className="ns">{r.namespace} / </span>
              {r.name}
            </Link>
            <p className="repo-desc">{r.description || t("repos.none")}</p>
            <div className="rowmeta">
              <span>
                <Icon name="branch" size={12} /> {r.default_branch}
              </span>
              {(r.stars ?? 0) > 0 && (
                <span>
                  <Icon name="star" size={12} /> {r.stars}
                </span>
              )}
              {(r.forks ?? 0) > 0 && (
                <span>
                  <Icon name="fork" size={12} /> {r.forks}
                </span>
              )}
              {r.created_at && (
                <span>
                  {t("common.created")} {fullDate(r.created_at)}
                </span>
              )}
            </div>
          </div>
          <Pill tone={r.visibility === "private" ? "yellow" : ""}>
            {r.visibility === "private"
              ? t("common.private")
              : t("common.public")}
          </Pill>
        </article>
      ))}
    </div>
  );
}

function UserProfile({ username, data }: { username: string; data: Profile }) {
  const { t } = useT();
  const { user } = useAuth();
  const [activity, setActivity] = useState<Profile["activity"]>(data.activity);
  const [next, setNext] = useState<number | null>(data.next);
  const [moreBusy, setMoreBusy] = useState(false);
  const p = data.profile;

  async function more() {
    if (!next) return;
    setMoreBusy(true);
    try {
      const d = await api.get<Profile>(`/profiles/${username}?before=${next}`);
      setActivity((a) => [...a, ...d.activity]);
      setNext(d.next);
    } finally {
      setMoreBusy(false);
    }
  }

  return (
    <>
      <div className="ns-head panel panelpad">
        <span className="avatar avatar-lg">
          {(p.display_name || p.username).charAt(0).toUpperCase()}
        </span>
        <div className="grow">
          <h1 className="serif fs-lg">{p.display_name || p.username}</h1>
          <div className="rowmeta">
            <span className="mono">@{p.username}</span>
            {p.location && (
              <span>
                <Icon name="globe" size={12} /> {p.location}
              </span>
            )}
            {p.website && (
              <a
                className="rowlink"
                href={p.website}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Icon name="ext" size={12} /> {p.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {p.created_at && (
              <span>
                {t("ns.joined")} {fullDate(p.created_at)}
              </span>
            )}
          </div>
          {p.bio && <p className="sub mt-sm">{p.bio}</p>}
        </div>
        {user?.username === p.username && (
          <Link className="btn" to="/settings/profile">
            {t("ns.editProfile")}
          </Link>
        )}
      </div>
      <div className="ns-grid">
        <section>
          <PageTitle title={t("ns.repositories")} />
          <RepoRows repos={data.repositories} />
        </section>
        <section>
          <PageTitle title={t("ns.activity")} />
          <div className="panel">
            {activity.length === 0 && (
              <Empty icon="clock" title={t("ns.noActivity")} />
            )}
            {activity.map((a) => (
              <div className="row" key={a.id}>
                <Icon name="commit" size={14} />
                <div className="grow">
                  <span className="title small">
                    {t("act." + a.action) !== "act." + a.action
                      ? t("act." + a.action)
                      : a.action}
                    {a.detail ? ` — ${a.detail}` : ""}
                  </span>
                  <div className="meta">
                    <Link to={`/${a.namespace}/${encodeURIComponent(a.name)}`} className="mono">
                      {a.namespace}/{a.name}
                    </Link>
                    <span>{timeAgo(a.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
            {next && (
              <div className="row">
                <button className="btn grow" onClick={more} disabled={moreBusy}>
                  {t("common.more")}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function WorkspaceProfile({ ws }: { ws: WorkspaceDetail }) {
  const { t } = useT();
  const { user } = useAuth();
  const { data: repos } = useApi<{ repositories: Repository[] }>(
    `/repos${qs({ namespace: ws.slug, limit: 50 })}`,
    [ws.slug],
  );
  // Members list is role-gated; a non-member gets a 404 and the section hides.
  const { data: members } = useApi<{ members: Member[] }>(
    `/workspaces/${ws.slug}/members`,
    [ws.slug],
  );

  return (
    <>
      <div className="ns-head panel panelpad">
        <span className="avatar avatar-lg">
          {(ws.name || ws.slug).charAt(0).toUpperCase()}
        </span>
        <div className="grow">
          <h1 className="serif fs-lg">{ws.name || ws.slug}</h1>
          <div className="rowmeta">
            <span className="mono">@{ws.slug}</span>
            {ws.member_count != null && (
              <span>
                <Icon name="users" size={12} /> {ws.member_count}{" "}
                {t("spaces.members")}
              </span>
            )}
            {ws.created_at && (
              <span>
                {t("common.created")} {fullDate(ws.created_at)}
              </span>
            )}
          </div>
          {ws.description && <p className="sub mt-sm">{ws.description}</p>}
        </div>
        {user && ws.role && <Pill>{ws.role}</Pill>}
      </div>
      <div className="ns-grid">
        <section>
          <PageTitle title={t("ns.repositories")} />
          {repos ? (
            <RepoRows repos={repos.repositories} />
          ) : (
            <SkeletonRows rows={3} />
          )}
        </section>
        {members && members.members.length > 0 && (
          <section>
            <PageTitle title={t("spaces.members")} />
            <div className="panel">
              {members.members.map((m) => (
                <div className="row" key={m.username}>
                  <span className="avatar">{m.username.charAt(0).toUpperCase()}</span>
                  <Link className="rowlink title grow" to={`/${m.username}`}>
                    {m.username}
                  </Link>
                  <span className="faint small">{m.role}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

/** Single-segment namespace page — users and workspaces share the URL space
 *  (GitHub-style /owner), so try the user profile first and fall back to a
 *  workspace lookup. Reserved app routes can never be namespaces because the
 *  server rejects those slugs at signup. */
export function NamespacePage() {
  const { t } = useT();
  const { ns = "" } = useParams();
  const [result, setResult] = useState<
    | { kind: "user"; profile: Profile }
    | { kind: "workspace"; ws: WorkspaceDetail }
    | { kind: "missing" }
    | null
  >(null);

  useEffect(() => {
    let live = true;
    setResult(null);
    api
      .get<Profile>(`/profiles/${ns}`)
      .then((profile) => live && setResult({ kind: "user", profile }))
      .catch(() =>
        api
          .get<WorkspaceDetail>(`/workspaces/${ns}`)
          .then((ws) => live && setResult({ kind: "workspace", ws }))
          .catch(() => live && setResult({ kind: "missing" })),
      );
    return () => {
      live = false;
    };
  }, [ns]);

  return (
    <Shell crumbs={[{ label: t("repos.title"), to: "/" }, { label: ns }]}>
      {result === null && <SkeletonRows rows={6} />}
      {result?.kind === "user" && (
        <UserProfile username={ns} data={result.profile} />
      )}
      {result?.kind === "workspace" && <WorkspaceProfile ws={result.ws} />}
      {result?.kind === "missing" && (
        <div className="panel">
          <Empty
            icon="users"
            title={t("err.notFound")}
            body={t("err.notFoundBody")}
            action={
              <Link className="btn" to="/">
                {t("err.backHome")}
              </Link>
            }
          />
        </div>
      )}
    </Shell>
  );
}
