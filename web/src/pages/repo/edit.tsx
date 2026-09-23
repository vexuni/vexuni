import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, qs, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import type { Blob, Branch } from "../../lib/types";
import { Empty, ErrorBox, Field, SkeletonRows } from "../../components/ui";
import { Icon } from "../../components/icons";
import { PageTitle } from "../../components/layout";
import { useRepo } from "./layout";

/** Web editor for creating, editing and deleting files. Commits go through
 *  POST /commit with an expected_sha guard so a stale view can't silently
 *  clobber a newer head; targeting a new branch runs branch-create first —
 *  the same two-step GitHub performs under the hood. */
export function FileEditPage() {
  const { t } = useT();
  const { repo, ns, name, base } = useRepo();
  const { user } = useAuth();
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const filePath = params["*"] || "";
  const ref = search.get("ref") || repo.default_branch || "main";
  // /new/* carries a directory, /edit/* a file; the route prefix decides mode
  // because `mode` alone can't distinguish "create in dir" from "edit file".
  const mode = location.pathname.startsWith(`${base}/new`)
    ? "new"
    : search.get("mode") || "edit"; // edit | delete
  // In new mode the splat is the directory itself; otherwise it's the parent.
  const dir =
    mode === "new" ? filePath : filePath.split("/").slice(0, -1).join("/");

  const { data: blob, error, loading } = useApi<Blob>(
    mode !== "new" && filePath
      ? repoPath(ns, name) + `/blob${qs({ ref, path: filePath })}`
      : null,
    [ns, name, ref, filePath, mode],
  );
  const { data: branches } = useApi<{ branches: Branch[] }>(
    repoPath(ns, name) + "/branches",
    [ns, name],
  );
  const [content, setContent] = useState<string | null>(null);
  const [error2, setError2] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user)
    return (
      <div className="panel">
        <Empty
          icon="lock"
          title={t("auth.required")}
          body={t("auth.requiredBody")}
          action={
            <Link className="btn primary" to="/login">
              {t("top.login")}
            </Link>
          }
        />
      </div>
    );

  async function commit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    setBusy(true);
    setError2("");
    try {
      if (d.branch_choice === "__new" && !d.new_branch?.trim())
        throw new Error(t("edit.branchRequired"));
      const branch = d.branch_choice === "__new" ? d.new_branch.trim() : ref;
      let head = branches?.branches.find((b) => b.name === ref)?.sha || null;
      if (d.branch_choice === "__new") {
        const created = await api.post<{ sha?: string }>(
          repoPath(ns, name) + "/branches/create",
          { target_branch: branch, base_ref: ref },
        );
        // The fresh branch points at the sha branch-create returned (or the
        // base ref's head); either is what expected_sha must match.
        head = created?.sha || head;
      }
      const path = mode === "new" ? (dir ? dir + "/" : "") + d.filename.trim() : filePath;
      const text = mode === "delete" ? null : content ?? blob?.content ?? "";
      if (text !== null && new window.Blob([text]).size > 1024 * 1024)
        throw new Error(t("edit.tooLarge"));
      // expected_sha is the server's optimistic lock — it must equal the head
      // the commit lands on, so a stale view can't clobber a newer commit.
      await api.post(repoPath(ns, name) + "/commit", {
        branch,
        expected_sha: head,
        message:
          d.message ||
          (mode === "delete"
            ? `Delete ${filePath}`
            : mode === "new"
              ? `Create ${path}`
              : `Update ${filePath}`),
        files: [{ path, content: text }],
      });
      navigate(
        mode === "delete"
          ? `${base}/tree/${dir}?ref=${encodeURIComponent(branch)}`
          : `${base}/blob/${path}?ref=${encodeURIComponent(branch)}`,
      );
    } catch (err) {
      setError2((err as Error).message);
      setBusy(false);
    }
  }

  const body = content ?? blob?.content ?? "";
  const title =
    mode === "new"
      ? t("edit.newFile")
      : mode === "delete"
        ? t("edit.deleteFile")
        : t("edit.editFile");

  return (
    <div className="stack">
      <PageTitle title={title} sub={filePath || dir || "/"} />
      {error && <ErrorBox error={error} />}
      {loading && mode !== "new" && <SkeletonRows />}
      {blob?.binary && mode !== "delete" ? (
        <div className="panel">
          <Empty icon="file" title={filePath} body={t("code.binary")} />
        </div>
      ) : mode === "delete" ? (
        <form onSubmit={commit} className="panel panelpad narrow">
          {error2 && <div className="errbox">{error2}</div>}
          <p className="muted">
            {t("edit.deleteHint")} <code>{filePath}</code>
          </p>
          <Field label={t("edit.message")}>
            <input name="message" defaultValue={`Delete ${filePath}`} required />
          </Field>
          <Field label={t("edit.branch")}>
            <select name="branch_choice" defaultValue="current">
              <option value="current">
                {t("edit.direct")} {ref}
              </option>
              <option value="__new">{t("edit.newBranch")}</option>
            </select>
          </Field>
          <Field label={t("edit.newBranchName")} optional>
            <input name="new_branch" pattern="[a-zA-Z0-9][a-zA-Z0-9_./-]*" />
          </Field>
          <div className="btn-group">
            <button className="btn danger" disabled={busy}>
              {t("edit.commitDelete")}
            </button>
            <Link className="btn" to={`${base}/blob/${filePath}?ref=${encodeURIComponent(ref)}`}>
              {t("common.cancel")}
            </Link>
          </div>
        </form>
      ) : (
        <form onSubmit={commit} className="stack">
          {error2 && <div className="errbox">{error2}</div>}
          {mode === "new" && (
            <div className="panel panelpad">
              <Field label={t("edit.filename")} hint={dir ? `${dir}/` : "/"}>
                <input
                  name="filename"
                  required
                  pattern="[^/]+"
                  autoFocus
                  placeholder="filename.ext"
                />
              </Field>
            </div>
          )}
          <div className="panel">
            <div className="panelhead">
              <strong className="mono small">{filePath || dir || "/"}</strong>
              <span className="faint small">{t("edit.textarea")}</span>
            </div>
            <textarea
              className="editor-area"
              name="content"
              value={body}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              autoFocus={mode !== "new"}
              rows={Math.min(40, Math.max(12, body.split("\n").length + 2))}
            />
          </div>
          <div className="panel panelpad">
            <Field label={t("edit.message")}>
              <input
                name="message"
                required
                defaultValue={
                  mode === "new" ? `Create ` : `Update ${filePath}`
                }
              />
            </Field>
            <div className="form-row">
              <Field label={t("edit.branch")}>
                <select name="branch_choice" defaultValue="current">
                  <option value="current">
                    {t("edit.direct")} {ref}
                  </option>
                  <option value="__new">{t("edit.newBranch")}</option>
                </select>
              </Field>
              <Field label={t("edit.newBranchName")} optional>
                <input name="new_branch" pattern="[a-zA-Z0-9][a-zA-Z0-9_./-]*" />
              </Field>
            </div>
            <div className="btn-group">
              <button className="btn primary" disabled={busy}>
                <Icon name="commit" /> {t("edit.commit")}
              </button>
              <Link
                className="btn"
                to={
                  mode === "new"
                    ? `${base}/tree/${dir}?ref=${encodeURIComponent(ref)}`
                    : `${base}/blob/${filePath}?ref=${encodeURIComponent(ref)}`
                }
              >
                {t("common.cancel")}
              </Link>
            </div>
          </div>
        </form>
      )}
      {mode === "edit" && blob?.content && content !== null && content !== blob.content && (
        <div className="panel">
          <div className="panelhead">
            <strong>{t("edit.previewDiff")}</strong>
          </div>
          <DiffPreview oldText={blob.content || ""} newText={content} />
        </div>
      )}
    </div>
  );
}

