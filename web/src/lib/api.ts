/** Thin typed client over the same-origin /api surface.
 *  Auth rides on the httpOnly vexuni_session cookie; errors carry HTTP status. */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function qs(options: Record<string, unknown> = {}): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null || value === "") continue;
    for (const v of Array.isArray(value) ? value : [value])
      q.append(key, String(v));
  }
  const s = q.toString();
  return s ? "?" + s : "";
}

async function request<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const GET_TTL = 30_000;
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

// Reference data that several repo pages each fetch on mount (branches, tags,
// social state, planning) barely changes inside a navigation session. A 30s
// cache turns repeated tab switches into zero worker calls; anything outside
// this whitelist still shares in-flight requests but never serves a stale read.
const CACHE_SUFFIXES = new Set([
  "branches",
  "tags",
  "planning",
  "social",
  "members",
  "protections",
  "releases",
  "labels",
  "milestones",
]);
function cacheable(path: string): boolean {
  const segs = path.split(/[?#]/, 1)[0].split("/").filter(Boolean);
  if (segs[0] === "profiles" || segs[0] === "workspaces") return true;
  if (segs[0] !== "repos") return false;
  if (segs.length === 1 || segs.length === 3) return true; // list, detail
  return segs.length === 4 && CACHE_SUFFIXES.has(segs[3]);
}

function get<T>(path: string, fresh: boolean): Promise<T> {
  const ok = cacheable(path);
  const hit = ok ? cache.get(path) : undefined;
  if (!fresh && hit && Date.now() - hit.at < GET_TTL)
    return Promise.resolve(hit.value as T);
  // An in-flight request is always at least as fresh as the cache.
  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;
  const p = request<T>(path)
    .then((v) => {
      if (ok) {
        if (cache.size > 300) cache.clear();
        cache.set(path, { at: Date.now(), value: v });
      }
      inflight.delete(path);
      return v;
    })
    .catch((e) => {
      inflight.delete(path);
      throw e;
    });
  inflight.set(path, p);
  return p;
}

export const api = {
  get: <T = unknown>(path: string) => get<T>(path, false),
  /** Explicit refresh: skips the TTL read but still dedupes in-flight calls. */
  getFresh: <T = unknown>(path: string) => get<T>(path, true),
  post: <T = unknown>(path: string, body?: unknown) => {
    cache.clear();
    return request<T>(path, "POST", body);
  },
  put: <T = unknown>(path: string, body?: unknown) => {
    cache.clear();
    return request<T>(path, "PUT", body);
  },
  patch: <T = unknown>(path: string, body?: unknown) => {
    cache.clear();
    return request<T>(path, "PATCH", body);
  },
  del: <T = unknown>(path: string, body?: unknown) => {
    cache.clear();
    return request<T>(path, "DELETE", body);
  },
};

/** Repository-scoped endpoint prefix. */
export const repoPath = (namespace: string, name: string) =>
  `/repos/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;

/** The API reports a missing ref as an error, but on a repository with no
 * commits that is a normal state — callers render empty states, not failures. */
export const revisionMissing = (error?: Error) =>
  !!error && /revision not found/i.test(error.message);
