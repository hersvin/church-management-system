import { render, screen, waitFor } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { AnimatedNumber, FadeIn, Stagger, StaggerItem } from "@/components/motion/index";

describe("motion primitives", () => {
  it("FadeIn renders its children", () => {
    render(<FadeIn>Hello</FadeIn>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("Stagger renders every item", () => {
    render(
      <Stagger>
        <StaggerItem>One</StaggerItem>
        <StaggerItem>Two</StaggerItem>
      </Stagger>,
    );
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
  });

  it("AnimatedNumber shows the final value immediately when motion is reduced", () => {
    render(
      <MotionConfig reducedMotion="always">
        <AnimatedNumber value={1234} />
      </MotionConfig>,
    );
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("AnimatedNumber counts up to the target value", async () => {
    render(<AnimatedNumber value={42} duration={0.05} />);
    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument(), { timeout: 2000 });
  });

  it("AnimatedNumber exposes the real value to assistive technology", () => {
    render(<AnimatedNumber value={7} />);
    expect(screen.getByLabelText("7")).toBeInTheDocument();
  });
});
