import { describe, expect, it } from "vitest";
import { initials, photoUrl } from "../../src/lib/photo";

describe("profile photo helpers", () => {
  it("builds a cache-busting photo address, or none without a photo", () => {
    expect(
      photoUrl("http://192.168.137.1:4000", "2026-11-26T03:00:00.000Z"),
    ).toBe("http://192.168.137.1:4000/me/photo?v=2026-11-26T03%3A00%3A00.000Z");
    expect(photoUrl("http://api", null)).toBeNull();
  });

  it("makes initials for the placeholder", () => {
    expect(initials("Ngozi", "Okafor")).toBe("NO");
    expect(initials("system", "")).toBe("S");
    expect(initials("", "")).toBe("?");
  });
});
