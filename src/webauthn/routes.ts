import { z } from "zod";
import type { Context, Hono } from "hono";
import { setCookie } from "hono/cookie";
import type { App, Env, User } from "../types";
import {
  digest,
  fail,
  passwordHash,
  randomToken,
  slug,
} from "../security";
import { securityLimit } from "../account";
import { jsonInput } from "../workspaces";
import { b64u, unb64u, type StoredKey } from "./cose";
import {
  verifyAssertion,
  verifyRegistration,
  type RelyingParty,
} from "./protocol";

const TTL = 600000; // challenges live for ten minutes
const PUBKEY_PARAMS = [
  { type: "public-key", alg: -7 }, // ES256
  { type: "public-key", alg: -8 }, // EdDSA
  { type: "public-key", alg: -257 }, // RS256
  { type: "public-key", alg: -35 }, // ES384
];

export function relyingParty(env: Env): RelyingParty {
  let host = "localhost";
  try {
    host = new URL(env.APP_ORIGIN).hostname;
  } catch {
    /* fall through */
  }
  const origins = [env.APP_ORIGIN];
  if (env.LEGACY_APP_ORIGIN) origins.push(env.LEGACY_APP_ORIGIN);
  if (env.WEBAUTHN_ORIGINS)
    origins.push(
      ...env.WEBAUTHN_ORIGINS.split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  return {
    id: env.WEBAUTHN_RP_ID || host.replace(/^www\./, ""),
    name: "vexuni",
    origins,
  };
}

interface CredentialRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  alg: number;
  sign_count: number;
  transports: string;
  name: string;
  aaguid: string;
  user_handle: string;
  last_used_at: number | null;
  created_at: string;
}

const attestationResponse = z.object({
  clientDataJSON: z.string().min(1).max(8192),
  attestationObject: z.string().min(1).max(65536),
  transports: z.array(z.string().max(32)).max(16).default([]),
});
const assertionBody = z.object({
  credential: z.object({
    id: z.string().min(1).max(2048),
    response: z.object({
      clientDataJSON: z.string().min(1).max(8192),
      authenticatorData: z.string().min(1).max(8192),
      signature: z.string().min(1).max(16384),
      userHandle: z.string().max(2048).nullish(),
    }),
  }),
});

function challengeOf(clientDataJSON: string): string {
  try {
    const data = JSON.parse(
      new TextDecoder().decode(unb64u(clientDataJSON)),
    ) as { challenge?: string };
    return data.challenge || "";
  } catch {
    return "";
  }
}

async function consumeChallenge(
  env: Env,
  flow: string,
  challenge: string,
) {
  return env.DB.prepare(
    "DELETE FROM webauthn_challenges WHERE challenge=? AND flow=? AND expires_at>? RETURNING user_id,payload",
  )
    .bind(challenge, flow, Date.now())
    .first<{ user_id: string | null; payload: string }>();
}

async function issueSession(c: Context<App>, userId: string) {
  const token = randomToken(),
    now = Date.now();
  await c.env.DB.prepare(
    "INSERT INTO credentials(hash,id,user_id,name,kind,expires_at,auth_method,authenticated_at) VALUES(?,?,?,'Browser session','session',?,'webauthn',?)",
  )
    .bind(await digest(token), crypto.randomUUID(), userId, now + 7 * 86400000, now)
    .run();
  setCookie(c, "vexuni_session", token, {
    httpOnly: true,
    secure: c.env.APP_ORIGIN.startsWith("https:"),
    sameSite: "Strict",
    path: "/",
    maxAge: 7 * 86400,
  });
}

