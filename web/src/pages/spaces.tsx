import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useT } from "../lib/i18n";
import type { Workspace } from "../lib/types";
import { PageTitle, Shell } from "../components/layout";
import { Empty, ErrorBox, Field, Modal, Spinner } from "../components/ui";
import { Icon } from "../components/icons";

export function SpacesPage() {
  const { t } = useT();
  const { data, error, loading, reload } = useApi<{ workspaces: Workspace[] }>(
    "/workspaces",
  );
  const [creating, setCreating] = useState(false);
  const [err2, setErr2] = useState("");
  const spaces = data?.workspaces;

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    try {
      await api.post("/workspaces", { slug: d.slug, name: d.name || d.slug });
      setCreating(false);
      reload();
    } catch (err) {
      setErr2((err as Error).message);
    }
  }

  return (
    <Shell crumbs={[{ label: t("spaces.title") }]}>
      <PageTitle
        title={t("spaces.title")}
        sub={t("spaces.sub")}
        actions={
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Icon name="plus" /> {t("spaces.new")}
          </button>
        }
      />
      {error && <ErrorBox error={error} onRetry={reload} />}
      {loading && <Spinner />}
      {spaces &&
        (spaces.length === 0 ? (
          <div className="panel">
            <Empty icon="users" title={t("spaces.empty")} body={t("spaces.emptyBody")} />
          </div>
        ) : (
          <div className="panel">
            {spaces.map((w) => (
              <div className="row" key={w.id || w.slug}>
                <span className="avatar">{w.slug?.charAt(0).toUpperCase()}</span>
                <div className="grow">
                  <Link className="rowlink title" to={`/?namespace=${w.slug}`}>
                    {w.name || w.slug}
                  </Link>
                  <div className="meta">
                    <span className="mono">@{w.slug}</span>
                    {w.member_count != null && (
                      <span>{w.member_count} {t("spaces.members")}</span>
                    )}
                  </div>
                </div>
                {w.role && <span className="pill">{w.role}</span>}
              </div>
            ))}
          </div>
        ))}
      {creating && (
        <Modal
          title={t("spaces.new")}
          onClose={() => setCreating(false)}
          actions={
            <>
              <button className="btn" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </button>
              <button className="btn primary" type="submit" form="new-space">
                {t("common.create")}
              </button>
            </>
          }
        >
          <form id="new-space" onSubmit={create}>
            {err2 && <div className="errbox">{err2}</div>}
            <Field label={t("spaces.name")}>
              <input name="name" required autoFocus />
            </Field>
            <Field label={t("spaces.slug")}>
              <input name="slug" required pattern="[a-z0-9][a-z0-9_-]*" />
            </Field>
          </form>
        </Modal>
      )}
    </Shell>
  );
}
