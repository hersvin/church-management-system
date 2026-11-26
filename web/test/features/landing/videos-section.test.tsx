import type { PublicVideo } from "@cms/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VideosSection } from "@/features/landing/videos-section";

const video = (n: number, day: number): PublicVideo => ({
  id: `AbCdEfGhIj${n}`,
  title: `I Believe Part ${n}`,
  publishedAt: `2026-11-${String(day).padStart(2, "0")}T11:45:11+00:00`,
  thumbnail: `https://i.ytimg.com/vi/AbCdEfGhIj${n}/hqdefault.jpg`,
});
const videos = [video(1, 16), video(2, 12), video(3, 5), video(4, 4)];
const CHANNEL = "https://www.youtube.com/channel/UCcC2zfFwZ8WF4NhCk5yYs2g";

describe("VideosSection", () => {
  it("features the newest video and lists the next three", () => {
    render(<VideosSection videos={videos} channelUrl={CHANNEL} />);
    expect(screen.getByRole("button", { name: "Play I Believe Part 1" })).toBeInTheDocument();
    const recent = screen.getByRole("list", { name: "Recent videos" });
    expect(within(recent).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("I Believe Part 2"),
      expect.stringContaining("I Believe Part 3"),
      expect.stringContaining("I Believe Part 4"),
    ]);
    expect(screen.getByRole("link", { name: /see all on youtube/i })).toHaveAttribute("href", CHANNEL);
  });

  it("loads no YouTube player until a visitor presses play, then uses the privacy-enhanced domain", async () => {
    const { container } = render(<VideosSection videos={videos} channelUrl={CHANNEL} />);
    expect(container.querySelector("iframe")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Play I Believe Part 1" }));
    const frame = screen.getByTitle("I Believe Part 1");
    expect(frame.getAttribute("src")).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/AbCdEfGhIj1\?/);
  });

  it("moves a recent video into the player when chosen", async () => {
    render(<VideosSection videos={videos} channelUrl={CHANNEL} />);
    await userEvent.click(screen.getByRole("button", { name: /watch i believe part 3/i }));
    expect(screen.getByTitle("I Believe Part 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /watch i believe part 3/i })).toHaveAttribute("aria-current", "true");
  });

  it("shows labelled placeholders when there are no videos yet", () => {
    render(<VideosSection videos={[]} channelUrl={null} />);
    expect(screen.getAllByRole("img", { name: /photo placeholder/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^play /i })).not.toBeInTheDocument();
  });
});
