import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusGlyph } from "@/components/status-glyph";

describe("StatusGlyph", () => {
  it("draws each state as an ink shape with an explicit viewBox", () => {
    const { container } = render(
      <>
        <StatusGlyph state="done" />
        <StatusGlyph state="active" />
        <StatusGlyph state="waiting" />
        <StatusGlyph state="off" />
        <StatusGlyph state="failed" />
      </>,
    );
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(5);
    for (const svg of svgs) expect(svg.getAttribute("viewBox")).toBe("0 0 12 12");
    expect(svgs[3].querySelector("[stroke-dasharray]")).not.toBeNull();
  });

  it("is hidden from screen readers unless it carries the meaning on its own", () => {
    const { container } = render(<StatusGlyph state="done" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    render(<StatusGlyph state="failed" label="Failed" />);
    expect(screen.getByRole("img", { name: "Failed" })).toBeInTheDocument();
  });

  it("keeps red for failures only", () => {
    const { container } = render(
      <>
        <StatusGlyph state="done" />
        <StatusGlyph state="failed" />
      </>,
    );
    const [done, failed] = container.querySelectorAll("svg");
    expect(done.getAttribute("class")).not.toMatch(/destructive/);
    expect(failed.getAttribute("class")).toMatch(/text-destructive/);
  });
});
