import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { fullDate, shortSha, timeAgo } from "../../lib/format";
import type { Release, Tag } from "../../lib/types";
import { Markdown } from "../../components/markdown";
import {
  Empty,
  ErrorBox,
  Field,
  Modal,
  Pill,
  SkeletonRows,
} from "../../components/ui";
import { Icon } from "../../components/icons";
import { useRepo } from "./layout";

export function ReleasesPage() {
  const { t } = useT();
  const { user } = useAuth();
  const { repo, ns, name, base } = useRepo();
  const { data, error, loading, reload } = useApi<{ releases: Release[] }>(
    repoPath(ns, name) + "/releases",
    [ns, name],
  );
  const { data: tags } = useApi<{ tags: Tag[] }>(
    repoPath(ns, name) + "/tags",
    [ns, name],
  );
  const { data: branches } = useApi<{ branches: { name: string }[] }>(
    repoPath(ns, name) + "/branches",
    [ns, name],
  );
  const [creating, setCreating] = useState(false);
  const [err2, setErr2] = useState("");
  const [busy, setBusy] = useState(false);

  // Release/tag writes are maintainer-gated server-side; a plain "logged in"
  // check would surface a 403 the user could do nothing about.
  const canMaintain = ["maintainer", "owner"].includes(repo.role || "");

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    setBusy(true);
    setErr2("");
    try {
      // Releases hang off tags; GitHub lets the form create one inline, so
      // a filled-in tag name mints it first at the chosen base ref.
      const tag = d.new_tag?.trim() || d.tag;
      if (!tag) throw new Error(t("rel.tagRequired"));
      if (d.new_tag?.trim())
        await api.post(repoPath(ns, name) + "/tags", {
          name: tag,
          ref: d.base || repo.default_branch,
        });
      await api.post(repoPath(ns, name) + "/releases", {
        tag,
        title: d.title,
        body: d.body || "",
        prerelease: d.prerelease === "on",
      });
      setCreating(false);
      reload();
    } catch (err) {
      setErr2((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t("rel.deleteConfirm"))) return;
    await api.del(repoPath(ns, name) + "/releases/" + id);
    reload();
  }

  const releases = data?.releases;
  return (
    <>
      <div className="toolbar">
        <span className="mark-read" />
        {user && canMaintain && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> {t("rel.new")}
          </button>
        )}
      </div>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <SkeletonRows />}
      {releases &&
        (releases.length === 0 ? (
          <div className="panel">
            <Empty
              icon="release"
              title={t("rel.empty")}
              body={t("rel.emptyBody")}
              action={
                user && canMaintain ? (
                  <button className="btn primary" onClick={() => setCreating(true)}>
                    {t("rel.first")}
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          releases.map((r) => (
            <div className="panel release" key={r.id}>
              <div className="panelpad">
                <div className="rowmeta">
                  <Link
                    className="mono chip-link"
                    to={`${base}?ref=${encodeURIComponent(r.tag)}`}
                  >
                    <Icon name="tag" size={13} /> {r.tag}
                  </Link>
                  {!!r.prerelease && <Pill tone="yellow">{t("rel.pre")}</Pill>}
                  <span className="mark-read faint small">
                    {r.author} · {timeAgo(r.created_at)}
                  </span>
                  {user && canMaintain && (
                    <button
                      className="copy-btn"
                      title={t("common.delete")}
                      onClick={() => remove(r.id)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </div>
                <h2 className="serif fs-md">{r.title}</h2>
                {r.body ? (
                  <Markdown text={r.body} />
                ) : (
                  <p className="faint small">{t("issues.noBody")}</p>
                )}
              </div>
              <div className="release-foot mono small faint">
                {r.sha && <span>{shortSha(r.sha)}</span>}
                {r.created_at && <span>{fullDate(r.created_at)}</span>}
              </div>
            </div>
          ))
        ))}
      {creating && (
        <Modal
          title={t("rel.new")}
          onClose={() => setCreating(false)}
          actions={
            <>
              <button className="btn" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </button>
              <button className="btn primary" form="new-release" type="submit" disabled={busy}>
                {t("common.create")}
              </button>
            </>
          }
        >
          <form id="new-release" onSubmit={create}>
            {err2 && <div className="errbox">{err2}</div>}
            {(tags?.tags.length ?? 0) > 0 && (
              <Field label={t("rel.pickTag")}>
                <select name="tag">
                  {tags!.tags.map((tg) => (
                    <option key={tg.name} value={tg.name}>
                      {tg.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={t("rel.newTagName")} optional hint={t("rel.newTagHint")}>
              <input name="new_tag" pattern="[^\s]+" placeholder="v1.0.0" />
            </Field>
            <Field label={t("rel.base")} optional>
              <select name="base" defaultValue={repo.default_branch}>
                {branches?.branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("issues.title")}>
              <input name="title" required autoFocus placeholder="v1.0.0" />
            </Field>
            <Field label={t("issues.body")} optional hint={t("issues.bodyPh")}>
              <textarea name="body" />
            </Field>
            <label className="check">
              <input type="checkbox" name="prerelease" /> {t("rel.pre")}
            </label>
          </form>
        </Modal>
      )}
    </>
  );
}
