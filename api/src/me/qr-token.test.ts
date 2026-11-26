import { describe, expect, it } from "vitest";
import { QrTokens } from "./qr-token";

const SECRET = "s".repeat(32);
const NOW = new Date("2026-11-29T00:00:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const ID = "11111111-1111-4111-8111-111111111111";

describe("QrTokens", () => {
  const qr = new QrTokens(SECRET);

  it("signs and reads a service token until it expires", () => {
    const token = qr.sign({ type: "service", id: ID }, later(60));
    expect(token.startsWith("cmsqr1.")).toBe(true);
    expect(qr.verify(token, "service", NOW)).toEqual({ type: "service", id: ID, version: undefined, expiresAt: later(60) });
    expect(qr.verify(token, "service", later(61))).toBeNull();
  });

  it("carries a version for member tokens so they can be revoked", () => {
    const token = qr.sign({ type: "member", id: ID, version: 3 }, later(60));
    expect(qr.verify(token, "member", NOW)?.version).toBe(3);
  });

  it("rejects a token of the other type", () => {
    const token = qr.sign({ type: "member", id: ID, version: 0 }, later(60));
    expect(qr.verify(token, "service", NOW)).toBeNull();
  });

  it("rejects tampered, foreign, and malformed tokens", () => {
    const token = qr.sign({ type: "service", id: ID }, later(60));
    const [prefix, body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ t: "service", id: "22222222-2222-4222-8222-222222222222", exp: later(60).getTime() })).toString("base64url");
    expect(qr.verify(`${prefix}.${forged}.${sig}`, "service", NOW)).toBeNull();
    expect(qr.verify(new QrTokens("o".repeat(32)).sign({ type: "service", id: ID }, later(60)), "service", NOW)).toBeNull();
    expect(qr.verify(`${prefix}.${body}`, "service", NOW)).toBeNull();
    expect(qr.verify("cmsqr1.not-json.abc", "service", NOW)).toBeNull();
    expect(qr.verify("hello", "service", NOW)).toBeNull();
  });

  it("refuses a short secret", () => {
    expect(() => new QrTokens("short")).toThrow();
  });
});
