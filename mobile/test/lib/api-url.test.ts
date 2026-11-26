import { describe, expect, it } from "vitest";
import { resolveApiUrl } from "../../src/lib/api-url";

describe("resolveApiUrl", () => {
  it("uses EXPO_PUBLIC_API_URL when it is set", () => {
    expect(
      resolveApiUrl({
        envUrl: "https://api.grace.church",
        hostUri: "192.168.5.53:8081",
        platform: "ios",
      }),
    ).toBe("https://api.grace.church");
  });

  it("on a phone in development, reaches the API on the same computer that serves the app", () => {
    expect(
      resolveApiUrl({ hostUri: "192.168.5.53:8081", platform: "android" }),
    ).toBe("http://192.168.5.53:4000");
    expect(
      resolveApiUrl({ hostUri: "192.168.5.53:8081/--/path", platform: "ios" }),
    ).toBe("http://192.168.5.53:4000");
  });

  it("falls back to the emulator and simulator defaults without a dev host", () => {
    expect(resolveApiUrl({ platform: "android" })).toBe("http://10.0.2.2:4000");
    expect(resolveApiUrl({ platform: "ios" })).toBe("http://localhost:4000");
    expect(resolveApiUrl({ hostUri: "localhost:8081", platform: "web" })).toBe(
      "http://localhost:4000",
    );
  });

  it("ignores a tunnel host, which cannot reach the local API", () => {
    expect(
      resolveApiUrl({
        hostUri: "abc-anonymous-8081.exp.direct",
        platform: "ios",
      }),
    ).toBe("http://localhost:4000");
  });
});
