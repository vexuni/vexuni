import { decode, type CborValue } from "./cbor";

/** COSE key → WebCrypto import/verify parameters for the algorithms
 *  WebAuthn authenticators advertise: ES256/384/512, EdDSA, RS256, PS256/384/512. */

export interface StoredKey {
  jwk: JsonWebKey;
  alg: number;
}

const ES: Record<number, { crv: string; hash: string; size: number }> = {
  [-7]: { crv: "P-256", hash: "SHA-256", size: 32 },
  [-35]: { crv: "P-384", hash: "SHA-384", size: 48 },
  [-36]: { crv: "P-521", hash: "SHA-512", size: 66 },
};
const RSA_ALGS: Record<number, { name: string; hash: string; salt: number }> = {
  [-257]: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", salt: 0 },
  [-37]: { name: "RSA-PSS", hash: "SHA-256", salt: 32 },
  [-38]: { name: "RSA-PSS", hash: "SHA-384", salt: 48 },
  [-39]: { name: "RSA-PSS", hash: "SHA-512", salt: 64 },
};

export function b64u(bytes: Uint8Array | ArrayBuffer): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function unb64u(value: string): Uint8Array {
  const s = value.replaceAll("-", "+").replaceAll("_", "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function field(map: Map<CborValue, CborValue>, key: number): CborValue {
  const v = map.get(key);
  if (v === undefined) throw Error("COSE key missing field " + key);
  return v;
}

/** Parse a COSE_Key (from attested credential data) into a storable JWK + alg. */
export function coseToJwk(cose: Uint8Array): StoredKey {
  const value = decode(cose);
  if (!(value instanceof Map)) throw Error("Credential key is not a COSE map");
  const kty = field(value, 1);
  const algField = value.get(3);
  if (kty === 2) {
    // EC2: -1 crv, -2 x, -3 y
    const crv = field(value, -1),
      x = field(value, -2),
      y = field(value, -3);
    if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array))
      throw Error("Malformed EC2 coordinates");
    const alg = typeof algField === "number" ? algField : crv === 1 ? -7 : 0;
    const curve = ES[alg];
    if (!curve) throw Error("Unsupported ECDSA algorithm " + alg);
    return {
      alg,
      jwk: {
        kty: "EC",
        crv: curve.crv,
        x: b64u(x),
        y: b64u(y),
        alg: "ES" + curve.hash.split("-")[1],
        ext: true,
      },
    };
  }
  if (kty === 1) {
    // OKP: crv 6 = Ed25519
    if (field(value, -1) !== 6) throw Error("Unsupported OKP curve");
    const x = field(value, -2);
    if (!(x instanceof Uint8Array)) throw Error("Malformed OKP key");
    return {
      alg: -8,
      jwk: { kty: "OKP", crv: "Ed25519", x: b64u(x), alg: "EdDSA", ext: true },
    };
  }
  if (kty === 3) {
    // RSA: -1 n, -2 e
    const n = field(value, -1),
      e = field(value, -2);
    if (!(n instanceof Uint8Array) || !(e instanceof Uint8Array))
      throw Error("Malformed RSA key");
    const alg = typeof algField === "number" ? algField : -257;
    const rsa = RSA_ALGS[alg];
    if (!rsa) throw Error("Unsupported RSA algorithm " + alg);
    if (n.length < 256) throw Error("RSA keys must be at least 2048 bits");
    return {
      alg,
      jwk: {
        kty: "RSA",
        n: b64u(n),
        e: b64u(e),
        alg: alg === -257 ? "RS256" : "PS" + rsa.hash.split("-")[1],
        ext: true,
      },
    };
  }
  throw Error("Unsupported COSE key type " + String(kty));
}

/** DER-encoded ECDSA signature → raw r‖s for WebCrypto.
 *  Authenticators send DER; a raw signature can coincidentally start with
 *  0x30, so malformed DER falls back to treating the input as raw. */
function derToRaw(der: Uint8Array, size: number): Uint8Array {
  if (der[0] !== 0x30) return der; // already raw
  try {
    let pos = 2;
    if (der[1] & 0x80) pos += der[1] & 0x7f;
    const parts: Uint8Array[] = [];
    for (let i = 0; i < 2; i++) {
      if (der[pos++] !== 0x02) throw Error("not DER");
      let length = der[pos++];
      if (length & 0x80) {
        const n = length & 0x7f;
        length = 0;
        for (let j = 0; j < n; j++) length = (length << 8) | der[pos++];
      }
      let bytes = der.slice(pos, pos + length);
      pos += length;
      while (bytes.length > size && bytes[0] === 0) bytes = bytes.slice(1);
      if (bytes.length > size) throw Error("not DER");
      if (bytes.length < size) {
        const padded = new Uint8Array(size);
        padded.set(bytes, size - bytes.length);
        bytes = padded;
      }
      parts.push(bytes);
    }
    const raw = new Uint8Array(size * 2);
    raw.set(parts[0], 0);
    raw.set(parts[1], size);
    return raw;
  } catch {
    return der;
  }
}

export async function verifySignature(
  stored: StoredKey,
  signature: Uint8Array,
  data: Uint8Array,
): Promise<boolean> {
  const { alg, jwk } = stored;
  if (alg === -8) {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "Ed25519",
      key,
      signature as BufferSource,
      data as BufferSource,
    );
  }
  const ec = ES[alg];
  if (ec) {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: ec.crv },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      { name: "ECDSA", hash: ec.hash },
      key,
      derToRaw(signature, ec.size) as BufferSource,
      data as BufferSource,
    );
  }
  const rsa = RSA_ALGS[alg];
  if (rsa) {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: rsa.name, hash: rsa.hash },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      rsa.name === "RSA-PSS" ? { name: "RSA-PSS", saltLength: rsa.salt } : rsa.name,
      key,
      signature as BufferSource,
      data as BufferSource,
    );
  }
  return false;
}
