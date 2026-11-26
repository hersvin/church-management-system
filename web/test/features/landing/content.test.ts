import { describe, expect, it } from "vitest";
import { LANDING } from "@/features/landing/content";

const allCopy = JSON.stringify(LANDING);

describe("landing content", () => {
  it("names the church and the hero title", () => {
    expect(LANDING.church.name).toBe("Grace Community Church");
    expect(LANDING.hero.title).toBe("Where Lives Change");
  });

  it("has the counts the page design calls for", () => {
    expect(LANDING.nav).toHaveLength(4);
    expect(LANDING.ministries.items).toHaveLength(6);
    expect(LANDING.gallery).toHaveLength(4);
    expect(LANDING.steps).toHaveLength(5);
    expect(LANDING.team.people).toHaveLength(4);
    expect(LANDING.rooms.plans).toHaveLength(3);
    expect(LANDING.videos.title).toBeTruthy();
    expect(LANDING.footer.columns).toHaveLength(3);
    expect(LANDING.footer.social.length).toBeGreaterThan(0);
  });

  it("orders room plans from the smallest to the largest", () => {
    const capacities = LANDING.rooms.plans.map((p) => p.capacity);
    const rates = LANDING.rooms.plans.map((p) => p.ratePerHour);
    expect(capacities).toEqual([...capacities].sort((a, b) => a - b));
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
  });

  it("lists every campus with an address and a service time", () => {
    expect(LANDING.campuses.map((c) => c.name)).toEqual(["Main Campus", "North Campus", "South Campus"]);
    for (const c of LANDING.campuses) {
      expect(c.address.length).toBeGreaterThan(0);
      expect(c.services.length).toBeGreaterThan(0);
    }
  });

  it("points in-page links at sections that exist", () => {
    const ids = new Set<string>(Object.values(LANDING.sectionIds));
    const anchors = [...LANDING.nav, ...LANDING.footer.columns.flatMap((c) => c.links)]
      .map((l) => l.href)
      .filter((h) => h.startsWith("#"));
    for (const href of anchors) expect(ids.has(href.slice(1)), href).toBe(true);
  });

  it("follows the writing rules: no em dashes, no Latin abbreviations", () => {
    expect(allCopy.includes(String.fromCharCode(0x2014))).toBe(false);
    expect(allCopy).not.toMatch(/\b(e\.g\.|i\.e\.|etc\.)/i);
  });

  it("marks placeholder photos and sample data honestly", () => {
    for (const g of LANDING.gallery) expect(g.placeholder).toBe(true);
    expect(LANDING.rooms.note).toMatch(/sample/i);
    expect(LANDING.team.note).toMatch(/sample/i);
  });
});
