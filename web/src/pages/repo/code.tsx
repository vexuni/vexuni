import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { qs, repoPath, revisionMissing } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { bytes, extOf } from "../../lib/format";
import type { Blob, Branch, Tag, Tree } from "../../lib/types";
import { CodeView } from "../../components/code";
import { Markdown, Readme } from "../../components/markdown";
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

/** Ref picker matching the app menu style; a native <select> looked
 *  unfinished next to the styled dropdowns and hid tags entirely. */
function BranchPicker({ ns, name, branches, refName }: { ns: string; name: string; branches: Branch[]; refName: string }) {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { data: tags } = useApi<{ tags: Tag[] }>(
    open ? repoPath(ns, name) + "/tags" : null,
    [ns, name, open],
  );

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (r: string) => {
    params.set("ref", r);
    setParams(params);
    setOpen(false);
  };
  const isBranch = branches.some((b) => b.name === refName);

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        className="btn ref-btn"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name={isBranch ? "branch" : "tag"} size={13} />
        <span className="ref-name">{isBranch ? refName : refName.slice(0, 10)}</span>
        <Icon name="chevD" size={12} />
      </button>
      {open && (
        <div className="menu ref-menu" role="menu">
          <div className="menu-label">{t("repo.branches")}</div>
          {branches.map((b) => (
            <button key={b.name} role="menuitemradio" aria-checked={b.name === refName} onClick={() => pick(b.name)}>
              <Icon name="branch" size={13} />
              <span className="grow">{b.name}</span>
              {b.name === refName && <Icon name="check" size={13} />}
            </button>
          ))}
          {(tags?.tags.length ?? 0) > 0 && (
            <>
              <div className="menu-label">{t("tags.title")}</div>
              {tags!.tags.map((tag) => (
                <button key={tag.name} role="menuitemradio" aria-checked={tag.name === refName} onClick={() => pick(tag.name)}>
                  <Icon name="tag" size={13} />
                  <span className="grow">{tag.name}</span>
                  {tag.name === refName && <Icon name="check" size={13} />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
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
  // Locale-suffixed readmes (README.en.md, README.zh-CN.md) are common, so
  // match readme.* rather than only bare README.md; prefer markdown variants.
  const readmeEntry = tree?.entries
    .filter(
      (e) =>
        e.type === "blob" &&
        /^readme(?:[._-][\w-]+)*(?:\.(?:md|markdown|mdown|txt|org))?$/i.test(
          e.name,
        ),
    )
    .sort((a, b) => Number(/\.(md|markdown|mdown)$/i.test(b.name)) - Number(/\.(md|markdown|mdown)$/i.test(a.name)))[0];
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
          <BranchPicker ns={ns} name={name} branches={branches.branches} refName={ref} />
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
      {readme?.content && readmeEntry ? (
        <Readme name={readmeEntry.name} text={readme.content} />
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
  const fileName = filePath.split("/").pop() || "file";
  const isMd = /^(md|markdown|mdown)$/i.test(extOf(filePath));
  const [mdMode, setMdMode] = useState<"preview" | "raw">("preview");

  const { data: blob, error, loading } = useApi<Blob>(
    repoPath(ns, name) + `/blob${qs({ ref, path: filePath })}`,
    [ns, name, ref, filePath],
  );
  const { data: branches } = useApi<{ branches: Branch[] }>(
    repoPath(ns, name) + "/branches",
    [ns, name],
  );

  // Served entirely client-side: the content is already in hand, so a
  // download needs no extra request.
  const download = () => {
    const url = URL.createObjectURL(
      new window.Blob([blob?.content || ""], { type: "text/plain" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="filebar">
        <Crumbs root={base} base={`${base}/tree`} path={dir} refName={ref} />
        <span className="sep">/</span>
        <span className="mono small">{fileName}</span>
        <span className="mark-read" />
        {blob && !blob.binary && (
          <span className="faint small">
            {bytes(blob.size)}
            {blob.content ? ` · ${blob.content.split("\n").length} ${t("code.lines")}` : ""}
          </span>
        )}
        {isMd && blob?.content && (
          <div className="seg seg-sm">
            <button type="button" className={mdMode === "preview" ? "on" : ""} onClick={() => setMdMode("preview")}>
              {t("code.preview")}
            </button>
            <button type="button" className={mdMode === "raw" ? "on" : ""} onClick={() => setMdMode("raw")}>
              {t("code.raw")}
            </button>
          </div>
        )}
        {blob?.content && <CopyButton text={blob.content} />}
        {blob?.content && (
          <button className="copy-btn" title={t("code.download")} aria-label={t("code.download")} onClick={download}>
            <Icon name="download" size={14} />
          </button>
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
          (revisionMissing(error) && branches?.branches.length === 0 ? (
            <EmptyRepo ns={ns} name={name} />
          ) : (
            <ErrorBox error={error} />
          ))}
        {loading && <SkeletonRows />}
        {blob &&
          (blob.binary ? (
            <Empty icon="file" title={fileName} body={t("code.binary")} />
          ) : isMd && mdMode === "preview" ? (
            <div className="panel panelpad">
              <Markdown text={blob.content || ""} />
            </div>
          ) : (
            <CodeView path={filePath} text={blob.content || ""} />
          ))}
      </div>
    </>
  );
}
