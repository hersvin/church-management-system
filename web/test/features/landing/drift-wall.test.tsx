import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { DriftWall, type DriftItem } from "@/features/landing/drift-wall";

const items: DriftItem[] = ["Worship", "Kids", "Youth", "Outreach"].map((name) => ({
  id: name,
  content: <div role="img" aria-label={`Photo: ${name}`} />,
}));

describe("DriftWall", () => {
  it("announces each photo once, even though every column repeats", () => {
    render(<DriftWall items={items} columns={3} label="Church life" />);
    const wall = screen.getByRole("group", { name: "Church life" });
    expect(within(wall).getAllByRole("img").map((i) => i.getAttribute("aria-label"))).toEqual([
      "Photo: Worship",
      "Photo: Outreach",
      "Photo: Kids",
      "Photo: Youth",
    ]);
  });

  it("puts no tiles in the tab order, since they do nothing when activated", () => {
    const { container } = render(<DriftWall items={items} label="Church life" />);
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
  });

  it("gives the drifting wall a pause control", async () => {
    render(<DriftWall items={items} label="Church life" />);
    await userEvent.click(screen.getByRole("button", { name: "Pause church life" }));
    expect(screen.getByRole("button", { name: "Play church life" })).toHaveAttribute("aria-pressed", "true");
  });

  it("stands still with no pause control when the visitor asks for less motion", () => {
    render(
      <MotionConfig reducedMotion="always">
        <DriftWall items={items} label="Church life" />
      </MotionConfig>,
    );
    expect(screen.queryByRole("button", { name: /church life/i })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Church life" })).toHaveClass("drift-wall--reduced");
  });
});
