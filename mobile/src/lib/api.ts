/** Thin JSON client for the church API. Pure: fetch and the token source are injected, so it is testable. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  fetch?: typeof fetch;
  /** Called on a 401 so the app can sign out and return to the sign-in screen. */
  onUnauthorized?: () => void;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  json?: unknown;
}

export function createApi({
  baseUrl,
  getToken,
  fetch: doFetch = fetch,
  onUnauthorized,
}: ApiOptions) {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T = unknown>(
    path: string,
    { method = "GET", json }: RequestOptions = {},
  ): Promise<T> {
    const headers = new Headers({ accept: "application/json" });
    const token = await getToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (json !== undefined) headers.set("content-type", "application/json");

    let response: Response;
    try {
      response = await doFetch(`${root}${path}`, {
        method,
        headers,
        body: json === undefined ? undefined : JSON.stringify(json),
      });
    } catch {
      throw new ApiError(
        0,
        "Can't reach the church server. Check your connection and try again.",
      );
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    const body: unknown = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
      if (response.status === 401) onUnauthorized?.();
      const message =
        body &&
        typeof body === "object" &&
        "message" in body &&
        typeof body.message === "string"
          ? body.message
          : `Something went wrong (${response.status})`;
      throw new ApiError(response.status, message);
    }
    return body as T;
  }

  return { request };
}

export type Api = ReturnType<typeof createApi>;
