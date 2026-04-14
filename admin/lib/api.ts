export const API_BASE = "http://localhost:8000";

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  message: string;
};

export type ApiValidationError = {
  errors?: Record<string, string>;
};

export type ApiResult<T> = {
  status: number;
  ok: boolean;
  body: ApiEnvelope<T & ApiValidationError> | ApiEnvelope<T>;
};

function clearSessionAndRedirect() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  let body: ApiEnvelope<T> = { success: false, data: null, message: "" };
  try {
    body = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // non-JSON body — leave defaults
  }

  if (response.status === 401) {
    clearSessionAndRedirect();
  }

  return { status: response.status, ok: response.ok, body };
}
