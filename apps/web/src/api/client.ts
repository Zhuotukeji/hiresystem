const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
  requestId?: string;
  details?: unknown;
  stack?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiList<T> = {
  items: T[];
  total: number;
};

export function getToken() {
  return localStorage.getItem("hiresystem_token");
}

export function setToken(token: string) {
  localStorage.setItem("hiresystem_token", token);
}

export function clearToken() {
  localStorage.removeItem("hiresystem_token");
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!headers.has("Content-Type") && options.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const clientRequestId = headers.get("x-request-id") ?? createRequestId();
  headers.set("x-request-id", clientRequestId);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("登录已过期");
  }

  if (!response.ok) {
    const requestId = response.headers.get("x-request-id") ?? clientRequestId;
    const error = await response.json().catch(() => ({ message: response.statusText })) as ApiErrorPayload;
    const message = formatApiErrorMessage(error, requestId);
    console.error("API request failed", {
      path,
      status: response.status,
      requestId,
      error
    });
    throw new ApiError(message, response.status, requestId, error.details ?? error.stack ?? error);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
  delete: <T>(path: string) =>
    apiRequest<T>(path, {
      method: "DELETE"
    }),
  postForm: <T>(path: string, body: FormData) =>
    apiRequest<T>(path, {
      method: "POST",
      body
    }),
  put: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body)
    })
};

function formatApiErrorMessage(error: ApiErrorPayload, requestId?: string) {
  const message = Array.isArray(error.message) ? error.message.join("；") : error.message ?? "请求失败";
  const details = compactDetails(error.details);
  const effectiveRequestId = requestId ?? error.requestId;
  return [
    message,
    error.error ? `错误类型：${error.error}` : "",
    effectiveRequestId ? `错误ID：${effectiveRequestId}` : "",
    details ? `详情：${details}` : ""
  ]
    .filter(Boolean)
    .join("；");
}

function compactDetails(details: unknown) {
  if (!details) return "";
  if (typeof details === "string") return details.slice(0, 500);
  try {
    return JSON.stringify(details).slice(0, 500);
  } catch {
    return String(details).slice(0, 500);
  }
}

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
