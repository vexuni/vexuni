import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import app from "../src/app";
import { digest } from "../src/security";
import { encode, type CborValue } from "../src/webauthn/cbor";
import { b64u, unb64u } from "../src/webauthn/cose";
import type { Env } from "../src/types";

/* A software authenticator: real P-256 keys, real signatures, real
 * authenticatorData — exercises the whole verification chain. */
const ORIGIN = "http://localhost";
const RP_ID = "localhost";

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
};
const u16 = (n: number) => new Uint8Array([n >> 8, n & 0xff]);
const sha256 = async (b: Uint8Array) =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", b as BufferSource),
  );

/** raw r‖s (WebCrypto) → DER (what authenticators emit). */
function rawToDer(raw: Uint8Array): Uint8Array {
  const size = raw.length / 2;
  const ints = [raw.slice(0, size), raw.slice(size)].map((v) => {
    let i = 0;
    while (i < v.length - 1 && v[i] === 0 && !(v[i + 1] & 0x80)) i++;
    let bytes = v.slice(i);
    if (bytes[0] & 0x80)
      bytes = concat(new Uint8Array([0]), bytes);
    return concat(new Uint8Array([2, bytes.length]), bytes);
  });
  const body = concat(...ints);
  return concat(new Uint8Array([0x30, body.length]), body);
}

class Authenticator {
  privateKey!: CryptoKey;
  publicJwk!: JsonWebKey;
  credentialId = crypto.getRandomValues(new Uint8Array(24));
  count = 0;
  async init() {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign"],
    );
    this.privateKey = pair.privateKey;
    this.publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    return this;
  }
  coseKey() {
    return encode(
      new Map<CborValue, CborValue>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, unb64u(this.publicJwk.x!)],
        [-3, unb64u(this.publicJwk.y!)],
      ]),
    );
  }
  async authData(flags: number, rpId = RP_ID) {
    this.count += 1;
    const head = concat(
      await sha256(new TextEncoder().encode(rpId)),
      new Uint8Array([flags]),
      u32(this.count),
    );
    if (!(flags & 0x40)) return head;
    const cred = concat(
      new Uint8Array(16), // AAGUID zero
      u16(this.credentialId.length),
      this.credentialId,
      this.coseKey(),
    );
    return concat(head, cred);
  }
  clientData(type: string, challenge: string, origin = ORIGIN) {
    return new TextEncoder().encode(
      JSON.stringify({ type, challenge, origin }),
    );
  }
  async attestation(challenge: string, origin = ORIGIN) {
    const clientDataJSON = this.clientData("webauthn.create", challenge, origin);
    const authData = await this.authData(0x41); // UP | AT
    const attestationObject = encode(
      new Map<CborValue, CborValue>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );
    return {
      clientDataJSON: b64u(clientDataJSON),
      attestationObject: b64u(attestationObject),
      transports: ["internal"],
    };
  }
  async assertion(
    challenge: string,
    origin = ORIGIN,
    rpId = RP_ID,
    userHandle?: Uint8Array,
  ) {
    const clientDataJSON = this.clientData("webauthn.get", challenge, origin);
    const authenticatorData = await this.authData(0x01, rpId); // UP
    const signed = concat(
      authenticatorData,
      await sha256(clientDataJSON),
    );
    const raw = new Uint8Array(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        this.privateKey,
        signed,
      ),
    );
    return {
      clientDataJSON: b64u(clientDataJSON),
      authenticatorData: b64u(authenticatorData),
      signature: b64u(rawToDer(raw)),
      userHandle: userHandle ? b64u(userHandle) : null,
    };
  }
}

