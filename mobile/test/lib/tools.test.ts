import { describe, expect, it } from "vitest";
import { TOOLS, findTool } from "../../src/lib/tools";

describe("tools", () => {
  it("lists three tools, each with a unique id, a label, a description, and an icon", () => {
    expect(TOOLS).toHaveLength(3);
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(3);
    for (const tool of TOOLS) {
      expect(tool.id).toMatch(/^[a-z0-9-]+$/);
      expect(tool.label.trim()).not.toBe("");
      expect(tool.description.trim()).not.toBe("");
      expect(tool.icon).toBeTruthy();
    }
  });

  it("finds a tool by id, and nothing for an unknown id", () => {
    expect(findTool(TOOLS[0].id)).toBe(TOOLS[0]);
    expect(findTool("missing")).toBeUndefined();
    expect(findTool(undefined)).toBeUndefined();
  });
});

describe("music library tool", () => {
  it("is the first tool and opens the Music Library screen", () => {
    expect(TOOLS[0]).toMatchObject({
      id: "music-library",
      label: "Music Library",
      icon: "music",
      href: "/music/library",
    });
  });
});
