import { describe, expect, it } from "vitest";
import { embedUrl, isVideoId, watchUrl } from "../../src/lib/youtube";

describe("youtube", () => {
  it("accepts only YouTube video IDs", () => {
    expect(isVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isVideoId("abc")).toBe(false);
    expect(isVideoId("dQw4w9WgXcQ&autoplay=1")).toBe(false);
    expect(isVideoId(undefined)).toBe(false);
  });

  it("builds the official embed player, which counts as a YouTube view", () => {
    expect(embedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1&rel=0&modestbranding=1&fs=1",
    );
    expect(watchUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });
});
