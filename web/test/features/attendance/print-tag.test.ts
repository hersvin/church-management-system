import { describe, expect, it } from "vitest";
import { tagHtml } from "@/features/attendance/print-tag";

describe("tagHtml", () => {
  const tag = { child: "Ada Okafor", code: "K7RQX", gathering: "Sunday Worship 9 AM", careNote: "Peanut allergy" };

  it("prints a child tag and a matching guardian stub with the same code", () => {
    const html = tagHtml(tag);
    expect(html.match(/K7R-QX/g)).toHaveLength(2);
    expect(html).toContain("Ada Okafor");
    expect(html).toContain("Peanut allergy");
  });

  it("escapes names so they cannot inject markup", () => {
    const html = tagHtml({ ...tag, child: `<img src=x onerror="alert(1)">` });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
