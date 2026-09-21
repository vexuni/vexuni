import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, repoPath } from "../../lib/api";
import { useApi } from "../../lib/hooks";
import { useT } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import type { Member, Webhook } from "../../lib/types";
import {
  Avatar,
  ErrorBox,
  Field,
  Modal,
  SkeletonRows,
} from "../../components/ui";
import { Icon } from "../../components/icons";
import { useToast } from "../../components/toast";
import { useRepo } from "./layout";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panelhead">
        <strong>{title}</strong>
      </div>
      <div className="panelpad">{children}</div>
    </div>
  );
}

export function RepoSettingsPage() {
  const { t } = useT();
  const { repo, ns, name } = useRepo();
  const { user } = useAuth();
  const navigate = useNavigate();
  const members = useApi<{ members: Member[] }>(
    repoPath(ns, name) + "/members",
    [ns, name],
  );
  const webhooks = useApi<{ webhooks: Webhook[] }>(
    repoPath(ns, name) + "/webhooks",
    [ns, name],
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const [confirming, setConfirming] = useState<"delete" | null>(null);

  async function saveGeneral(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    try {
      await api.patch(repoPath(ns, name), {
        description: d.description,
        visibility: d.visibility,
        default_branch: d.default_branch,
      });
      setSaved(true);
      toast(t("common.saved"));
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
      toast((err as Error).message, "err");
    }
  }

  async function addMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    try {
      await api.put(repoPath(ns, name) + "/members", {
        username: d.username,
        role: d.role || "write",
      });
      (e.target as HTMLFormElement).reset();
      members.reload();
      toast(t("common.saved"));
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  async function addWebhook(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    try {
      await api.post(repoPath(ns, name) + "/webhooks", {
        url: d.url,
        events: d.events ? d.events.split(",").map((s) => s.trim()) : ["*"],
      });
      (e.target as HTMLFormElement).reset();
      webhooks.reload();
      toast(t("common.saved"));
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  async function archive() {
    await api.put(repoPath(ns, name) + "/lifecycle", {
      archived: !repo.archived_at,
    });
    location.reload();
  }

  async function destroy() {
    await api.del(repoPath(ns, name));
    navigate("/");
  }

  if (!user) return <ErrorBox error={new Error("401")} />;

  return (
    <div className="stack">
      {error && <div className="errbox">{error}</div>}
      <Section title={t("settings.general")}>
        <form onSubmit={saveGeneral}>
          <Field label={t("settings.desc")} optional>
            <input name="description" defaultValue={repo.description} />
          </Field>
          <div className="form-row">
            <Field label={t("settings.visibility")}>
              <select name="visibility" defaultValue={repo.visibility}>
                <option value="public">{t("common.public")}</option>
                <option value="private">{t("common.private")}</option>
              </select>
            </Field>
            <Field label={t("settings.branch")}>
              <input name="default_branch" defaultValue={repo.default_branch} />
            </Field>
          </div>
          <button className="btn primary" type="submit">
            {saved ? t("settings.saved") : t("common.save")}
          </button>
        </form>
      </Section>

      <Section title={t("settings.members")}>
        {members.loading && <SkeletonRows rows={3} />}
        {members.data?.members?.map((m) => (
          <div className="row row-flush" key={m.username}>
            <Avatar name={m.username} />
            <span className="grow">{m.username}</span>
            <span className="faint small">{m.role}</span>
            <button
              className="copy-btn"
              title={t("common.delete")}
              onClick={async () => {
                try {
                  await api.del(
                    repoPath(ns, name) +
                      "/members/" +
                      encodeURIComponent(m.username),
                  );
                  members.reload();
                } catch (err) {
                  toast((err as Error).message, "err");
                }
              }}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
        <form onSubmit={addMember} className="form-row mt">
          <input name="username" placeholder={t("settings.memberPh")} required />
          <select name="role" defaultValue="write">
            <option value="read">read</option>
            <option value="write">write</option>
            <option value="maintain">maintain</option>
          </select>
          <button className="btn" type="submit">
            {t("settings.memberAdd")}
          </button>
        </form>
      </Section>

      <Section title={t("settings.webhooks")}>
        {webhooks.data?.webhooks?.map((w) => (
          <div className="row row-flush" key={w.id}>
            <Icon name="send" />
            <span className="grow mono small">{w.url}</span>
            <span className="faint small">{w.events?.join(", ")}</span>
            <button
              className="copy-btn"
              title={t("common.delete")}
              onClick={async () => {
                try {
                  await api.del(repoPath(ns, name) + "/webhooks/" + w.id);
                  webhooks.reload();
                } catch (err) {
                  toast((err as Error).message, "err");
                }
              }}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
        {webhooks.data && webhooks.data.webhooks.length === 0 && (
          <p className="faint small">{t("common.empty")}</p>
        )}
        <form onSubmit={addWebhook} className="mt">
          <Field label={t("settings.hookUrl")}>
            <input name="url" type="url" required placeholder="https://…" />
          </Field>
          <Field label={t("settings.hookEvents")} optional>
            <input name="events" placeholder="*" />
          </Field>
          <button className="btn" type="submit">
            {t("settings.hookAdd")}
          </button>
        </form>
      </Section>

      <Section title={t("settings.danger")}>
        <div className="stack">
          <div className="row row-flush">
            <div className="grow">
              <div className="title">{t("settings.archive")}</div>
            </div>
            <button className="btn danger" onClick={archive}>
              {repo.archived_at ? t("settings.unarchive") : t("settings.archiveBtn")}
            </button>
          </div>
          <div className="row row-flush">
            <div className="grow">
              <div className="title">{t("settings.deleteRepo")}</div>
              <div className="meta">{t("settings.deleteHint")}</div>
            </div>
            <button className="btn danger" onClick={() => setConfirming("delete")}>
              {t("common.delete")}
            </button>
          </div>
        </div>
      </Section>

      {confirming === "delete" && (
        <Modal
          title={t("settings.deleteRepo")}
          onClose={() => setConfirming(null)}
          actions={
            <>
              <button className="btn" onClick={() => setConfirming(null)}>
                {t("common.cancel")}
              </button>
              <button className="btn danger" onClick={destroy}>
                {t("common.delete")}
              </button>
            </>
          }
        >
          <p className="muted">{t("settings.deleteConfirm")}</p>
        </Modal>
      )}
    </div>
  );
}
