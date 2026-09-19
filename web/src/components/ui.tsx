import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useT } from "../lib/i18n";
import { Icon } from "./icons";

export function Spinner() {
  const { t } = useT();
  return (
    <div className="spinner" role="status" aria-label={t("common.loading")} />
  );
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div className="errbox" role="alert">
      <strong>{t("err.load")}:</strong> {error.message}
      {onRetry && (
        <>
          {" "}
          <button className="btn small" onClick={onRetry}>
            {t("err.retry")}
          </button>
        </>
      )}
    </div>
  );
}

export function Empty({
  icon = "repo",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div>
        <Icon name={icon} size={30} />
      </div>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function Pill({ tone, children }: { tone?: string; children: ReactNode }) {
  return <span className={`pill${tone ? " " + tone : ""}`}>{children}</span>;
}

export function Dot({ tone }: { tone?: string }) {
  return <i className={`dot${tone ? " " + tone : ""}`} aria-hidden="true" />;
}

export function Avatar({ name }: { name?: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return <span className="avatar" aria-hidden="true">{initial}</span>;
}

export function Chip({ children }: { children: ReactNode }) {
  return <code className="chip">{children}</code>;
}

export function Pager({
  page,
  hasNext,
  make,
}: {
  page: number;
  hasNext: boolean;
  make: (page: number) => string;
}) {
  const { t } = useT();
  return (
    <div className="pager">
      {page > 0 ? (
        <Link className="btn small" to={make(page - 1)}>
          ← {t("common.prev")}
        </Link>
      ) : (
        <span />
      )}
      {hasNext ? (
        <Link className="btn small" to={make(page + 1)}>
          {t("common.next")} →
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      className="copy-btn"
      title={done ? t("common.copied") : t("common.copy")}
      aria-label={t("common.copy")}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      <Icon name={done ? "check" : "copy"} size={14} />
    </button>
  );
}

export function Field({
  label,
  hint,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const { t } = useT();
  return (
    <div className="field">
      <label>
        {label}
        {optional && <span className="optional"> · {t("common.optional")}</span>}
      </label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  actions,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="modal-veil" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        {children}
        <div className="actions">{actions}</div>
      </div>
    </div>
  );
}

/** Status pill with semantic tone for issues / merges / CI runs. */
export function StatePill({ state }: { state?: string }) {
  const { t } = useT();
  const map: Record<string, [string, string]> = {
    open: ["green", t("common.open")],
    closed: ["", t("common.closed")],
    merged: ["violet", t("common.merged")],
    success: ["green", "success"],
    failure: ["red", "failure"],
    failed: ["red", "failure"],
    running: ["blue", "running"],
    queued: ["yellow", "queued"],
    cancelled: ["", "cancelled"],
  };
  const [tone, label] = map[state || ""] || ["", state || "—"];
  return <Pill tone={tone}>{label}</Pill>;
}
