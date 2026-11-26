import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CheckIcon, HouseIcon, SearchIcon } from "@/components/icons";

describe("icons", () => {
  it("renders an svg that accepts className, like lucide did", () => {
    const { container } = render(<SearchIcon className="size-4 text-muted-foreground" />);
    const svg = container.querySelector("svg")!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("class")).toBe("size-4 text-muted-foreground");
    expect(container.firstElementChild).toBe(svg);
  });

  it("is hidden from assistive technology by default", () => {
    const { container } = render(<HouseIcon />);
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("becomes a labelled image when given an aria-label", () => {
    const { getByRole } = render(<CheckIcon aria-label="Approved" />);
    const img = getByRole("img", { name: "Approved" });
    expect(img.getAttribute("aria-hidden")).toBeNull();
  });

  it("supports the size prop and follows currentColor", () => {
    const { container } = render(<CheckIcon size={32} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.innerHTML).toContain("currentColor");
  });
});
