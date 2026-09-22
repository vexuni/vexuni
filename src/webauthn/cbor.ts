/** Minimal CBOR codec (RFC 8949, definite-length items only).
 *  Covers what WebAuthn needs: ints, byte/text strings, arrays, maps,
 *  booleans and null. Floats and tags are rejected — they never appear in
 *  attestation objects or COSE keys. */

export type CborValue =
  | number
  | bigint
  | Uint8Array
  | string
  | boolean
  | null
  | CborValue[]
  | Map<CborValue, CborValue>;

interface Reader {
  view: DataView;
  pos: number;
}

function argument(r: Reader, info: number): bigint {
  if (info < 24) return BigInt(info);
  const size = [1, 2, 4, 8][info - 24];
  if (!size) throw Error("Indefinite-length CBOR is not supported");
  let value = 0n;
  for (let i = 0; i < size; i++)
    value = (value << 8n) | BigInt(r.view.getUint8(r.pos++));
  return value;
}

function item(r: Reader): CborValue {
  const head = r.view.getUint8(r.pos++);
  const major = head >> 5;
  const arg = argument(r, head & 0x1f);
  switch (major) {
    case 0:
      return arg <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(arg) : arg;
    case 1:
      return arg <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(-1n - arg)
        : -1n - arg;
    case 2: {
      const length = Number(arg);
      const bytes = new Uint8Array(
        r.view.buffer,
        r.view.byteOffset + r.pos,
        length,
      );
      r.pos += length;
      return new Uint8Array(bytes);
    }
    case 3: {
      const length = Number(arg);
      const bytes = new Uint8Array(
        r.view.buffer,
        r.view.byteOffset + r.pos,
        length,
      );
      r.pos += length;
      return new TextDecoder().decode(bytes);
    }
    case 4: {
      const list: CborValue[] = [];
      for (let i = 0n; i < arg; i++) list.push(item(r));
      return list;
    }
    case 5: {
      const map = new Map<CborValue, CborValue>();
      for (let i = 0n; i < arg; i++) {
        const key = item(r);
        map.set(key, item(r));
      }
      return map;
    }
    case 7:
      if (arg === 20n) return false;
      if (arg === 21n) return true;
      if (arg === 22n || arg === 23n) return null;
      throw Error("Unsupported CBOR simple value " + arg);
    default:
      throw Error("Unsupported CBOR major type " + major);
  }
}

export function decode(bytes: Uint8Array): CborValue {
  const r: Reader = {
    view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    pos: 0,
  };
  const value = item(r);
  if (r.pos !== bytes.length) throw Error("Trailing bytes after CBOR item");
  return value;
}

function head(out: number[], major: number, value: bigint) {
  const info =
    value < 24n
      ? Number(value)
      : value < 0x100n
        ? 24
        : value < 0x10000n
          ? 25
          : value < 0x100000000n
            ? 26
            : 27;
  out.push((major << 5) | info);
  const bytes = info < 24 ? 0 : info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : 8;
  for (let i = (bytes - 1) * 8; i >= 0; i -= 8)
    out.push(Number((value >> BigInt(i)) & 0xffn));
}

function write(out: number[], value: CborValue) {
  if (value === null) return void out.push(0xf6);
  if (value === false) return void out.push(0xf4);
  if (value === true) return void out.push(0xf5);
  if (typeof value === "number" || typeof value === "bigint") {
    const n = BigInt(value);
    return head(out, n < 0n ? 1 : 0, n < 0n ? -1n - n : n);
  }
  if (value instanceof Uint8Array) {
    head(out, 2, BigInt(value.length));
    for (const b of value) out.push(b);
    return;
  }
  if (typeof value === "string") {
    const bytes = new TextEncoder().encode(value);
    head(out, 3, BigInt(bytes.length));
    for (const b of bytes) out.push(b);
    return;
  }
  if (Array.isArray(value)) {
    head(out, 4, BigInt(value.length));
    for (const child of value) write(out, child);
    return;
  }
  if (value instanceof Map) {
    head(out, 5, BigInt(value.size));
    for (const [k, v] of value) {
      write(out, k);
      write(out, v);
    }
    return;
  }
  throw Error("Cannot CBOR-encode value");
}

export function encode(value: CborValue): Uint8Array {
  const out: number[] = [];
  write(out, value);
  return new Uint8Array(out);
}
