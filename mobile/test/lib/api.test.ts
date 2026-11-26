import { describe, expect, it, vi } from "vitest";
import { ApiError, createApi } from "../../src/lib/api";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("createApi", () => {
  it("sends the bearer token and JSON body to the API base URL", async () => {
    const fetch = vi.fn(async () => json({ ok: true }));
    const api = createApi({
      baseUrl: "http://10.0.2.2:4000/",
      getToken: async () => "tok",
      fetch,
    });
    await api.request("/me/check-ins", {
      method: "POST",
      json: { token: "cmsqr1.a.b" },
    });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://10.0.2.2:4000/me/check-ins");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer tok");
    expect(headers.get("content-type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ token: "cmsqr1.a.b" }));
  });

  it("sends no authorization header without a token", async () => {
    const fetch = vi.fn(async () => json({}));
    await createApi({
      baseUrl: "http://x",
      getToken: async () => null,
      fetch,
    }).request("/public/videos");
    expect(
      new Headers(
        (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers,
      ).has("authorization"),
    ).toBe(false);
  });

  it("turns error responses into ApiError with the server's message", async () => {
    const fetch = vi.fn(async () =>
      json({ message: "You are already checked in to this service" }, 409),
    );
    const err = await createApi({
      baseUrl: "http://x",
      getToken: async () => "t",
      fetch,
    })
      .request("/me/check-ins")
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 409,
      message: "You are already checked in to this service",
    });
  });

  it("calls onUnauthorized when the session has expired", async () => {
    const onUnauthorized = vi.fn();
    const fetch = vi.fn(async () => json({ message: "Session expired" }, 401));
    await createApi({
      baseUrl: "http://x",
      getToken: async () => "t",
      fetch,
      onUnauthorized,
    })
      .request("/me/member")
      .catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it("explains a network failure in plain words", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("Network request failed");
    });
    const err = await createApi({
      baseUrl: "http://x",
      getToken: async () => null,
      fetch,
    })
      .request("/x")
      .catch((e) => e);
    expect(err).toMatchObject({
      status: 0,
      message:
        "Can't reach the church server. Check your connection and try again.",
    });
  });

  it("returns undefined for 204 responses", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    expect(
      await createApi({
        baseUrl: "http://x",
        getToken: async () => null,
        fetch,
      }).request("/x"),
    ).toBeUndefined();
  });
});
