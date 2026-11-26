import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/cms",
  JWT_SECRET: "a".repeat(32),
  WEB_ORIGIN: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("applies defaults", () => {
    const env = parseEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.JWT_EXPIRES_IN_SECONDS).toBe(28800);
  });

  it("rejects a short JWT secret", () => {
    expect(() => parseEnv({ ...base, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });

  it("does not echo secret values in the error", () => {
    expect.assertions(1);
    try {
      parseEnv({ ...base, JWT_SECRET: "leakysecret" });
    } catch (error) {
      expect(String(error)).not.toContain("leakysecret");
    }
  });
});

describe("CORS origins", () => {
  const minimal = { DATABASE_URL: "postgresql://u:p@localhost:5432/cms", JWT_SECRET: "t".repeat(32), WEB_ORIGIN: "http://localhost:3002" };

  it("allows only the web origin by default", () => {
    expect(parseEnv(minimal).CORS_ORIGINS).toEqual(["http://localhost:3002"]);
  });

  it("adds extra origins from a comma-separated list, for example the Expo web preview", () => {
    expect(parseEnv({ ...minimal, EXTRA_CORS_ORIGINS: "http://localhost:8081, http://192.168.1.5:8081" }).CORS_ORIGINS).toEqual([
      "http://localhost:3002",
      "http://localhost:8081",
      "http://192.168.1.5:8081",
    ]);
  });

  it("rejects anything that is not a URL", () => {
    expect(() => parseEnv({ ...minimal, EXTRA_CORS_ORIGINS: "*" })).toThrow(/EXTRA_CORS_ORIGINS/);
  });
});
