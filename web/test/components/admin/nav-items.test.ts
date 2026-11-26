import { describe, expect, it } from "vitest";
import { breadcrumb, navGroups, searchNav, visibleNavItems } from "@/components/admin/nav-items";

describe("visibleNavItems", () => {
  it("always shows the dashboard", () => {
    expect(visibleNavItems([]).map((i) => i.href)).toEqual(["/dashboard"]);
  });

  it("shows items whose permission the user holds", () => {
    const hrefs = visibleNavItems(["users.read", "branches.read"]).map((i) => i.href);
    expect(hrefs).toContain("/users");
    expect(hrefs).toContain("/branches");
    expect(hrefs).not.toContain("/audit");
  });

  it("opens attendance and check-in to people who can read attendance", () => {
    const item = visibleNavItems(["attendance.read"]).find((i) => i.href === "/attendance");
    expect(item).toBeDefined();
    expect(item?.comingSoon).toBeFalsy();
  });

  it("opens reports to people who can read reports", () => {
    const item = visibleNavItems(["reports.read"]).find((i) => i.href === "/reports");
    expect(item).toBeDefined();
    expect(item?.comingSoon).toBeFalsy();
  });
});

describe("navGroups", () => {
  it("groups visible items under labels, in sidebar order, dropping empty groups", () => {
    const groups = navGroups(visibleNavItems(["members.read", "events.read", "users.read"]));
    expect(groups.map((g) => [g.label, g.items.map((i) => i.href)])).toEqual([
      ["Overview", ["/dashboard"]],
      ["People", ["/members", "/households"]],
      ["Gatherings", ["/events"]],
      ["Administration", ["/users"]],
    ]);
  });
});

describe("breadcrumb", () => {
  it("names the module and marks deeper pages", () => {
    expect(breadcrumb("/members")).toEqual({ module: "Members", href: "/members", detail: null });
    expect(breadcrumb("/school/classes/abc")).toEqual({ module: "School", href: "/school", detail: "Class" });
    expect(breadcrumb("/attendance/services/abc")).toEqual({ module: "Attendance", href: "/attendance", detail: "Service" });
    expect(breadcrumb("/members/abc")).toEqual({ module: "Members", href: "/members", detail: "Details" });
  });

  it("names fixed subpages", () => {
    expect(breadcrumb("/events/design").detail).toBe("Calendar image");
    expect(breadcrumb("/events/123").detail).toBe("Event");
  });

  it("falls back to the dashboard for unknown paths", () => {
    expect(breadcrumb("/nowhere").module).toBe("Dashboard");
  });
});

describe("searchNav", () => {
  it("matches titles and keywords without caring about case", () => {
    const items = visibleNavItems(["members.read", "attendance.read", "reports.read", "rooms.read"]);
    expect(searchNav(items, "kids").map((i) => i.href)).toEqual(["/attendance"]);
    expect(searchNav(items, "MEM").map((i) => i.href)).toEqual(["/members"]);
    expect(searchNav(items, "csv").map((i) => i.href)).toEqual(["/reports"]);
    expect(searchNav(items, "").length).toBe(items.filter((i) => !i.comingSoon).length);
  });
});
