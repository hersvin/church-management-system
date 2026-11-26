import { Injectable, Logger } from "@nestjs/common";
import type { CatalogSearchQuery, CatalogSong } from "@cms/shared";
import { EnvHttpProxyAgent, fetch } from "undici";
import { z } from "zod";

type Field = CatalogSearchQuery["field"];

const https = (value: unknown) => (typeof value === "string" && /^https:\/\//.test(value) ? value : null);
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const millis = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : null);

/** Apple's public iTunes Search API: free, no key. It has no musical key or tempo. */
export function itunesSearchUrl(term: string, field: Field): string {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", term);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "25");
  if (field === "title") url.searchParams.set("attribute", "songTerm");
  if (field === "artist") url.searchParams.set("attribute", "artistTerm");
  return url.toString();
}

const itunesPayload = z.object({ results: z.array(z.record(z.string(), z.unknown())) });

/** Songs only, each with Apple's numeric track ID and a title; links are kept only when they are https. */
export function parseItunes(payload: unknown): CatalogSong[] {
  const parsed = itunesPayload.safeParse(payload);
  if (!parsed.success) return [];
  const songs: CatalogSong[] = [];
  for (const r of parsed.data.results) {
    const id = typeof r.trackId === "number" && Number.isInteger(r.trackId) ? String(r.trackId) : null;
    const title = text(r.trackName);
    if (r.kind !== "song" || !id || !title) continue;
    songs.push({
      source: "ITUNES",
      externalId: id,
      title,
      artist: text(r.artistName),
      composer: null,
      genre: text(r.primaryGenreName),
      album: text(r.collectionName),
      durationMs: millis(r.trackTimeMillis),
      previewUrl: https(r.previewUrl),
      artworkUrl: https(r.artworkUrl100),
      sourceUrl: https(r.trackViewUrl),
    });
  }
  return songs;
}

/** MusicBrainz's open recording search. The term is quoted so it is searched as a phrase, never as query syntax. */
export function musicbrainzSearchUrl(term: string, field: Field): string {
  const phrase = `"${term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const query = field === "artist" ? `artist:${phrase}` : field === "title" ? `recording:${phrase}` : phrase;
  const url = new URL("https://musicbrainz.org/ws/2/recording");
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "15");
  return url.toString();
}

const mbPayload = z.object({ recordings: z.array(z.record(z.string(), z.unknown())) });
const mbId = z.uuid();

export function parseMusicBrainz(payload: unknown): CatalogSong[] {
  const parsed = mbPayload.safeParse(payload);
  if (!parsed.success) return [];
  const songs: CatalogSong[] = [];
  for (const r of parsed.data.recordings) {
    const title = text(r.title);
    if (!mbId.safeParse(r.id).success || !title) continue;
    const id = r.id as string;
    const credits = Array.isArray(r["artist-credit"]) ? (r["artist-credit"] as { name?: unknown; joinphrase?: unknown }[]) : [];
    const artist = credits.map((c) => `${text(c.name) ?? ""}${typeof c.joinphrase === "string" ? c.joinphrase : ""}`).join("").trim();
    const releases = Array.isArray(r.releases) ? (r.releases as { title?: unknown }[]) : [];
    songs.push({
      source: "MUSICBRAINZ",
      externalId: id,
      title,
      artist: artist || null,
      composer: null,
      genre: null,
      album: text(releases[0]?.title),
      durationMs: millis(r.length),
      previewUrl: null,
      artworkUrl: null,
      sourceUrl: `https://musicbrainz.org/recording/${id}`,
    });
  }
  return songs;
}

export interface CatalogSearch {
  songs: CatalogSong[];
  /** Catalogs that could not be reached this time; the other catalog's results still show. */
  unavailable: ("ITUNES" | "MUSICBRAINZ")[];
}

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * Searches both catalogs at once through HTTPS_PROXY or HTTP_PROXY when set. Results are cached for
 * ten minutes per search, which also keeps us inside MusicBrainz's one-request-per-second rule.
 */
@Injectable()
export class MusicCatalog {
  private readonly logger = new Logger(MusicCatalog.name);
  private readonly agent = new EnvHttpProxyAgent();
  private readonly cache = new Map<string, { at: number; result: CatalogSearch }>();
  /** MusicBrainz asks every client to name itself and a contact; the contact comes from MUSICBRAINZ_CONTACT when set. */
  readonly userAgent: string;

  constructor(contact?: string) {
    this.userAgent = contact ? `ChurchCMS/1.0 ( ${contact} )` : "ChurchCMS/1.0 (church management system)";
  }

  async search(query: CatalogSearchQuery, now = Date.now()): Promise<CatalogSearch> {
    const key = `${query.field}:${query.q.toLowerCase()}`;
    const hit = this.cache.get(key);
    const result = hit && now - hit.at < TEN_MINUTES ? hit.result : await this.fetchBoth(query.q, query.field);
    if (!hit || hit.result !== result) {
      if (this.cache.size > 200) this.cache.clear();
      this.cache.set(key, { at: now, result });
    }
    if (!query.genre) return result;
    const genre = query.genre.toLowerCase();
    // Only iTunes reports a genre; with a genre filter, songs of unknown genre are left out.
    return { ...result, songs: result.songs.filter((s) => s.genre?.toLowerCase().includes(genre)) };
  }

  private async fetchBoth(term: string, field: Field): Promise<CatalogSearch> {
    const [itunes, musicbrainz] = await Promise.allSettled([
      this.getJson(itunesSearchUrl(term, field)).then(parseItunes),
      this.musicbrainz(musicbrainzSearchUrl(term, field)).then(parseMusicBrainz),
    ]);
    const unavailable: CatalogSearch["unavailable"] = [];
    if (itunes.status === "rejected") {
      unavailable.push("ITUNES");
      this.logger.warn(`iTunes search failed: ${String(itunes.reason)}`);
    }
    if (musicbrainz.status === "rejected") {
      unavailable.push("MUSICBRAINZ");
      this.logger.warn(`MusicBrainz search failed: ${String(musicbrainz.reason)}`);
    }
    return {
      songs: [...(itunes.status === "fulfilled" ? itunes.value : []), ...(musicbrainz.status === "fulfilled" ? musicbrainz.value : [])],
      unavailable,
    };
  }

  /** MusicBrainz answers 503 when it is busy or a client asks too often; one retry a second later is its rule. */
  private async musicbrainz(url: string): Promise<unknown> {
    const headers = { "user-agent": this.userAgent };
    try {
      return await this.getJson(url, headers);
    } catch (error) {
      if ((error as { status?: number }).status !== 503) throw error;
      await this.wait(1100);
      return this.getJson(url, headers);
    }
  }

  protected wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { accept: "application/json", ...headers }, dispatcher: this.agent });
    if (!response.ok) throw Object.assign(new Error(`${new URL(url).host} returned ${response.status}`), { status: response.status });
    return response.json();
  }
}
