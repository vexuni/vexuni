import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { api, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { useToast } from "../../components/toast";
import { fullDate } from "../../lib/format";
import type { Repository } from "../../lib/types";
import { Shell, Tabs } from "../../components/layout";
import { CopyButton, Empty, ErrorBox, Pill, Skeleton, SkeletonRows } from "../../components/ui";
import { Icon } from "../../components/icons";

export interface RepoCtx {
  repo: Repository;
  ns: string;
  name: string;
  base: string;
}

export function useRepo() {
  return useOutletContext<RepoCtx>();
}

export function RepoLayout() {
  const { t } = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { ns = "", repo: name = "" } = useParams();
  const base = `/${ns}/${name}`;
  const { data: repo, error, loading, reload } = useApi<Repository>(
    repoPath(ns, name),
    [ns, name],
  );
  const [cloneOpen, setCloneOpen] = useState(false);
  const [forkBusy, setForkBusy] = useState(false);

  // Social actions need an account; routing anonymous clicks to login beats
  // a dead 401 from the endpoint.
  const needUser = () => {
    if (user) return true;
    navigate("/login");
    return false;
  };
  const toggle = async (kind: "star" | "watch", on?: boolean) => {
    if (!needUser()) return;
    try {
      if (on) await api.del(repoPath(ns, name) + "/" + kind);
      else await api.put(repoPath(ns, name) + "/" + kind);
      // The mutation cleared the GET cache, so this detail refetch is fresh.
      reload();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  const fork = async () => {
    if (!needUser() || forkBusy) return;
    setForkBusy(true);
    try {
      const r = await api.post<Repository>("/repos", {
        name,
        base_repo: { id: `${ns}/${name}` },
        // A fork of public content must stay public — the source remains
        // readable regardless of the fork's visibility flag.
        visibility: repo?.visibility === "public" ? "public" : "private",
        description: repo?.description || "",
      });
      navigate(`/${r.namespace}/${encodeURIComponent(r.name)}`);
    } catch (e) {
      toast((e as Error).message, "err");
      setForkBusy(false);
    }
  };

  useEffect(() => {
    if (!cloneOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCloneOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".menu-wrap")) setCloneOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [cloneOpen]);

  const crumbs = [
    { label: t("repos.title"), to: "/" },
    { label: `${ns} / ${name}` },
  ];

  if (loading) {
    return (
      <Shell crumbs={crumbs} wide>
        <div className="titlebar">
          <Skeleton className="sk-w-40" />
        </div>
        <SkeletonRows rows={6} />
      </Shell>
    );
  }
  if (error || !repo) {
    // A missing or private repo is an expected state, not an exception — give
    // it the same designed treatment as the other empty states. Other failures
    // keep the retry affordance.
    const missing = error ? /not found/i.test(error.message) : true;
    return (
      <Shell crumbs={crumbs} wide>
        {missing ? (
          <div className="panel">
            <Empty
              icon="repo"
              title={t("err.notFound")}
              body={t("err.notFoundBody")}
              action={
                <Link className="btn" to="/">
                  {t("err.backHome")}
                </Link>
              }
            />
          </div>
        ) : (
          <ErrorBox error={error || new Error("404")} onRetry={reload} />
        )}
      </Shell>
    );
  }

  // The detail payload carries clone_url — a second /repo-url round trip per
  // page view only re-derived the same string server-side.
  const cloneURL =
    repo.clone_url || `${location.origin}/${ns}/${name}.git`;

  return (
    <Shell crumbs={crumbs} wide>
      <div className="repo-head">
        <div className="titlebar">
          <div>
            <h1 className="repo-name">
              <Link className="ns rowlink" to={`/${repo.namespace}`}>
                {repo.namespace}
              </Link>
              <span className="ns"> / </span>
              {repo.name}{" "}
              <Pill tone={repo.visibility === "private" ? "yellow" : ""}>
                {repo.visibility === "private"
                  ? t("common.private")
                  : t("common.public")}
              </Pill>{" "}
              {repo.archived_at && <Pill tone="red">{t("repo.archived")}</Pill>}
            </h1>
            {repo.forked_from && (
              <p className="faint small">
                {t("repo.forkedFrom")}{" "}
                <Link className="mono" to={`/${repo.forked_from}`}>
                  {repo.forked_from}
                </Link>
              </p>
            )}
            {repo.description && <p className="sub">{repo.description}</p>}
            <div className="rowmeta repo-meta">
              <span>
                <Icon name="branch" size={12} /> {repo.default_branch}
              </span>
              {repo.created_at && (
                <span>
                  {t("common.created")} {fullDate(repo.created_at)}
                </span>
              )}
            </div>
          </div>
          <div className="btn-group">
            <button
              className={`btn social-btn${repo.starred ? " on" : ""}`}
              onClick={() => toggle("star", repo.starred)}
              title={repo.starred ? t("repo.unstar") : t("repo.star")}
            >
              <Icon name="star" /> {repo.stars ?? 0}
            </button>
            <button
              className={`btn social-btn${repo.watching ? " on" : ""}`}
              onClick={() => toggle("watch", repo.watching)}
              title={repo.watching ? t("repo.unwatch") : t("repo.watch")}
            >
              <Icon name="eye" />
            </button>
            <button
              className="btn social-btn"
              onClick={fork}
              disabled={forkBusy}
              title={t("repo.fork")}
            >
              <Icon name="fork" /> {repo.forks ?? 0}
            </button>
            <span className="menu-wrap">
              <button className="btn primary" onClick={() => setCloneOpen(!cloneOpen)}>
                <Icon name="download" /> {t("repo.clone")}{" "}
                <Icon name="chevD" size={12} />
              </button>
            {cloneOpen && (
              <div className="menu clone-menu" role="menu">
                <div className="menu-label">{t("repo.cloneUrl")}</div>
                <div className="clone-box">
                  <code>{cloneURL}</code>
                  <CopyButton text={cloneURL} />
                </div>
                <div className="menu-label">{t("repo.cloneCmd")}</div>
                <div className="clone-box">
                  <code>git clone {cloneURL}</code>
                  <CopyButton text={`git clone ${cloneURL}`} />
                </div>
              </div>
            )}
            </span>
          </div>
        </div>
      </div>
      <Tabs
        base={base}
        items={[
          { to: ".", label: t("repo.code"), icon: "code" },
          { to: "/issues", label: t("repo.issues"), icon: "issue" },
          { to: "/merges", label: t("repo.merges"), icon: "merge" },
          { to: "/commits", label: t("repo.commits"), icon: "commit" },
          { to: "/releases", label: t("repo.releases"), icon: "release" },
          { to: "/ci", label: t("repo.ci"), icon: "ci" },
          { to: "/packages", label: t("repo.packages"), icon: "box" },
          { to: "/search", label: t("repo.search"), icon: "search" },
          { to: "/settings", label: t("repo.settings"), icon: "gear" },
        ]}
      />
      <Outlet context={{ repo, ns, name, base } satisfies RepoCtx} />
    </Shell>
  );
}
