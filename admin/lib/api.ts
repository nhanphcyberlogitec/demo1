// API helper — wraps fetch() against the FastAPI backend.
//
// Per BACKEND_API.md §1.1, every response is `{ success, data, message }`.
// 401 from any /api/users/* call → token expired (TECH_SPEC §4.11): the
// caller must clear localStorage and bounce to /login. We surface that via
// the `ApiError` class so the AuthContext can intercept it centrally.

export const API_BASE = "http://localhost:8000";

export type Envelope<T> = {
  success: boolean;
  data: T | { errors?: Record<string, string> } | null;
  message: string;
};

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  status: number;
  body: Envelope<unknown> | null;
  fieldErrors: FieldErrors;
  serverMessage: string;
  isNetwork: boolean;
  constructor(opts: {
    status: number;
    body: Envelope<unknown> | null;
    message: string;
    isNetwork?: boolean;
  }) {
    super(opts.message);
    this.status = opts.status;
    this.body = opts.body;
    this.serverMessage = opts.body?.message ?? "";
    const errors =
      opts.body && opts.body.data && typeof opts.body.data === "object"
        ? (opts.body.data as { errors?: FieldErrors }).errors
        : undefined;
    this.fieldErrors = errors ?? {};
    this.isNetwork = !!opts.isNetwork;
  }
}

function getToken(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  // Caller may opt out of auth for the login endpoint, but every /api/users
  // call sends Authorization (BACKEND_API §1.2).
  auth?: boolean;
};

export async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, signal, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    // Aborts are surfaced verbatim so callers can ignore stale requests.
    if ((err as { name?: string })?.name === "AbortError") throw err;
    throw new ApiError({
      status: 0,
      body: null,
      message: "Something went wrong. Please try again.",
      isNetwork: true,
    });
  }

  let parsed: Envelope<T> | null = null;
  try {
    parsed = (await response.json()) as Envelope<T>;
  } catch {
    parsed = null;
  }

  if (response.ok && parsed?.success) {
    return parsed.data as T;
  }

  throw new ApiError({
    status: response.status,
    body: parsed as Envelope<unknown> | null,
    message: parsed?.message || `Request failed with status ${response.status}`,
  });
}

// ---- Domain-specific shapes ------------------------------------------------

export type UserDTO = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type UsersListResponse = {
  items: UserDTO[];
  pagination: Pagination;
};

export type CreateUserBody = {
  email: string;
  name: string;
  role: "admin" | "user";
  password: string;
};

export type UpdateUserBody = Partial<{
  email: string;
  name: string;
  role: "admin" | "user";
  password: string;
}>;

export function listUsers(
  params: { q?: string; page?: number; limit?: number },
  signal?: AbortSignal
): Promise<UsersListResponse> {
  const search = new URLSearchParams();
  if (params.q && params.q.trim()) search.set("q", params.q.trim());
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString();
  return apiFetch<UsersListResponse>(
    `/api/users${qs ? `?${qs}` : ""}`,
    { signal }
  );
}

export function createUser(body: CreateUserBody): Promise<UserDTO> {
  return apiFetch<UserDTO>("/api/users", { method: "POST", body });
}

export function updateUser(
  id: string,
  body: UpdateUserBody
): Promise<UserDTO> {
  return apiFetch<UserDTO>(`/api/users/${id}`, { method: "PATCH", body });
}

export function deleteUser(id: string): Promise<null> {
  return apiFetch<null>(`/api/users/${id}`, { method: "DELETE" });
}
