import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LANDING } from "@/features/landing/content";
import { LandingPage } from "@/features/landing/landing-page";

describe("LandingPage", () => {
  it("states what the page is in one main heading", () => {
    render(<LandingPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(LANDING.hero.title);
  });

  it("offers the visit action and a way for staff to sign in", () => {
    render(<LandingPage />);
    expect(screen.getAllByRole("link", { name: /plan (a|your first) visit/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /staff sign in/i })[0]).toHaveAttribute("href", "/login");
  });

  it("replaces the questions section with the church's videos", () => {
    render(<LandingPage />);
    expect(screen.queryByRole("heading", { name: /questions people ask/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: LANDING.videos.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Watch" })).toHaveAttribute("href", "#watch");
    const channel = screen.getByRole("link", { name: /@gtcphofficial/i });
    expect(channel).toHaveAttribute("href", "https://www.youtube.com/@gtcphofficial");
    expect(channel).toHaveAttribute("target", "_blank");
    // Even before any video loads, the button goes to the channel.
    expect(screen.getByRole("link", { name: /see all on youtube/i })).toHaveAttribute("href", "https://www.youtube.com/@gtcphofficial");
  });

  it("lists room plans in order from smallest to largest", () => {
    render(<LandingPage />);
    const list = screen.getByRole("list", { name: /room hire/i });
    const names = within(list)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(names).toEqual(LANDING.rooms.plans.map((p) => p.name));
  });

  it("labels placeholder photos so no one mistakes them for real ones", () => {
    render(<LandingPage />);
    // Hero, carousel, and photo wall (each photo once), the video placeholders until videos load,
    // and a portrait placeholder on each team card.
    expect(screen.getAllByRole("img", { name: /photo placeholder/i })).toHaveLength(
      1 + 2 * LANDING.gallery.length + 4 + LANDING.team.people.length,
    );
  });

  it("shows the team as profile cards with a contact link for each person", () => {
    render(<LandingPage />);
    for (const p of LANDING.team.people) {
      expect(screen.getByRole("heading", { level: 3, name: p.name })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: `Contact ${p.name}` }).getAttribute("href")).toMatch(/^mailto:/);
    }
  });

  it("shows a drifting photo wall beside the first-visit steps", () => {
    render(<LandingPage />);
    const wall = screen.getByRole("group", { name: "Photos from church life" });
    expect(within(wall).getAllByRole("img")).toHaveLength(LANDING.gallery.length);
    expect(screen.getByRole("button", { name: "Pause photos from church life" })).toHaveAttribute("aria-pressed", "false");
  });
});
