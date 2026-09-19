import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useT, type Locale } from "../lib/i18n";
import { Field } from "../components/ui";
import { Wordmark } from "../components/layout";

function AuthFrame({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useT();
  return (
    <main className="auth">
      <section className="auth-story">
        <Wordmark />
        <div>
          <h1>
            {t("auth.storyTitle").split("\n").map((l, i) => (
              <span key={i}>
                {l}
                <br />
              </span>
            ))}
          </h1>
          <p>{t("auth.storyBody")}</p>
          <div className="lines">
            <span className="prompt">$ </span>git add .<br />
            <span className="prompt">$ </span>git commit -m "a new beginning"
            <br />
            <span className="prompt">$ </span>git push origin main
            <br />
            <span className="prompt">↳</span> vexuni
          </div>
        </div>
        <div className="auth-footer">
          <a href="/source.tar.gz" download>
            {t("auth.footer")} ↓
          </a>
        </div>
      </section>
      <section className="auth-form">
        <div className="auth-lang">
          <select
            aria-label={t("common.language")}
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            <option value="zh-CN">简体中文</option>
            <option value="en">English</option>
          </select>
        </div>
        {children}
      </section>
    </main>
  );
}

export function LoginPage() {
  const { t } = useT();
  const { refresh, setupRequired } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    setBusy(true);
    setError("");
    try {
      if (setupRequired) {
        await api.post("/setup", {
          secret: data.secret,
          username: data.username,
          password: data.password,
        });
      }
      await api.post("/login", {
        username: data.username,
        password: data.password,
        otp: data.otp || undefined,
      });
      await refresh();
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthFrame>
      <form onSubmit={submit}>
        <h2>{setupRequired ? t("auth.setup") : t("auth.welcome")}</h2>
        <p className="muted">
          {setupRequired ? t("auth.setupHint") : t("auth.loginHint")}
        </p>
        {error && <div className="errbox">{error}</div>}
        {setupRequired && (
          <Field label={t("auth.secret")}>
            <input name="secret" type="password" required autoComplete="off" />
          </Field>
        )}
        <Field label={t("auth.username")}>
          <input name="username" required autoComplete="username" autoFocus />
        </Field>
        <Field
          label={t("auth.password")}
          hint={setupRequired ? t("auth.passwordHint") : undefined}
        >
          <input
            name="password"
            type="password"
            required
            autoComplete={setupRequired ? "new-password" : "current-password"}
          />
        </Field>
        {!setupRequired && (
          <Field label={t("auth.otp")} optional>
            <input
              name="otp"
              maxLength={64}
              autoComplete="one-time-code"
              placeholder={t("auth.otpHint")}
            />
          </Field>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {setupRequired ? t("auth.submitSetup") : t("auth.submit")} →
        </button>
        {!setupRequired && (
          <div className="alt">
            <Link to="/recover">{t("auth.forgot")}</Link>
            <Link to="/">{t("auth.browse")} →</Link>
          </div>
        )}
      </form>
    </AuthFrame>
  );
}

export function RecoverPage() {
  const { t } = useT();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api.post("/recover-password", data);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <AuthFrame>
      <form onSubmit={submit}>
        <h2>{t("auth.recover")}</h2>
        <p className="muted">{t("auth.recoverHint")}</p>
        {error && <div className="errbox">{error}</div>}
        {sent ? (
          <div className="notebox">{t("auth.recoverDone")}</div>
        ) : (
          <>
            <Field label={t("auth.username")}>
              <input name="username" required autoFocus />
            </Field>
            <button className="btn primary" type="submit">
              {t("auth.recoverSubmit")} →
            </button>
          </>
        )}
        <div className="alt">
          <Link to="/login">← {t("auth.submit")}</Link>
        </div>
      </form>
    </AuthFrame>
  );
}
