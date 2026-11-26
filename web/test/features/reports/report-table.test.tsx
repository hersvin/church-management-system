import type { Report } from "@cms/shared";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportTable } from "@/features/reports/report-table";

const report: Report = {
  kind: "events",
  from: "2026-11-01",
  to: "2026-11-30",
  branchId: null,
  columns: [
    { key: "event", label: "Event", kind: "text" },
    { key: "turnout", label: "Turnout %", kind: "percent" },
  ],
  rows: [
    { event: "Food Drive", turnout: 75 },
    { event: "Prayer Night", turnout: null },
  ],
  summary: [
    { label: "Events", value: 2, kind: "number" },
    { label: "Average turnout", value: 75, kind: "percent" },
  ],
};

describe("ReportTable", () => {
  it("renders the summary and a row per item with formatted values", () => {
    render(<ReportTable report={report} />);
    expect(screen.getByText("Average turnout")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Event", "Turnout %"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(["Food Drive75%", "Prayer Night--"]);
  });

  it("shows an empty state with no rows", () => {
    render(<ReportTable report={{ ...report, rows: [] }} />);
    expect(screen.getByText("Nothing in this range.")).toBeInTheDocument();
  });
});
