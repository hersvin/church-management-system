/** All API calls go through the Next.js rewrite at /api so the session cookie stays first-party. */
const API_PREFIX = "/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestInit extends Omit<RequestInit, "body"> {
  json?: unknown;
}

export async function apiFetch<T = unknown>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const finalHeaders = new Headers(headers);
  if (json !== undefined) finalHeaders.set("content-type", "application/json");
  finalHeaders.set("accept", "application/json");

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...rest,
    headers: finalHeaders,
    credentials: "include",
    body: json === undefined ? undefined : JSON.stringify(json),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message, body);
  }
  return body as T;
}
