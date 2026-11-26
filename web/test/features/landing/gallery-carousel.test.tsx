import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { LANDING } from "@/features/landing/content";
import { GalleryCarousel } from "@/features/landing/gallery-carousel";

const items = LANDING.gallery;

describe("GalleryCarousel", () => {
  it("announces each photo once, even though the loop repeats them", () => {
    render(<GalleryCarousel items={items} />);
    const list = screen.getByRole("list", { name: /a week at grace/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(items.length);
    expect(within(list).getAllByRole("img", { name: /photo placeholder/i })).toHaveLength(items.length);
  });

  it("gives the moving row a pause control", async () => {
    render(<GalleryCarousel items={items} />);
    const toggle = screen.getByRole("button", { name: /pause photos/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: /play photos/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("stands still as a plain grid when the visitor asks for less motion", () => {
    render(
      <MotionConfig reducedMotion="always">
        <GalleryCarousel items={items} />
      </MotionConfig>,
    );
    expect(screen.queryByRole("button", { name: /photos/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(items[0].title)).toHaveLength(1);
  });
});
