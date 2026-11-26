import { publicVideosSchema } from "@cms/shared";
import { describe, expect, it, vi } from "vitest";
import { parseYoutubeFeed, YoutubeFeed } from "./youtube";

const undici = vi.hoisted(() => ({
  fetch: vi.fn(),
  EnvHttpProxyAgent: vi.fn(function (this: { kind: string }) {
    this.kind = "env-proxy-agent";
  }),
}));
vi.mock("undici", () => undici);

const entry = (id: string, title: string, published: string) => `
 <entry>
  <id>yt:video:${id}</id>
  <yt:videoId>${id}</yt:videoId>
  <title>${title}</title>
  <published>${published}</published>
  <media:group>
   <media:thumbnail url="https://evil.example/${id}.jpg" width="480" height="360"/>
  </media:group>
 </entry>`;

const feed = (...entries: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Grace Testament Church</title>
 <published>2013-10-23T07:03:54+00:00</published>
 ${entries.join("")}
</feed>`;

describe("parseYoutubeFeed", () => {
  it("reads videos newest first, ignoring the channel's own title and date", () => {
    const videos = parseYoutubeFeed(
      feed(
        entry("PoRMxoVmbNE", "I Believe Season 3 Part 2", "2026-11-12T13:00:43+00:00"),
        entry("AbCdEfGhIj0", "I Believe Season 3 Part 3", "2026-11-16T11:45:11+00:00"),
      ),
    );
    expect(videos.map((v) => v.title)).toEqual(["I Believe Season 3 Part 3", "I Believe Season 3 Part 2"]);
    expect(videos[0]).toEqual({
      id: "AbCdEfGhIj0",
      title: "I Believe Season 3 Part 3",
      publishedAt: "2026-11-16T11:45:11+00:00",
      thumbnail: "https://i.ytimg.com/vi/AbCdEfGhIj0/hqdefault.jpg",
    });
    expect(publicVideosSchema.parse({ channelUrl: null, videos })).toBeTruthy();
  });

  it("builds thumbnails from the video ID, never from the feed's URL", () => {
    const [video] = parseYoutubeFeed(feed(entry("AbCdEfGhIj0", "A", "2026-11-16T11:45:11+00:00")));
    expect(video.thumbnail).not.toContain("evil.example");
  });

  it("decodes XML entities in titles", () => {
    const [video] = parseYoutubeFeed(feed(entry("AbCdEfGhIj0", "Faith &amp; Hope &quot;Live&quot; &#39;26 &lt;3", "2026-11-16T11:45:11+00:00")));
    expect(video.title).toBe(`Faith & Hope "Live" '26 <3`);
  });

  it("skips entries with a malformed ID or date, and caps the count", () => {
    const videos = parseYoutubeFeed(
      feed(
        entry("bad id!", "Broken", "2026-11-16T11:45:11+00:00"),
        entry("AbCdEfGhIj1", "No date", "yesterday"),
        ...Array.from({ length: 6 }, (_, i) => entry(`AbCdEfGhIj${i + 2}`, `V${i}`, `2026-11-0${i + 1}T00:00:00+00:00`)),
      ),
      4,
    );
    expect(videos.map((v) => v.title)).toEqual(["V5", "V4", "V3", "V2"]);
  });

  it("returns nothing for something that is not a feed", () => {
    expect(parseYoutubeFeed("<html>not found</html>")).toEqual([]);
  });
});

describe("YoutubeFeed", () => {
  it("requests the channel feed from YouTube through an agent that honors HTTPS_PROXY and NO_PROXY", async () => {
    undici.fetch.mockResolvedValue({ ok: true, text: async () => "<feed></feed>" });
    const xml = await new YoutubeFeed().fetchXml("UCcC2zfFwZ8WF4NhCk5yYs2g");
    expect(xml).toBe("<feed></feed>");
    const [url, init] = undici.fetch.mock.calls[0];
    expect(url).toBe("https://www.youtube.com/feeds/videos.xml?channel_id=UCcC2zfFwZ8WF4NhCk5yYs2g");
    expect(init.dispatcher).toBeInstanceOf(undici.EnvHttpProxyAgent);
  });

  it("fails on a non-success status so the caller keeps its cached list", async () => {
    undici.fetch.mockResolvedValue({ ok: false, status: 503, text: async () => "" });
    await expect(new YoutubeFeed().fetchXml("UCcC2zfFwZ8WF4NhCk5yYs2g")).rejects.toThrow("503");
  });
});
