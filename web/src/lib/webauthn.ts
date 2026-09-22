/** Browser-side WebAuthn ceremony helpers.
 *  Options arrive from the API with base64url binary fields; responses are
 *  serialized back the same way. */

export function b64uToBytes(value: string): Uint8Array {
  const s = value.replaceAll("-", "+").replaceAll("_", "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64u(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export interface CreationOptions {
  challenge: string;
  rp: { name: string; id: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: "public-key"; alg: number }[];
  timeout?: number;
  attestation?: string;
  authenticatorSelection?: {
    residentKey?: string;
    userVerification?: string;
    authenticatorAttachment?: string;
  };
  excludeCredentials?: {
    type: "public-key";
    id: string;
    transports?: string[];
  }[];
}

export interface RequestOptions {
  challenge: string;
  rpId: string;
  timeout?: number;
  userVerification?: string;
  allowCredentials?: {
    type: "public-key";
    id: string;
    transports?: string[];
  }[];
}

export interface AttestationPayload {
  clientDataJSON: string;
  attestationObject: string;
  transports: string[];
}

export interface AssertionPayload {
  id: string;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle: string | null;
  };
}

export function passkeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential === "function" &&
    typeof navigator.credentials?.create === "function"
  );
}

export async function createPasskey(
  options: CreationOptions,
): Promise<AttestationPayload> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: b64uToBytes(options.challenge) as BufferSource,
      rp: options.rp,
      user: {
        id: b64uToBytes(options.user.id) as BufferSource,
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      attestation: (options.attestation || "none") as AttestationConveyancePreference,
      authenticatorSelection: options.authenticatorSelection as
        | AuthenticatorSelectionCriteria
        | undefined,
      excludeCredentials: options.excludeCredentials?.map((c) => ({
        type: c.type,
        id: b64uToBytes(c.id) as BufferSource,
        transports: c.transports as AuthenticatorTransport[] | undefined,
      })),
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw Error("The authenticator returned no credential");
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    clientDataJSON: bytesToB64u(response.clientDataJSON),
    attestationObject: bytesToB64u(response.attestationObject),
    transports:
      typeof response.getTransports === "function"
        ? response.getTransports()
        : [],
  };
}

export async function getPasskey(
  options: RequestOptions,
): Promise<AssertionPayload> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: b64uToBytes(options.challenge) as BufferSource,
      rpId: options.rpId,
      timeout: options.timeout,
      userVerification: (options.userVerification ||
        "preferred") as UserVerificationRequirement,
      allowCredentials: options.allowCredentials?.map((c) => ({
        type: c.type,
        id: b64uToBytes(c.id) as BufferSource,
        transports: c.transports as AuthenticatorTransport[] | undefined,
      })),
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw Error("The authenticator returned no credential");
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    response: {
      clientDataJSON: bytesToB64u(response.clientDataJSON),
      authenticatorData: bytesToB64u(response.authenticatorData),
      signature: bytesToB64u(response.signature),
      userHandle: response.userHandle ? bytesToB64u(response.userHandle) : null,
    },
  };
}

/** Human-readable label for WebAuthn API errors. */
export function ceremonyError(err: unknown, cancelled: string): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return cancelled;
    if (err.name === "InvalidStateError")
      return "This passkey is already registered on this device";
    if (err.name === "NotSupportedError")
      return "This authenticator cannot create passkeys";
  }
  return (err as Error).message;
}
