export function delay<T>(data: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

type ApiEnvelope<T> =
  | { success: true; data: T; meta?: PageMeta | null }
  | {
      success: false;
      error: { code: string; message: string; details?: Array<{ field: string; message: string }> };
    };

interface ApiFetchOptions {
  retryOnUnauthorized?: boolean;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Array<{ field: string; message: string }>;

  constructor(status: number, code: string, message: string, details?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * In the browser, relative paths go through the Next rewrite in next.config.ts.
 * On the server there is no origin to be relative to — and the rewrite only
 * applies to requests that reach Next — so call the API directly.
 */
function resolveUrl(path: string): string {
  if (typeof window !== "undefined") return path;
  return `${process.env.API_BASE_URL ?? "http://localhost:8000"}${path}`;
}

async function parseEnvelope<T>(response: Response): Promise<{ data: T; meta: PageMeta | null }> {
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (response.ok && body?.success) {
    return { data: body.data, meta: body.meta ?? null };
  }

  const error = body && !body.success ? body.error : null;
  throw new ApiError(
    response.status,
    error?.code ?? "HTTP_ERROR",
    error?.message ?? "Request failed",
    error?.details
  );
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(resolveUrl("/api/v1/auth/refresh"), {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(path: string, init: RequestInit, options: ApiFetchOptions): Promise<Response> {
  const retryOnUnauthorized = options.retryOnUnauthorized ?? true;
  const requestInit: RequestInit = {
    ...init,
    credentials: "include",
    // Catalog data changes when the seed is re-run, and a stale cached page in a
    // demo is worse than an extra round trip.
    cache: init.cache ?? "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  };

  const response = await fetch(resolveUrl(path), requestInit);

  // Only the browser can act on a refresh: the cookies live there.
  if (response.status === 401 && retryOnUnauthorized && typeof window !== "undefined") {
    if (await refreshAccessToken()) {
      return fetch(resolveUrl(path), requestInit);
    }
  }

  return response;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<T> {
  const { data } = await parseEnvelope<T>(await request(path, init, options));
  return data;
}

/** Same as apiFetch, but keeps the pagination envelope's `meta`. */
export async function apiFetchPage<T>(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<{ data: T; meta: PageMeta | null }> {
  return parseEnvelope<T>(await request(path, init, options));
}

/**
 * Walk every page of a list endpoint. The API caps `limit` at 100, and the
 * explore screens filter client-side over the whole set, so the alternative
 * would be pushing every filter into the URL for a few hundred rows.
 *
 * `hardCap` is a runaway guard: a bad `total` should not spin forever.
 */
export async function fetchAllPages<T>(
  path: string,
  params: Record<string, string | number> = {},
  hardCap = 2000
): Promise<T[]> {
  const limit = 100;
  const rows: T[] = [];
  let page = 1;

  for (;;) {
    const query = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      page: String(page),
      limit: String(limit),
    });
    const { data, meta } = await apiFetchPage<T[]>(`${path}?${query}`);
    rows.push(...data);

    const total = meta?.total ?? rows.length;
    if (data.length < limit || rows.length >= total || rows.length >= hardCap) break;
    page += 1;
  }

  return rows;
}
