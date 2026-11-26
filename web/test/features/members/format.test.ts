import { describe, expect, it } from "vitest";
import { ageFrom, buildMemberQuery, fullName, initials, statusTone } from "@/features/members/format";

describe("member formatting", () => {
  it("builds a full name with optional middle name and suffix", () => {
    expect(fullName({ firstName: "Ana", lastName: "Cruz" })).toBe("Ana Cruz");
    expect(fullName({ firstName: "Juan", middleName: "Dela", lastName: "Cruz", suffix: "Jr." })).toBe(
      "Juan Dela Cruz Jr.",
    );
  });

  it("derives initials", () => {
    expect(initials({ firstName: "ana", lastName: "cruz" })).toBe("AC");
  });

  it("computes age in whole years", () => {
    const now = new Date("2026-11-24T00:00:00Z");
    expect(ageFrom("2000-11-25", now)).toBe(25);
    expect(ageFrom("2000-11-24", now)).toBe(26);
    expect(ageFrom(null, now)).toBeNull();
  });

  it("maps each status to a badge tone", () => {
    expect(statusTone("MEMBER")).toBe("default");
    expect(statusTone("REGULAR")).toBe("secondary");
    expect(statusTone("VISITOR")).toBe("outline");
    expect(statusTone("INACTIVE")).toBe("muted");
  });

  it("builds a list query string without empty values", () => {
    expect(buildMemberQuery({ page: 2, pageSize: 20, search: " ana ", status: undefined })).toBe(
      "page=2&pageSize=20&search=ana",
    );
    expect(buildMemberQuery({ page: 1, pageSize: 20, search: "", status: "MEMBER" })).toBe(
      "page=1&pageSize=20&status=MEMBER",
    );
  });
});
