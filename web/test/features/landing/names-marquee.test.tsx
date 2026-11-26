import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { NamesMarquee } from "@/features/landing/names-marquee";

const rows = [
  ["Emmanuel", "Prince of Peace"],
  ["King of Kings", "Lamb of God"],
  ["The Way", "Bread of Life"],
];

describe("NamesMarquee", () => {
  it("reads every name once, in order, while the moving rows stay hidden from assistive tech", () => {
    const { container } = render(<NamesMarquee rows={rows} label="Names of Jesus" />);
    const list = screen.getByRole("list", { name: "Names of Jesus" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(rows.flat());
    const moving = container.querySelectorAll(".lp-marqueeRow");
    expect(moving).toHaveLength(rows.length);
    moving.forEach((row) => expect(row.closest("[aria-hidden='true']")).not.toBeNull());
  });

  it("repeats each row so the loop has no seam", () => {
    const { container } = render(<NamesMarquee rows={rows} label="Names of Jesus" />);
    const first = container.querySelector(".lp-marqueeRow")!;
    expect(first.querySelectorAll(".lp-marqueeSet")).toHaveLength(2);
    expect(first.querySelectorAll(".lp-marqueeName").length).toBeGreaterThanOrEqual(rows[0].length * 2);
  });

  it("can be paused", async () => {
    render(<NamesMarquee rows={rows} label="Names of Jesus" />);
    await userEvent.click(screen.getByRole("button", { name: "Pause names of Jesus" }));
    expect(screen.getByRole("button", { name: "Play names of Jesus" })).toHaveAttribute("aria-pressed", "true");
  });

  it("stands still, with no pause control, for visitors who ask for less motion", () => {
    render(
      <MotionConfig reducedMotion="always">
        <NamesMarquee rows={rows} label="Names of Jesus" />
      </MotionConfig>,
    );
    expect(screen.queryByRole("button", { name: /names of jesus/i })).not.toBeInTheDocument();
  });
});
