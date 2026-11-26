import { describe, expect, it } from "vitest";
import { classifyScan } from "../../src/lib/qr";

const base64url = (text: string) =>
  btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const token = (payload: object) =>
  `cmsqr1.${base64url(JSON.stringify(payload))}.sig`;

describe("classifyScan", () => {
  it("recognizes service and member codes from their payload", () => {
    expect(classifyScan(token({ t: "service", id: "s1", exp: 1 }))).toEqual({
      kind: "service",
      token: token({ t: "service", id: "s1", exp: 1 }),
    });
    expect(
      classifyScan(token({ t: "member", id: "m1", v: 0, exp: 1 })).kind,
    ).toBe("member");
  });

  it("treats anything else as unknown, without throwing", () => {
    expect(classifyScan("https://example.com").kind).toBe("unknown");
    expect(classifyScan("cmsqr1.@@@.sig").kind).toBe("unknown");
    expect(classifyScan(`cmsqr1.${"x".repeat(5000)}.sig`).kind).toBe("unknown");
    expect(classifyScan("").kind).toBe("unknown");
  });
});
