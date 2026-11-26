import { describe, expect, it } from "vitest";
import { isUsher, roleLabel, scanTab } from "../../src/lib/roles";

const usher = [{ name: "Usher" }];
const worship = [{ name: "Worship" }];

describe("roles", () => {
  it("treats anyone serving in the Usher ministry as an usher", () => {
    expect(isUsher(usher)).toBe(true);
    expect(isUsher([{ name: "usher" }, ...worship])).toBe(true);
    expect(isUsher(worship)).toBe(false);
    expect(isUsher([])).toBe(false);
    expect(isUsher(undefined)).toBe(false);
  });

  it("gives ushers the camera scanner and everyone else their QR card", () => {
    expect(scanTab(usher)).toEqual({
      mode: "scanner",
      title: "Scan",
      icon: "scan",
    });
    for (const ministries of [worship, [], undefined]) {
      expect(scanTab(ministries)).toEqual({
        mode: "card",
        title: "My QR",
        icon: "qr",
      });
    }
  });

  it("names roles for people", () => {
    expect(roleLabel("ADMIN")).toBe("Admin");
    expect(roleLabel("PASTOR")).toBe("Pastor");
  });
});
