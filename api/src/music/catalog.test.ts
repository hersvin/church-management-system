import { describe, expect, it } from "vitest";
import { MusicCatalog, itunesSearchUrl, musicbrainzSearchUrl, parseItunes, parseMusicBrainz } from "./catalog";

describe("iTunes catalog", () => {
  it("builds a song search on the fixed Apple host, limited by field", () => {
    const url = new URL(itunesSearchUrl("What a Beautiful Name", "title"));
    expect(url.origin).toBe("https://itunes.apple.com");
    expect(url.searchParams.get("term")).toBe("What a Beautiful Name");
    expect(url.searchParams.get("entity")).toBe("song");
    expect(url.searchParams.get("attribute")).toBe("songTerm");
    expect(new URL(itunesSearchUrl("Hillsong", "artist")).searchParams.get("attribute")).toBe("artistTerm");
    expect(new URL(itunesSearchUrl("grace", "any")).searchParams.has("attribute")).toBe(false);
  });

  it("keeps songs with a title and ID, and only https links", () => {
    const results = parseItunes({
      results: [
        {
          wrapperType: "track",
          kind: "song",
          trackId: 1440000000,
          trackName: "What a Beautiful Name",
          artistName: "Hillsong Worship",
          primaryGenreName: "Christian",
          previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a",
          artworkUrl100: "https://is1-ssl.mzstatic.com/100x100bb.jpg",
          trackViewUrl: "https://music.apple.com/us/album/1",
          trackTimeMillis: 334000,
          collectionName: "Let There Be Light",
        },
        { wrapperType: "track", kind: "song", trackId: 2, trackName: "Odd", previewUrl: "http://insecure.example/a.m4a" },
        { wrapperType: "track", kind: "music-video", trackId: 3, trackName: "Not a song" },
        { wrapperType: "track", kind: "song", trackName: "No ID" },
      ],
    });
    expect(results).toEqual([
      {
        source: "ITUNES",
        externalId: "1440000000",
        title: "What a Beautiful Name",
        artist: "Hillsong Worship",
        composer: null,
        genre: "Christian",
        album: "Let There Be Light",
        durationMs: 334000,
        previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a",
        artworkUrl: "https://is1-ssl.mzstatic.com/100x100bb.jpg",
        sourceUrl: "https://music.apple.com/us/album/1",
      },
      {
        source: "ITUNES",
        externalId: "2",
        title: "Odd",
        artist: null,
        composer: null,
        genre: null,
        album: null,
        durationMs: null,
        previewUrl: null,
        artworkUrl: null,
        sourceUrl: null,
      },
    ]);
    expect(parseItunes({ nonsense: true })).toEqual([]);
    expect(parseItunes(null)).toEqual([]);
  });
});

describe("MusicBrainz catalog", () => {
  it("quotes the search as a Lucene phrase on the fixed host", () => {
    const url = new URL(musicbrainzSearchUrl('Oceans "Where Feet May Fail"', "title"));
    expect(url.origin).toBe("https://musicbrainz.org");
    expect(url.pathname).toBe("/ws/2/recording");
    expect(url.searchParams.get("query")).toBe('recording:"Oceans \\"Where Feet May Fail\\""');
    expect(url.searchParams.get("fmt")).toBe("json");
    expect(new URL(musicbrainzSearchUrl("Hillsong", "artist")).searchParams.get("query")).toBe('artist:"Hillsong"');
  });

  it("maps recordings with their artist credit and a MusicBrainz link", () => {
    const results = parseMusicBrainz({
      recordings: [
        {
          id: "0f3a4f1e-1111-4111-8111-111111111111",
          title: "Oceans (Where Feet May Fail)",
          length: 535000,
          "artist-credit": [{ name: "Hillsong UNITED", joinphrase: " & " }, { name: "Taya" }],
          releases: [{ title: "Zion" }],
        },
        { id: "not-a-uuid", title: "Bad id" },
        { id: "0f3a4f1e-2222-4222-8222-222222222222" },
      ],
    });
    expect(results).toEqual([
      {
        source: "MUSICBRAINZ",
        externalId: "0f3a4f1e-1111-4111-8111-111111111111",
        title: "Oceans (Where Feet May Fail)",
        artist: "Hillsong UNITED & Taya",
        composer: null,
        genre: null,
        album: "Zion",
        durationMs: 535000,
        previewUrl: null,
        artworkUrl: null,
        sourceUrl: "https://musicbrainz.org/recording/0f3a4f1e-1111-4111-8111-111111111111",
      },
    ]);
  });
});

describe("MusicCatalog.search", () => {
  class Stub extends MusicCatalog {
    calls: string[] = [];
    constructor(private readonly reply: (url: string) => unknown) {
      super();
    }
    protected override async getJson(url: string) {
      this.calls.push(new URL(url).host);
      return this.reply(url);
    }
  }
  const itunes = { results: [{ kind: "song", trackId: 1, trackName: "Way Maker", primaryGenreName: "Christian & Gospel" }, { kind: "song", trackId: 2, trackName: "Way Maker (Live)" }] };

  it("still shows one catalog's results when the other is down, and says which is down", async () => {
    const catalog = new Stub((url) => {
      if (url.includes("musicbrainz")) throw new Error("timeout");
      return itunes;
    });
    const result = await catalog.search({ q: "way maker", field: "any" });
    expect(result.songs.map((s) => s.title)).toEqual(["Way Maker", "Way Maker (Live)"]);
    expect(result.unavailable).toEqual(["MUSICBRAINZ"]);
  });

  it("filters by genre where the catalog reports one, and caches repeat searches", async () => {
    const catalog = new Stub((url) => (url.includes("musicbrainz") ? { recordings: [] } : itunes));
    const result = await catalog.search({ q: "Way Maker", field: "any", genre: "gospel" });
    expect(result.songs.map((s) => s.title)).toEqual(["Way Maker"]);
    await catalog.search({ q: "way maker", field: "any" });
    expect(catalog.calls).toHaveLength(2);
  });
});

describe("MusicBrainz etiquette", () => {
  it("names the app, and the church's contact when one is configured", () => {
    expect(new MusicCatalog().userAgent).toBe("ChurchCMS/1.0 (church management system)");
    expect(new MusicCatalog("office@church.example").userAgent).toBe("ChurchCMS/1.0 ( office@church.example )");
  });

  it("retries once after a busy reply, a second later", async () => {
    const waits: number[] = [];
    class Busy extends MusicCatalog {
      calls = 0;
      protected override async getJson(url: string) {
        if (url.includes("itunes")) return { results: [] };
        this.calls += 1;
        if (this.calls === 1) throw Object.assign(new Error("busy"), { status: 503 });
        return { recordings: [{ id: "0f3a4f1e-1111-4111-8111-111111111111", title: "Oceans" }] };
      }
      protected override wait(ms: number) {
        waits.push(ms);
        return Promise.resolve();
      }
    }
    const catalog = new Busy();
    const result = await catalog.search({ q: "oceans", field: "title" });
    expect(result.songs.map((s) => s.title)).toEqual(["Oceans"]);
    expect(result.unavailable).toEqual([]);
    expect(waits).toEqual([1100]);
  });
});