function DiffPreview({ oldText, newText }: { oldText: string; newText: string }) {
  // Lightweight line diff for the preview — LCS over the changed middle only,
  // good enough for the commit-time sanity check (the authoritative diff is
  // server-side). Identical edge lines are trimmed first so a small edit in a
  // large file never allocates the full matrix.
  const a = oldText.split("\n");
  const b = newText.split("\n");
  let lo = 0,
    hiA = a.length,
    hiB = b.length;
  while (lo < hiA && lo < hiB && a[lo] === b[lo]) lo++;
  while (hiA > lo && hiB > lo && a[hiA - 1] === b[hiB - 1]) {
    hiA--;
    hiB--;
  }
  const midA = a.slice(lo, hiA);
  const midB = b.slice(lo, hiB);
  const rows: { k: " " | "+" | "-"; t: string }[] = [];
  // The LCS table is m×n cells; past ~200k a block view is both cheaper and
  // just as honest for the "everything moved" case.
  if (midA.length * midB.length <= 200_000) {
    const m = midA.length,
      n = midB.length;
    const dp: Uint32Array[] = Array.from(
      { length: m + 1 },
      () => new Uint32Array(n + 1),
    );
    for (let i = m - 1; i >= 0; i--)
      for (let j = n - 1; j >= 0; j--)
        dp[i][j] =
          midA[i] === midB[j]
            ? dp[i + 1][j + 1] + 1
            : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0,
      j = 0;
    while (i < m && j < n) {
      if (midA[i] === midB[j]) {
        rows.push({ k: " ", t: midA[i] });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1])
        rows.push({ k: "-", t: midA[i++] });
      else rows.push({ k: "+", t: midB[j++] });
    }
    while (i < m) rows.push({ k: "-", t: midA[i++] });
    while (j < n) rows.push({ k: "+", t: midB[j++] });
  } else {
    for (const t of midA) rows.push({ k: "-", t });
    for (const t of midB) rows.push({ k: "+", t });
  }
  const changed = rows.filter((r) => r.k !== " ").length;
  if (!changed) return null;
  // Keep context tight — long unchanged runs collapse to a marker so the
  // preview stays scannable on large files.
  const keep = new Set<number>();
  rows.forEach((r, idx) => {
    if (r.k !== " ")
      for (let k = Math.max(0, idx - 2); k <= Math.min(rows.length - 1, idx + 2); k++)
        keep.add(k);
  });
  const out: (typeof rows[number] | "gap")[] = [];
  rows.forEach((r, idx) => {
    if (keep.has(idx)) out.push(r);
    else if (out[out.length - 1] !== "gap") out.push("gap");
  });
  return (
    <div className="codewrap">
      <pre className="diffview">
        {out.map((r, idx) =>
          r === "gap" ? (
            <div className="dline gap" key={idx}>
              ⋯
            </div>
          ) : (
            <div className={`dline ${r.k === "+" ? "add" : r.k === "-" ? "del" : "ctx"}`} key={idx}>
              <span className="dsign">{r.k}</span>
              <span>{r.t || " "}</span>
            </div>
          ),
        )}
      </pre>
    </div>
  );
}
