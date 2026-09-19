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

export const api = {
  get: <T = unknown>(path: string) => request<T>(path),
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, "POST", body),
  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, "PUT", body),
  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, "PATCH", body),
  del: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, "DELETE", body),
};

/** Repository-scoped endpoint prefix. */
export const repoPath = (namespace: string, name: string) =>
  `/repos/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;
