import { useEffect, useState } from "react";
import { Outlet, useOutletContext, useParams } from "react-router-dom";
import { repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import type { Repository, RepoURL } from "../../lib/types";
import { Shell, Tabs } from "../../components/layout";
import { CopyButton, ErrorBox, Pill, Skeleton, SkeletonRows } from "../../components/ui";
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
  const { ns = "", repo: name = "" } = useParams();
  const base = `/${ns}/${name}`;
  const { data: repo, error, loading, reload } = useApi<Repository>(
    repoPath(ns, name),
    [ns, name],
  );
  const { data: urls } = useApi<RepoURL>(repo ? `/repo-url/${repo.id}` : null, [
    repo?.id,
  ]);
  const [cloneOpen, setCloneOpen] = useState(false);

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
    return (
      <Shell crumbs={crumbs} wide>
        <ErrorBox error={error || new Error("404")} onRetry={reload} />
      </Shell>
    );
  }

  const cloneURL =
    urls?.url || `${location.origin}/${ns}/${name}.git`;

  return (
    <Shell crumbs={crumbs} wide>
      <div className="repo-head">
        <div className="titlebar">
          <div>
            <h1 className="repo-name">
              <span className="ns">{repo.namespace} / </span>
              {repo.name}{" "}
              <Pill tone={repo.visibility === "private" ? "yellow" : ""}>
                {repo.visibility === "private"
                  ? t("common.private")
                  : t("common.public")}
              </Pill>{" "}
              {repo.archived_at && <Pill tone="red">{t("repo.archived")}</Pill>}
            </h1>
            {repo.description && <p className="sub">{repo.description}</p>}
          </div>
          <div className="btn-group menu-wrap">
            <button className="btn" onClick={() => setCloneOpen(!cloneOpen)}>
              <Icon name="download" /> {t("repo.clone")}{" "}
              <Icon name="chevD" size={12} />
            </button>
            {cloneOpen && (
              <div className="menu" role="menu">
                <div className="clone-box">
                  <code>{cloneURL}</code>
                  <CopyButton text={cloneURL} />
                </div>
                <div className="notebox">
                  <code>
                    git clone {cloneURL}
                  </code>
                </div>
              </div>
            )}
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
