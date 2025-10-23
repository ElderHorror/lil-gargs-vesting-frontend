const API_BASE = "http://localhost:3001/api";
// changed

interface RequestOptions extends RequestInit {
  json?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, headers, ...rest } = options;
  const reqHeaders = new Headers(headers ?? undefined);
  if (!reqHeaders.has("Accept")) {
    reqHeaders.set("Accept", "application/json");
  }

  let body: BodyInit | undefined;
  if (json !== undefined) {
    reqHeaders.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: reqHeaders,
    body,
    cache: options.cache ?? "no-store",
  });

  if (!res.ok) {
    const message = await parseError(res);
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

async function parseError(res: Response) {
  try {
    const data = await res.json();
    if (typeof data?.error === "string") {
      return data.error;
    }
    if (typeof data?.message === "string") {
      return data.message;
    }
    // Return full error object for validation errors
    if (data?.validation || data?.suggestions) {
      return JSON.stringify(data);
    }
  } catch {
    // ignore
  }
  return `${res.status} ${res.statusText}`;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, {
    ...options,
    method: "GET",
  }),
  post: <T>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "POST",
      json,
    }),
  put: <T>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "PUT",
      json,
    }),
  patch: <T>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "PATCH",
      json,
    }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: "DELETE",
    }),
};

// Validation types
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    timestamp: { valid: boolean; message: string; adjustedStart?: number };
    solBalance: { valid: boolean; current: number; required: number; message: string };
    tokenBalance: { valid: boolean; current: number; required: number; message: string };
    treasury: { valid: boolean; address: string };
    allocations: { valid: boolean; total: number; message: string };
  };
  canProceedWithoutStreamflow: boolean;
}

export type ApiResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};