export function registerWebAuthn(app: Hono<App>) {
  const session = (c: Context<App>) => {
    if (c.get("kind") !== "session" || !c.get("user"))
      fail(403, "Browser session required");
    return c.get("user")!;
  };
  const throttle = async (c: Context<App>, scope: string) =>
    securityLimit(
      c.env,
      `webauthn:${scope}:${c.req.header("cf-connecting-ip") || "local"}`,
    );

  // ---- registration: passkey first, username second ----
  app.post("/api/webauthn/register/options", async (c) => {
    await throttle(c, "register-options");
    const rp = relyingParty(c.env),
      challenge = b64u(crypto.getRandomValues(new Uint8Array(32))),
      handle = b64u(crypto.getRandomValues(new Uint8Array(32)));
    await c.env.DB.prepare(
      "INSERT INTO webauthn_challenges(challenge,flow,payload,expires_at) VALUES(?,'register',?,?)",
    )
      .bind(challenge, handle, Date.now() + TTL)
      .run();
    return c.json({
      challenge,
      rp: { name: rp.name, id: rp.id },
      user: {
        id: handle,
        name: "vexuni-" + handle.slice(0, 10),
        displayName: "new vexuni user",
      },
      pubKeyCredParams: PUBKEY_PARAMS,
      timeout: TTL,
      attestation: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
    });
  });

  app.post("/api/webauthn/register/verify", async (c) => {
    await throttle(c, "register");
    const b = z
      .object({ username: slug, response: attestationResponse })
      .parse(await jsonInput(c));
    const rp = relyingParty(c.env);
    const pending = await consumeChallenge(
      c.env,
      "register",
      challengeOf(b.response.clientDataJSON),
    );
    if (!pending) fail(401, "Registration ceremony expired; start again");
    let verified;
    try {
      verified = await verifyRegistration(
        unb64u(b.response.attestationObject),
        unb64u(b.response.clientDataJSON),
        challengeOf(b.response.clientDataJSON),
        rp,
      );
    } catch (e) {
      fail(401, "Passkey verification failed: " + (e as Error).message);
    }
    const userId = crypto.randomUUID(),
      credentialId = crypto.randomUUID(),
      token = randomToken(),
      now = Date.now();
    if (
      await c.env.DB.prepare("SELECT 1 FROM users WHERE username=?")
        .bind(b.username.toLowerCase())
        .first()
    )
      fail(409, "Username already taken");
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(
          "INSERT INTO users(id,username,password,has_password) VALUES(?,?,?,0)",
        ).bind(
          userId,
          b.username.toLowerCase(),
          await passwordHash(randomToken() + randomToken()),
        ),
        c.env.DB.prepare(
          "INSERT INTO webauthn_credentials(id,user_id,credential_id,public_key,alg,sign_count,transports,name,aaguid,user_handle) VALUES(?,?,?,?,?,?,?,?,?,?)",
        ).bind(
          credentialId,
          userId,
          verified.credentialId,
          JSON.stringify(verified.key.jwk),
          verified.key.alg,
          verified.signCount,
          b.response.transports.join(","),
          "Passkey",
          verified.aaguid,
          pending.payload,
        ),
        c.env.DB.prepare(
          "INSERT INTO credentials(hash,id,user_id,name,kind,expires_at,auth_method,authenticated_at) VALUES(?,?,?,'Browser session','session',?,'webauthn',?)",
        ).bind(
          await digest(token),
          crypto.randomUUID(),
          userId,
          now + 7 * 86400000,
          now,
        ),
      ]);
    } catch {
      if (
        await c.env.DB.prepare("SELECT 1 FROM users WHERE username=?")
          .bind(b.username.toLowerCase())
          .first()
      )
        fail(409, "Username already taken");
      fail(409, "This passkey is already registered to an account");
    }
    setCookie(c, "vexuni_session", token, {
      httpOnly: true,
      secure: c.env.APP_ORIGIN.startsWith("https:"),
      sameSite: "Strict",
      path: "/",
      maxAge: 7 * 86400,
    });
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        "DELETE FROM webauthn_challenges WHERE expires_at<?",
      )
        .bind(now)
        .run(),
    );
    return c.json({ id: userId, username: b.username.toLowerCase() }, 201);
  });

  // ---- passkey sign-in ----
  app.post("/api/webauthn/login/options", async (c) => {
    await throttle(c, "login-options");
    const b = z
      .object({ username: z.string().max(48).default("") })
      .parse(await jsonInput(c));
    const rp = relyingParty(c.env),
      challenge = b64u(crypto.getRandomValues(new Uint8Array(32)));
    let allow: { type: "public-key"; id: string; transports?: string[] }[] = [];
    if (b.username) {
      const rows = await c.env.DB.prepare(
        "SELECT w.credential_id,w.transports FROM webauthn_credentials w JOIN users u ON u.id=w.user_id WHERE u.username=? AND u.disabled=0",
      )
        .bind(b.username.toLowerCase())
        .all<{ credential_id: string; transports: string }>();
      allow = rows.results.map((r) => ({
        type: "public-key" as const,
        id: r.credential_id,
        transports: r.transports ? r.transports.split(",") : undefined,
      }));
    }
    await c.env.DB.prepare(
      "INSERT INTO webauthn_challenges(challenge,flow,expires_at) VALUES(?,'login',?)",
    )
      .bind(challenge, Date.now() + TTL)
      .run();
    return c.json({
      challenge,
      rpId: rp.id,
      timeout: TTL,
      userVerification: "preferred",
      allowCredentials: allow,
    });
  });

  app.post("/api/webauthn/login/verify", async (c) => {
    await throttle(c, "login");
    const b = assertionBody.parse(await jsonInput(c));
    const row = await c.env.DB.prepare(
      "SELECT w.*,u.username,u.admin,u.disabled,u.auth_epoch FROM webauthn_credentials w JOIN users u ON u.id=w.user_id WHERE w.credential_id=?",
    )
      .bind(b.credential.id)
      .first<
        CredentialRow & {
          username: string;
          admin: number;
          disabled: number;
          auth_epoch: number;
        }
      >();
    if (!row || row.disabled) fail(401, "Unknown passkey");
    const pending = await consumeChallenge(
      c.env,
      "login",
      challengeOf(b.credential.response.clientDataJSON),
    );
    if (!pending) fail(401, "Sign-in ceremony expired; start again");
    let result;
    try {
      result = await verifyAssertion(
        {
          authenticatorData: unb64u(b.credential.response.authenticatorData),
          clientDataJSON: unb64u(b.credential.response.clientDataJSON),
          signature: unb64u(b.credential.response.signature),
          userHandle: b.credential.response.userHandle
            ? unb64u(b.credential.response.userHandle)
            : null,
        },
        challengeOf(b.credential.response.clientDataJSON),
        relyingParty(c.env),
        { jwk: JSON.parse(row.public_key), alg: row.alg } as StoredKey,
        row.sign_count,
        row.user_handle,
      );
    } catch (e) {
      fail(401, "Passkey verification failed: " + (e as Error).message);
    }
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare(
        "UPDATE webauthn_credentials SET sign_count=?,last_used_at=? WHERE id=?",
      ).bind(result!.signCount, now, row.id),
      c.env.DB.prepare(
        "DELETE FROM webauthn_challenges WHERE expires_at<?",
      ).bind(now),
    ]);
    await issueSession(c, row.user_id);
    return c.json({
      id: row.user_id,
      username: row.username,
      admin: row.admin,
    });
  });

  // ---- manage passkeys on a signed-in account ----
  app.get("/api/webauthn/credentials", async (c) => {
    const u = session(c);
    return c.json({
      credentials: (
        await c.env.DB.prepare(
          "SELECT id,name,transports,aaguid,sign_count,last_used_at,created_at FROM webauthn_credentials WHERE user_id=? ORDER BY created_at,id",
        )
          .bind(u.id)
          .all()
      ).results,
    });
  });

  app.post("/api/webauthn/manage/options", async (c) => {
    const u = session(c);
    const rp = relyingParty(c.env),
      challenge = b64u(crypto.getRandomValues(new Uint8Array(32)));
    const existing = await c.env.DB.prepare(
      "SELECT credential_id,transports,user_handle FROM webauthn_credentials WHERE user_id=?",
    )
      .bind(u.id)
      .all<{
        credential_id: string;
        transports: string;
        user_handle: string;
      }>();
    const handle =
      existing.results[0]?.user_handle ||
      b64u(crypto.getRandomValues(new Uint8Array(32)));
    await c.env.DB.prepare(
      "INSERT INTO webauthn_challenges(challenge,flow,user_id,payload,expires_at) VALUES(?,'manage',?,?,?)",
    )
      .bind(challenge, u.id, handle, Date.now() + TTL)
      .run();
    return c.json({
      challenge,
      rp: { name: rp.name, id: rp.id },
      user: { id: handle, name: u.username, displayName: u.username },
      pubKeyCredParams: PUBKEY_PARAMS,
      timeout: TTL,
      attestation: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      excludeCredentials: existing.results.map((r) => ({
        type: "public-key" as const,
        id: r.credential_id,
        transports: r.transports ? r.transports.split(",") : undefined,
      })),
    });
  });

  app.post("/api/webauthn/manage/verify", async (c) => {
    const u = session(c);
    const b = z
      .object({
        name: z.string().trim().min(1).max(60).default("Passkey"),
        response: attestationResponse,
      })
      .parse(await jsonInput(c));
    const count = await c.env.DB.prepare(
      "SELECT count(*) AS n FROM webauthn_credentials WHERE user_id=?",
    )
      .bind(u.id)
      .first<{ n: number }>();
    if ((count?.n || 0) >= 10) fail(400, "Maximum 10 passkeys per account");
    const pending = await consumeChallenge(
      c.env,
      "manage",
      challengeOf(b.response.clientDataJSON),
    );
    if (!pending || pending.user_id !== u.id)
      fail(401, "Ceremony expired; start again");
    let verified;
    try {
      verified = await verifyRegistration(
        unb64u(b.response.attestationObject),
        unb64u(b.response.clientDataJSON),
        challengeOf(b.response.clientDataJSON),
        relyingParty(c.env),
      );
    } catch (e) {
      fail(401, "Passkey verification failed: " + (e as Error).message);
    }
    const id = crypto.randomUUID();
    try {
      const live = `EXISTS(SELECT 1 FROM credentials c JOIN users u ON u.id=c.user_id WHERE c.hash=? AND c.user_id=? AND c.kind='session' AND c.expires_at>? AND u.disabled=0)`;
      const result = await c.env.DB.prepare(
        `INSERT INTO webauthn_credentials(id,user_id,credential_id,public_key,alg,sign_count,transports,name,aaguid,user_handle) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${live}`,
      )
        .bind(
          id,
          u.id,
          verified.credentialId,
          JSON.stringify(verified.key.jwk),
          verified.key.alg,
          verified.signCount,
          b.response.transports.join(","),
          b.name,
          verified.aaguid,
          pending.payload,
          c.get("credential"),
          u.id,
          Date.now(),
        )
        .run();
      if (!result.meta.changes) fail(403, "Session changed; sign in again");
    } catch (e) {
      if (e && typeof e === "object" && "status" in e) throw e;
      fail(409, "This passkey is already registered");
    }
    return c.json({ id, name: b.name }, 201);
  });

  app.patch("/api/webauthn/credentials/:id", async (c) => {
    const u = session(c),
      b = z
        .object({ name: z.string().trim().min(1).max(60) })
        .parse(await jsonInput(c));
    const result = await c.env.DB.prepare(
      "UPDATE webauthn_credentials SET name=? WHERE id=? AND user_id=?",
    )
      .bind(b.name, c.req.param("id"), u.id)
      .run();
    if (!result.meta.changes) fail(404, "Passkey not found");
    return c.json({ ok: true });
  });

  app.delete("/api/webauthn/credentials/:id", async (c) => {
    const u = session(c),
      id = c.req.param("id");
    // Never orphan an account: require another sign-in method to remain.
    const result = await c.env.DB.prepare(
      `DELETE FROM webauthn_credentials WHERE id=? AND user_id=? AND (
        (SELECT count(*) FROM webauthn_credentials w WHERE w.user_id=? AND w.id!=?)>0
        OR EXISTS(SELECT 1 FROM users u WHERE u.id=? AND u.has_password=1)
        OR EXISTS(SELECT 1 FROM oidc_identities i JOIN oidc_providers p ON p.id=i.provider_id WHERE i.user_id=? AND p.enabled=1)
      ) RETURNING id`,
    )
      .bind(id, u.id, u.id, id, u.id, u.id)
      .first();
    if (!result) {
      if (
        await c.env.DB.prepare(
          "SELECT 1 FROM webauthn_credentials WHERE id=? AND user_id=?",
        )
          .bind(id, u.id)
          .first()
      )
        fail(409, "Keep at least one way to sign in");
      fail(404, "Passkey not found");
    }
    return c.json({ deleted: true });
  });
}
