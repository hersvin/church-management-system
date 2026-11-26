import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileCard } from "@/features/landing/profile-card";

describe("ProfileCard", () => {
  const base = { name: "Ruth Mendoza", title: "Main Campus Pastor", status: "Main Campus" };

  it("shows the name as a heading with the role and campus", () => {
    render(<ProfileCard {...base} />);
    expect(screen.getByRole("heading", { level: 3, name: "Ruth Mendoza" })).toBeInTheDocument();
    expect(screen.getByText("Main Campus Pastor")).toBeInTheDocument();
    expect(screen.getByText("Main Campus")).toBeInTheDocument();
  });

  it("shows a labelled placeholder with initials until a portrait is supplied", () => {
    render(<ProfileCard {...base} />);
    expect(screen.getByRole("img", { name: /photo placeholder: portrait of ruth mendoza/i })).toHaveTextContent("RM");
  });

  it("uses the portrait when there is one, described by the person's name", () => {
    render(<ProfileCard {...base} avatarUrl="/staff/ruth.jpg" />);
    expect(screen.getByRole("img", { name: "Ruth Mendoza" })).toHaveAttribute("src", "/staff/ruth.jpg");
  });

  it("makes Contact an email link that names the person", () => {
    render(<ProfileCard {...base} contactHref="mailto:hello@cms.local?subject=For%20Ruth%20Mendoza" />);
    const link = screen.getByRole("link", { name: "Contact Ruth Mendoza" });
    expect(link).toHaveAttribute("href", "mailto:hello@cms.local?subject=For%20Ruth%20Mendoza");
  });

  it("puts nothing in the tab order besides the contact link", () => {
    const { container } = render(<ProfileCard {...base} contactHref="mailto:a@b.c" />);
    expect(container.querySelectorAll("a, button, [tabindex]")).toHaveLength(1);
  });
});
