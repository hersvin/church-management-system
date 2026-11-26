import { MINISTRY_CATEGORIES } from "@cms/shared";
import { describe, expect, it } from "vitest";
import { CATEGORY_META, leadersLine, POSITION_LABELS } from "@/features/ministries/format";

describe("ministry formatting", () => {
  it("has a label and accent for every category", () => {
    for (const category of MINISTRY_CATEGORIES) {
      expect(CATEGORY_META[category].label).toBeTruthy();
      expect(CATEGORY_META[category].accent).toMatch(/^bg-/);
    }
  });

  it("labels positions", () => {
    expect(POSITION_LABELS.COLEADER).toBe("Co-leader");
  });

  it("summarizes leaders", () => {
    const leaders = [
      { position: "LEADER" as const, member: { firstName: "Elena", lastName: "Santos" } },
      { position: "COLEADER" as const, member: { firstName: "Grace", lastName: "Park" } },
    ];
    expect(leadersLine(leaders)).toBe("Led by Elena Santos, Grace Park");
    expect(leadersLine([])).toBe("No leader assigned");
  });
});