async function fixture() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync("migrations").sort())
    db.exec(readFileSync("migrations/" + file, "utf8"));
  db.prepare(
    "INSERT INTO settings(key,value) VALUES('initialized','1')",
  ).run();
  const DB = {
    prepare(sql: string) {
      let values: any[] = [];
      return {
        bind(...v: any[]) {
          values = v;
          return this;
        },
        async first() {
          return db.prepare(sql).get(...values) || null;
        },
        async all() {
          return { results: db.prepare(sql).all(...values) };
        },
        execute() {
          const s = db.prepare(sql);
          if (/RETURNING/i.test(sql)) {
            const results = s.all(...values);
            return {
              results,
              meta: {
                changes: Number(db.prepare("SELECT changes() AS n").get()!.n),
              },
            };
          }
          return { results: [], meta: s.run(...values) };
        },
        async run() {
          return this.execute();
        },
      };
    },
    async batch(statements: any[]) {
      db.exec("BEGIN");
      try {
        const result = statements.map((s) => s.execute());
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const env = {
      DB,
      APP_ORIGIN: ORIGIN,
      CREDENTIAL_ENCRYPTION_KEY: btoa("x".repeat(32)),
    } as unknown as Env,
    pending: Promise<any>[] = [];
  async function req(path: string, method = "GET", body?: unknown, cookie = "") {
    const r = await app.fetch(
      new Request("http://localhost/api" + path, {
        method,
        headers: {
          Origin: ORIGIN,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
      {
        waitUntil(p: Promise<any>) {
          pending.push(p);
        },
        passThroughOnException() {},
      } as any,
    );
    await Promise.all(pending.splice(0));
    const data = (await r.json()) as any;
    return {
      status: r.status,
      data,
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    };
  }
  return { db, env, req };
}

async function register(
  req: any,
  auth: Authenticator,
  username: string,
  cookie = "",
) {
  const options = (
    await req("/webauthn/register/options", "POST", {}, cookie)
  ).data;
  const attestation = await auth.attestation(options.challenge);
  return req(
    "/webauthn/register/verify",
    "POST",
    {
      username,
      response: attestation,
    },
    cookie,
  );
}

test("passkey-first registration creates the account and signs in", async () => {
  const { db, req } = await fixture();
  const auth = await new Authenticator().init();
  const r = await register(req, auth, "newbie");
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.username, "newbie");
  assert.match(r.cookie, /^vexuni_session=vx_/);
  const row = db
    .prepare(
      "SELECT u.has_password,w.alg,w.sign_count FROM users u JOIN webauthn_credentials w ON w.user_id=u.id WHERE u.username='newbie'",
    )
    .get() as any;
  assert.equal(row.has_password, 0);
  assert.equal(row.alg, -7);
  assert.ok(row.sign_count >= 1);
  const me = await req("/me", "GET", undefined, r.cookie);
  assert.equal(me.data.user.username, "newbie");
});

test("passkey sign-in issues a session and updates the counter", async () => {
  const { db, req } = await fixture();
  const auth = await new Authenticator().init();
  await register(req, auth, "signer");
  const options = (
    await req("/webauthn/login/options", "POST", { username: "signer" })
  ).data;
  assert.equal(options.allowCredentials.length, 1);
  const assertion = await auth.assertion(options.challenge);
  const login = await req("/webauthn/login/verify", "POST", {
    credential: {
      id: b64u(auth.credentialId),
      response: assertion,
    },
  });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  assert.equal(login.data.username, "signer");
  assert.match(login.cookie, /^vexuni_session=vx_/);
  const stored = db
    .prepare("SELECT sign_count,last_used_at FROM webauthn_credentials")
    .get() as any;
  assert.equal(stored.sign_count, auth.count);
  assert.ok(stored.last_used_at > 0);
});

test("challenges are single-use and origin-bound", async () => {
  const { req } = await fixture();
  const auth = await new Authenticator().init();
  const options = (
    await req("/webauthn/register/options", "POST", {})
  ).data;
  const attestation = await auth.attestation(options.challenge);
  const first = await req("/webauthn/register/verify", "POST", {
    username: "first",
    response: attestation,
  });
  assert.equal(first.status, 201);
  // Replay the same ceremony — challenge was consumed.
  const replay = await req("/webauthn/register/verify", "POST", {
    username: "second",
    response: attestation,
  });
  assert.equal(replay.status, 401);
  // Wrong origin fails the RP check.
  const options2 = (
    await req("/webauthn/register/options", "POST", {})
  ).data;
  const foreign = await auth.attestation(
    options2.challenge,
    "https://evil.example",
  );
  const rejected = await req("/webauthn/register/verify", "POST", {
    username: "third",
    response: foreign,
  });
  assert.equal(rejected.status, 401);
});

test("duplicate passkey and duplicate username are conflicts", async () => {
  const { req } = await fixture();
  const auth = await new Authenticator().init();
  await register(req, auth, "taken");
  const again = await register(req, auth, "other");
  assert.equal(again.status, 409);
  const fresh = await new Authenticator().init();
  const clash = await register(req, fresh, "taken");
  assert.equal(clash.status, 409);
});

test("tampered assertion signatures are rejected", async () => {
  const { req } = await fixture();
  const auth = await new Authenticator().init();
  await register(req, auth, "victim");
  const options = (
    await req("/webauthn/login/options", "POST", {})
  ).data;
  const assertion = await auth.assertion(options.challenge);
  const forged = unb64u(assertion.signature);
  forged[forged.length - 1] ^= 0xff;
  const denied = await req("/webauthn/login/verify", "POST", {
    credential: {
      id: b64u(auth.credentialId),
      response: { ...assertion, signature: b64u(forged) },
    },
  });
  assert.equal(denied.status, 401);
});

test("manage endpoints add, list, rename and guard the last passkey", async () => {
  const { req } = await fixture();
  const auth = await new Authenticator().init();
  const r = await register(req, auth, "keeper");
  const cookie = r.cookie;
  // Add a second passkey on the same account.
  const options = (
    await req("/webauthn/manage/options", "POST", {}, cookie)
  ).data;
  assert.equal(options.excludeCredentials.length, 1);
  const second = await new Authenticator().init();
  const attestation = await second.attestation(options.challenge);
  const added = await req(
    "/webauthn/manage/verify",
    "POST",
    { name: "Backup key", response: attestation },
    cookie,
  );
  assert.equal(added.status, 201, JSON.stringify(added.data));
  const list = await req("/webauthn/credentials", "GET", undefined, cookie);
  assert.equal(list.data.credentials.length, 2);
  const renamed = await req(
    `/webauthn/credentials/${added.data.id}`,
    "PATCH",
    { name: "YubiKey" },
    cookie,
  );
  assert.equal(renamed.status, 200);
  // Delete one, then refuse to orphan the account.
  const gone = await req(
    `/webauthn/credentials/${added.data.id}`,
    "DELETE",
    undefined,
    cookie,
  );
  assert.equal(gone.status, 200);
  const last = list.data.credentials.find(
    (k: any) => k.id !== added.data.id,
  );
  const guarded = await req(
    `/webauthn/credentials/${last.id}`,
    "DELETE",
    undefined,
    cookie,
  );
  assert.equal(guarded.status, 409);
});

test("passkey registration always creates regular users and never initializes the instance", async () => {
  const { db, req } = await fixture();
  db.prepare("DELETE FROM credentials").run();
  db.prepare("DELETE FROM users").run();
  db.prepare("DELETE FROM settings WHERE key='initialized'").run();
  const auth = await new Authenticator().init();
  const r = await register(req, auth, "first");
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.admin, 0);
  assert.equal(
    (
      db
        .prepare("SELECT admin FROM users WHERE username='first'")
        .get() as any
    )?.admin,
    0,
  );
  // Public registration must not mark setup complete — the operator still
  // creates the administrator through POST /api/setup + BOOTSTRAP_SECRET.
  assert.equal(
    db.prepare("SELECT 1 FROM settings WHERE key='initialized'").get(),
    undefined,
  );
  const boot = await req("/bootstrap");
  assert.equal(boot.data.required, true);
});

test("a signed-in user cannot register another public account", async () => {
  const { req } = await fixture();
  const auth = await new Authenticator().init();
  const r = await register(req, auth, "solo");
  assert.equal(r.status, 201);
  const again = await new Authenticator().init();
  const r2 = await register(req, again, "second", r.cookie);
  assert.equal(r2.status, 409);
});

test("a fresh passkey session can set a password", async () => {
  const { req } = await fixture();
  const auth = await new Authenticator().init();
  const r = await register(req, auth, "upgrade");
  const set = await req(
    "/password",
    "POST",
    { current_password: "", new_password: "correct-horse-battery" },
    r.cookie,
  );
  assert.equal(set.status, 200, JSON.stringify(set.data));
});
