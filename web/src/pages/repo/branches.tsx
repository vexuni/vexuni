import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { shortSha } from "../../lib/format";
import type { Branch, Tag } from "../../lib/types";
import {
  Chip,
  Empty,
  ErrorBox,
  Field,
  Modal,
  Pill,
  SkeletonRows,
} from "../../components/ui";
import { Icon } from "../../components/icons";
import { useRepo } from "./layout";

export function BranchesPage() {
  const { t } = useT();
  const { repo, ns, name, base } = useRepo();
  const { data, error, loading, reload } = useApi<{ branches: Branch[] }>(
    repoPath(ns, name) + "/branches",
    [ns, name],
  );
  const [creating, setCreating] = useState(false);
  const [error2, setError2] = useState("");

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    try {
      await api.post(repoPath(ns, name) + "/branches/create", {
        target_branch: d.name,
        base_branch: d.base || repo.default_branch,
      });
      setCreating(false);
      reload();
    } catch (err) {
      setError2((err as Error).message);
    }
  }

  async function remove(branch: string) {
    if (!confirm(t("branches.deleteConfirm"))) return;
    await api.del(repoPath(ns, name) + "/branches", { branch });
    reload();
  }

  return (
    <>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <SkeletonRows />}
      {data && (
        <div className="panel">
          <div className="panelhead">
            <strong>{t("branches.title")}</strong>
            <button className="btn small" onClick={() => setCreating(true)}>
              <Icon name="plus" /> {t("branches.new")}
            </button>
          </div>
          {data.branches.map((b) => (
            <div className="row" key={b.name}>
              <Icon name="branch" />
              <div className="grow">
                <Link
                  className="rowlink title mono"
                  to={`${base}?ref=${encodeURIComponent(b.name)}`}
                >
                  {b.name}
                </Link>
                {b.name === repo.default_branch && (
                  <Pill tone="green">{t("branches.default")}</Pill>
                )}
              </div>
              <Chip>{shortSha(b.sha)}</Chip>
              {b.name !== repo.default_branch && (
                <button
                  className="copy-btn"
                  title={t("common.delete")}
                  onClick={() => remove(b.name)}
                >
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {creating && (
        <Modal
          title={t("branches.new")}
          onClose={() => setCreating(false)}
          actions={
            <>
              <button className="btn" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </button>
              <button className="btn primary" form="new-branch" type="submit">
                {t("common.create")}
              </button>
            </>
          }
        >
          <form id="new-branch" onSubmit={create}>
            {error2 && <div className="errbox">{error2}</div>}
            <Field label={t("branches.title")}>
              <input name="name" required autoFocus placeholder="feature/…" />
            </Field>
            <Field label={t("branches.from")}>
              <select name="base" defaultValue={repo.default_branch}>
                {data?.branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

export function TagsPage() {
  const { t } = useT();
  const { ns, name, base } = useRepo();
  const { data, error, loading, reload } = useApi<{ tags: Tag[] }>(
    repoPath(ns, name) + "/tags",
    [ns, name],
  );
  const [creating, setCreating] = useState(false);
  const [error2, setError2] = useState("");

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    try {
      await api.post(repoPath(ns, name) + "/tags", { name: d.name });
      setCreating(false);
      reload();
    } catch (err) {
      setError2((err as Error).message);
    }
  }

  async function remove(tag: string) {
    if (!confirm(t("tags.deleteConfirm"))) return;
    await api.del(
      repoPath(ns, name) + "/tags/" + encodeURIComponent(tag),
    );
    reload();
  }

  const tags = data?.tags || [];
  return (
    <>
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <SkeletonRows />}
      {data && (
        <div className="panel">
          <div className="panelhead">
            <strong>{t("tags.title")}</strong>
            <button className="btn small" onClick={() => setCreating(true)}>
              <Icon name="plus" /> {t("tags.new")}
            </button>
          </div>
          {tags.length === 0 && <Empty icon="tag" title={t("common.empty")} />}
          {tags.map((tag) => (
            <div className="row" key={tag.name}>
              <Icon name="tag" />
              <Link className="rowlink title mono grow" to={`${base}?ref=${encodeURIComponent(tag.name)}`}>
                {tag.name}
              </Link>
              <Chip>{shortSha(tag.sha)}</Chip>
              <button
                className="copy-btn"
                title={t("common.delete")}
                onClick={() => remove(tag.name)}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {creating && (
        <Modal
          title={t("tags.new")}
          onClose={() => setCreating(false)}
          actions={
            <>
              <button className="btn" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </button>
              <button className="btn primary" form="new-tag" type="submit">
                {t("common.create")}
              </button>
            </>
          }
        >
          <form id="new-tag" onSubmit={create}>
            {error2 && <div className="errbox">{error2}</div>}
            <Field label={t("tags.title")}>
              <input name="name" required autoFocus placeholder="v1.0.0" />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
