export function delay<T>(data: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

type ApiEnvelope<T> =
  | { success: true; data: T }
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

async function parseEnvelope<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (response.ok && body?.success) {
    return body.data;
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
    refreshPromise = fetch("/api/v1/auth/refresh", {
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

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<T> {
  const retryOnUnauthorized = options.retryOnUnauthorized ?? true;
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retry = await fetch(path, {
        ...init,
        credentials: "include",
        headers: {
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      });
      return parseEnvelope<T>(retry);
    }
  }

  return parseEnvelope<T>(response);
}
