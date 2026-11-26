import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CipherReveal } from "@/features/landing/cipher-reveal";

describe("CipherReveal", () => {
  it("gives the heading the real text as its accessible name", () => {
    render(
      <h1>
        <CipherReveal text="A place to belong." />
      </h1>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "A place to belong." })).toBeInTheDocument();
  });

  it("hides the animated glyphs from assistive technology", () => {
    const { container } = render(<CipherReveal text="Hi" />);
    const visual = container.querySelector("[data-cipher-visual]");
    expect(visual).toHaveAttribute("aria-hidden", "true");
  });
});
