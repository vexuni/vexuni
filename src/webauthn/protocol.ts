import { decode, type CborValue } from "./cbor";
import { b64u, coseToJwk, verifySignature, type StoredKey } from "./cose";
import { equal } from "../security";

/** WebAuthn ceremony verification (Level 2, attestation "none").
 *  self-implemented: CBOR attestation parsing, authenticatorData slicing,
 *  clientData checks, COSE key import and assertion signature verify. */

export interface RelyingParty {
  id: string;
  name: string;
  /** Explicit additional origins (e.g. a dev server port). */
  origins: string[];
}

export interface RegistrationResult {
  credentialId: string;
  key: StoredKey;
  signCount: number;
  aaguid: string;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", bytes as BufferSource),
  );
}

function fail(msg: string): never {
  throw Error(msg);
}

interface ClientData {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}

function clientData(json: Uint8Array, type: string, challenge: string): ClientData {
  let data: ClientData;
  try {
    data = JSON.parse(new TextDecoder().decode(json));
  } catch {
    fail("Malformed clientDataJSON");
  }
  if (data!.type !== type) fail("Unexpected WebAuthn ceremony type");
  if (!equal(data!.challenge || "", challenge)) fail("Challenge mismatch");
  if (typeof data!.origin !== "string" || !data!.origin)
    fail("Missing clientData origin");
  return data!;
}

function originAllowed(origin: string, rp: RelyingParty): boolean {
  if (rp.origins.includes(origin)) return true;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  return host === rp.id || host.endsWith("." + rp.id);
}

interface AuthData {
  flags: number;
  signCount: number;
  credentialId?: Uint8Array;
  credentialKey?: Uint8Array;
  aaguid?: Uint8Array;
}

async function authenticatorData(bytes: Uint8Array, rpId: string): Promise<AuthData> {
  if (bytes.length < 37) fail("authenticatorData too short");
  const rpIdHash = bytes.slice(0, 32);
  if (!equal(b64u(rpIdHash), b64u(await sha256(new TextEncoder().encode(rpId)))))
    fail("RP ID hash mismatch");
  const flags = bytes[32];
  if (!(flags & 0x01)) fail("User presence flag missing");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result: AuthData = {
    flags,
    signCount: view.getUint32(33),
  };
  if (flags & 0x40) {
    // Attested credential data: AAGUID(16) ‖ idLen(2) ‖ id ‖ COSE key
    if (bytes.length < 37 + 16 + 2) fail("Truncated attested credential data");
    result.aaguid = bytes.slice(37, 53);
    const idLen = view.getUint16(53);
    const start = 55;
    if (idLen < 1 || idLen > 1023 || bytes.length <= start + idLen)
      fail("Malformed credential id");
    result.credentialId = bytes.slice(start, start + idLen);
    result.credentialKey = bytes.slice(start + idLen);
  }
  return result;
}

export async function verifyRegistration(
  attestationObject: Uint8Array,
  clientDataJSON: Uint8Array,
  challenge: string,
  rp: RelyingParty,
): Promise<RegistrationResult> {
  const data = clientData(clientDataJSON, "webauthn.create", challenge);
  if (!originAllowed(data.origin, rp)) fail("Origin not allowed for this RP");
  const att = decode(attestationObject);
  if (!(att instanceof Map)) fail("Malformed attestation object");
  if (att.get("fmt") !== "none")
    fail("Only attestation 'none' is accepted");
  const authBytes = att.get("authData");
  if (!(authBytes instanceof Uint8Array)) fail("Missing authData");
  const auth = await authenticatorData(authBytes, rp.id);
  if (!auth.credentialId || !auth.credentialKey || !auth.aaguid)
    fail("Attested credential data missing");
  const key = coseToJwk(auth.credentialKey);
  return {
    credentialId: b64u(auth.credentialId),
    key,
    signCount: auth.signCount,
    aaguid: b64u(auth.aaguid),
  };
}

export async function verifyAssertion(
  input: {
    authenticatorData: Uint8Array;
    clientDataJSON: Uint8Array;
    signature: Uint8Array;
    userHandle?: Uint8Array | null;
  },
  challenge: string,
  rp: RelyingParty,
  stored: StoredKey,
  storedCount: number,
  storedHandle: string,
): Promise<{ signCount: number }> {
  const data = clientData(input.clientDataJSON, "webauthn.get", challenge);
  if (!originAllowed(data.origin, rp)) fail("Origin not allowed for this RP");
  const auth = await authenticatorData(input.authenticatorData, rp.id);
  if (
    storedHandle &&
    input.userHandle &&
    input.userHandle.length &&
    b64u(input.userHandle) !== storedHandle
  )
    fail("User handle mismatch");
  const signed = new Uint8Array(
    input.authenticatorData.length + 32,
  );
  signed.set(input.authenticatorData, 0);
  signed.set(await sha256(input.clientDataJSON), input.authenticatorData.length);
  if (!(await verifySignature(stored, input.signature, signed)))
    fail("Assertion signature invalid");
  // Clone detection: only enforce when both sides keep counters.
  if (auth.signCount > 0 && storedCount > 0 && auth.signCount <= storedCount)
    fail("Authenticator signature counter regressed");
  return { signCount: Math.max(auth.signCount, storedCount) };
}
