export interface Admin {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface ApiErrorBody {
  error?: { message?: string; fields?: Record<string, string[]> };
  message?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly fields: Record<string, string[]> = {},
    public readonly status = 500,
  ) {
    super(message);
  }
}

export async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf-token", { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new ApiError("Unable to establish a secure connection. Please refresh the page.");
  const body = (await response.json()) as { data: { csrfToken: string } };
  return body.data.csrfToken;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, csrf = false): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (csrf) headers.set("X-CSRF-Token", await getCsrfToken());

  const response = await fetch(path, { ...init, headers, credentials: "include", cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(body.error?.message ?? "Something went wrong. Please try again.", body.error?.fields, response.status);
  }
  return body as T;
}
