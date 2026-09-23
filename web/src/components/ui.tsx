import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useT } from "../lib/i18n";
import { Icon } from "./icons";
import { useToast } from "./toast";

export function Spinner() {
  const { t } = useT();
  return (
    <div className="spinner" role="status" aria-label={t("common.loading")} />
  );
}

/** Content-shaped placeholder while a list loads — kinder than a bare spinner. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`sk ${className}`} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  const { t } = useT();
  return (
    <div className="panel" role="status" aria-label={t("common.loading")}>
      <div className="panelhead">
        <Skeleton className="sk-w-140" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div className="sk-row" key={i}>
          <Skeleton className="sk-ic" />
          <div className="grow">
            <Skeleton className={i % 3 === 1 ? "sk-w-60" : "sk-w-40"} />
            <Skeleton className={i % 2 ? "sk-w-30" : "sk-w-50"} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div className="errbox" role="alert">
      <Icon name="alert" size={15} />
      <span>
        <strong>{t("err.load")}:</strong> {error.message}
      </span>
      {onRetry && (
        <button className="btn small" onClick={onRetry}>
          {t("err.retry")}
        </button>
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

const AV_HUES = 8;

export function Avatar({ name }: { name?: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  let hash = 0;
  for (const ch of name || "") hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={`avatar av-${hash % AV_HUES}`} aria-hidden="true">
      {initial}
    </span>
  );
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
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <button
      className={`copy-btn${done ? " ok" : ""}`}
      title={done ? t("common.copied") : t("common.copy")}
      aria-label={t("common.copy")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          toast(t("err.load"), "err");
          return;
        }
        setDone(true);
        toast(t("common.copied"));
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
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Initial focus: first form control, else the dialog itself for Esc focus.
    const first = ref.current?.querySelector<HTMLElement>(
      "input, textarea, select, button:not([data-nofocus])",
    );
    (first || ref.current)?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-veil" onClick={onClose} role="presentation">
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button
            className="btn text icon-btn"
            data-nofocus
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <Icon name="x" size={15} />
          </button>
        </div>
        {children}
        <div className="actions">{actions}</div>
      </div>
    </div>
  );
}

function BoundaryFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { t } = useT();
  return (
    <div className="panel">
      <Empty
        icon="alert"
        title={t("err.boundary")}
        body={error.message || t("err.boundaryBody")}
        action={
          <button className="btn" onClick={onReset}>
            {t("err.retry")}
          </button>
        }
      />
    </div>
  );
}

/** Render crash barrier: without it a single bad page unmounts the whole
 *  SPA and strands the user on a blank screen. The boundary keeps the shell
 *  alive and offers a retry; keying it by route lets navigation recover. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (error)
      return (
        <BoundaryFallback
          error={error}
          onReset={() => this.setState({ error: null })}
        />
      );
    return this.props.children;
  }
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
