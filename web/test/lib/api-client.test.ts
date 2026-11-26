import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "@/lib/api-client";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("apiFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("prefixes the path, sends cookies, and parses JSON", async () => {
    const fetchMock = mockFetch(200, { ok: true });
    expect(await apiFetch("/users")).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/users");
    expect(init.credentials).toBe("include");
  });

  it("serializes a JSON body", async () => {
    const fetchMock = mockFetch(200, {});
    await apiFetch("/auth/login", { method: "POST", json: { email: "a@b.org" } });
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBe('{"email":"a@b.org"}');
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("returns undefined for 204", async () => {
    mockFetch(204, undefined);
    expect(await apiFetch("/auth/logout", { method: "POST" })).toBeUndefined();
  });

  it("throws ApiError with status and server message", async () => {
    mockFetch(401, { message: "Invalid email or password", statusCode: 401 });
    const error = await apiFetch("/auth/login").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, message: "Invalid email or password" });
  });
});
