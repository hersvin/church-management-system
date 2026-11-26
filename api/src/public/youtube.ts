import { Injectable } from "@nestjs/common";
import { youtubeVideoIdSchema, type PublicVideo } from "@cms/shared";
import { EnvHttpProxyAgent, fetch } from "undici";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });

const tag = (xml: string, name: string) => {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  return match ? decode(match[1].trim()) : null;
};

/**
 * Videos from a YouTube channel's public Atom feed, newest first. Only entries with a valid
 * video ID and date are kept; thumbnails are rebuilt from the ID so no URL from the feed is trusted.
 */
export function parseYoutubeFeed(xml: string, limit = 15): PublicVideo[] {
  const videos: PublicVideo[] = [];
  for (const [, body] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = tag(body, "yt:videoId");
    const title = tag(body, "title");
    const published = tag(body, "published");
    if (!id || !youtubeVideoIdSchema.safeParse(id).success || !title || !published || Number.isNaN(Date.parse(published))) continue;
    videos.push({ id, title, publishedAt: published, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` });
  }
  return videos.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, limit);
}

/**
 * Fetches a channel's feed from the fixed YouTube host only; the caller validates the channel ID.
 * Requests go through HTTPS_PROXY or HTTP_PROXY when set (and skip it for hosts in NO_PROXY), so
 * the feed also loads on networks that only reach the internet through a proxy.
 */
@Injectable()
export class YoutubeFeed {
  private readonly agent = new EnvHttpProxyAgent();

  async fetchXml(channelId: string): Promise<string> {
    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/atom+xml" },
      dispatcher: this.agent,
    });
    if (!response.ok) throw new Error(`YouTube feed returned ${response.status}`);
    return response.text();
  }
}
