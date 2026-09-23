import { Link, useParams, useSearchParams } from "react-router-dom";
import { qs, repoPath, revisionMissing } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { bytes } from "../../lib/format";
import type { Blob, Branch, Tree } from "../../lib/types";
import { CodeView } from "../../components/code";
import { Readme } from "../../components/markdown";
import { CopyButton, Empty, ErrorBox, SkeletonRows } from "../../components/ui";
import { Icon } from "../../components/icons";
import { useRepo } from "./layout";

function EmptyRepo({ ns, name }: { ns: string; name: string }) {
  const { t } = useT();
  const cloneURL = `${location.origin}/${ns}/${name}.git`;
  const cmds = [`git clone ${cloneURL}`, `git push ${cloneURL} HEAD:main`];
  return (
    <Empty
      icon="repo"
      title={t("repo.emptyRepo")}
      body={t("repo.emptyHint")}
      action={
        <div className="setup-cmds">
          {cmds.map((c) => (
            <div className="clone-box" key={c}>
              <code>{c}</code>
              <CopyButton text={c} />
            </div>
          ))}
        </div>
      }
    />
  );
}

function Crumbs({
  root,
  base,
  path,
  refName,
}: {
  root: string;
  base: string;
  path: string;
  refName: string;
}) {
  const parts = path.split("/").filter(Boolean);
  return (
    <span className="crumbs">
      <Link to={`${root}?ref=${encodeURIComponent(refName)}`}>⌂</Link>
      {parts.map((p, i) => (
        <span key={i} className="crumb-wrap">
          <span className="sep">/</span>
          {i === parts.length - 1 ? (
            <span className="current">{p}</span>
          ) : (
            <Link
              to={`${base}/${parts.slice(0, i + 1).join("/")}?ref=${encodeURIComponent(refName)}`}
            >
              {p}
            </Link>
          )}
        </span>
      ))}
    </span>
  );
}

function BranchPicker({ branches, refName }: { branches: Branch[]; refName: string }) {
  const [params, setParams] = useSearchParams();
  return (
    <select
      aria-label="branch"
      value={refName}
      onChange={(e) => {
        params.set("ref", e.target.value);
        setParams(params);
      }}
    >
      {branches.map((b) => (
        <option key={b.name} value={b.name}>
          {b.name}
        </option>
      ))}
      {!branches.some((b) => b.name === refName) && (
        <option value={refName}>{refName.slice(0, 10)}</option>
      )}
    </select>
  );
}

/** Repository code browser — tree listing at ?ref= + path param. */
export function RepoCodePage() {
  const { t } = useT();
  const { repo, ns, name, base } = useRepo();
  const params = useParams();
  const [search] = useSearchParams();
  const subpath = params["*"] || "";
  const ref = search.get("ref") || repo.default_branch || "HEAD";

  const { data: branches } = useApi<{ branches: Branch[] }>(
    repoPath(ns, name) + "/branches",
    [ns, name],
  );
  const { data: tree, error, loading } = useApi<Tree>(
    repoPath(ns, name) + `/tree${qs({ ref, path: subpath })}`,
    [ns, name, ref, subpath],
  );
  // The branch list is the ground truth for "no commits yet"; the tree error
  // is a fallback while it is still loading.
  const emptyRepo =
    branches?.branches.length === 0 ||
    (revisionMissing(error) && !branches?.branches.length);
  const readmeEntry = tree?.entries.find(
    (e) => e.type === "blob" && /^readme(\.(md|txt|org))?$/i.test(e.name),
  );
  const { data: readme } = useApi<Blob>(
    readmeEntry
      ? repoPath(ns, name) + `/blob${qs({ ref, path: subpath ? subpath + "/" + readmeEntry.name : readmeEntry.name })}`
      : null,
    [ns, name, ref, readmeEntry?.name, subpath],
  );

  const sorted = tree
    ? [...tree.entries].sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name) : a.type === "tree" ? -1 : 1,
      )
    : [];

  return (
    <>
      <div className="filebar">
        {branches && branches.branches.length > 0 && (
          <BranchPicker branches={branches.branches} refName={ref} />
        )}
        <Crumbs root={base} base={`${base}/tree`} path={subpath} refName={ref} />
        <span className="mark-read" />
        <Link className="faint small" to={`${base}/branches`}>
          {branches?.branches.length ?? "—"} {t("repo.branches")}
        </Link>
        <Link className="faint small" to={`${base}/tags`}>
          {t("tags.title")}
        </Link>
        <Link className="faint small" to={`${base}/commits?ref=${encodeURIComponent(ref)}`}>
          {t("repo.commits")}
        </Link>
      </div>
      <div className="filetree">
        {emptyRepo && <EmptyRepo ns={ns} name={name} />}
        {!emptyRepo && (
          <>
            {error && <ErrorBox error={error} />}
            {loading && <SkeletonRows />}
            {tree && sorted.length === 0 && (
              <Empty icon="repo" title={t("repo.emptyRepo")} body={t("repo.emptyHint")} />
            )}
          </>
        )}
        {sorted.map((e) => {
          const next = subpath ? `${subpath}/${e.name}` : e.name;
          const to =
            e.type === "tree"
              ? `${base}/tree/${next}?ref=${encodeURIComponent(ref)}`
              : `${base}/blob/${next}?ref=${encodeURIComponent(ref)}`;
          return (
            <div className="row" key={e.sha + e.name}>
              <Link to={to} className="grow">
                <Icon name={e.type === "tree" ? "folder" : "file"} size={14} />
                {e.name}
                {e.type === "tree" && "/"}
              </Link>
              <span className="size mono">{e.sha.slice(0, 7)}</span>
            </div>
          );
        })}
      </div>
      {readme?.content ? (
        <Readme name={readmeEntry!.name} text={readme.content} />
      ) : (
        tree &&
        sorted.length > 0 &&
        !readmeEntry && (
          <p className="faint small mt">{t("repo.noReadme")}</p>
        )
      )}
    </>
  );
}

/** Single file view with syntax highlighting. */
export function RepoFilePage() {
  const { t } = useT();
  const { repo, ns, name, base } = useRepo();
  const params = useParams();
  const [search] = useSearchParams();
  const filePath = params["*"] || "";
  const ref = search.get("ref") || repo.default_branch || "HEAD";
  const dir = filePath.split("/").slice(0, -1).join("/");

  const { data: blob, error, loading } = useApi<Blob>(
    repoPath(ns, name) + `/blob${qs({ ref, path: filePath })}`,
    [ns, name, ref, filePath],
  );

  return (
    <>
      <div className="filebar">
        <Crumbs root={base} base={`${base}/tree`} path={dir} refName={ref} />
        <span className="sep">/</span>
        <span className="mono small">{filePath.split("/").pop()}</span>
        <span className="mark-read" />
        {blob && (
          <span className="faint small">
            {bytes(blob.size)}
            {blob.content ? ` · ${blob.content.split("\n").length} ${t("code.lines")}` : ""}
          </span>
        )}
        <Link
          className="faint small"
          to={`${base}/commits?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(filePath)}`}
        >
          {t("code.history")}
        </Link>
      </div>
      <div className="codewrap">
        {error &&
          (revisionMissing(error) ? (
            <EmptyRepo ns={ns} name={name} />
          ) : (
            <ErrorBox error={error} />
          ))}
        {loading && <SkeletonRows />}
        {blob &&
          (blob.binary ? (
            <Empty icon="file" title={filePath.split("/").pop() || ""} body={t("code.binary")} />
          ) : (
            <CodeView path={filePath} text={blob.content || ""} />
          ))}
      </div>
    </>
  );
}
