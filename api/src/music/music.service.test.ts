import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { branchStaff, superAdmin } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { MusicService } from "./music.service";

const SONG = "33333333-3333-4333-8333-333333333333";
const SONG_2 = "44444444-4444-4444-8444-444444444444";
const LIST = "55555555-5555-4555-8555-555555555555";

const admin = { ...superAdmin, roleKey: "ADMIN" as const };
const worship = { ...branchStaff, roleKey: "STAFF" as const };
const pastor = { ...superAdmin, id: "pppppppp-pppp-4ppp-8ppp-pppppppppppp", roleKey: "PASTOR" as const };

describe("MusicService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let catalog: { search: ReturnType<typeof vi.fn> };
  let music: MusicService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    catalog = { search: vi.fn() };
    music = new MusicService(prisma as never, audit as never, catalog as never);
    // By default the staff account serves in Worship.
    prisma.ministryMember.findFirst.mockResolvedValue({ id: "mm1" });
    prisma.playlist.findFirst.mockResolvedValue({ id: LIST, name: "Sunday", deletedAt: null });
  });

  describe("access", () => {
    it("lets admins and Worship ministry staff in", async () => {
      prisma.song.findMany.mockResolvedValue([]);
      await expect(music.listSongs(admin, { sort: "title" })).resolves.toEqual([]);
      await expect(music.listSongs(worship, { sort: "title" })).resolves.toEqual([]);
      expect(prisma.ministryMember.findFirst.mock.calls[0][0].where).toMatchObject({
        leftAt: null,
        member: { user: { id: worship.id } },
        ministry: { name: { equals: "Worship", mode: "insensitive" }, deletedAt: null },
      });
    });

    it("keeps out pastors and staff outside the Worship ministry", async () => {
      prisma.ministryMember.findFirst.mockResolvedValue(null);
      await expect(music.listSongs(pastor, { sort: "title" })).rejects.toThrow(ForbiddenException);
      await expect(music.listSongs(worship, { sort: "title" })).rejects.toThrow(ForbiddenException);
    });
  });

  describe("catalog search", () => {
    it("marks results that are already in the church library", async () => {
      catalog.search.mockResolvedValue({
        songs: [
          { source: "ITUNES", externalId: "1", title: "Way Maker" },
          { source: "MUSICBRAINZ", externalId: "abc", title: "Way Maker" },
        ],
        unavailable: [],
      });
      prisma.song.findMany.mockResolvedValue([{ id: SONG, source: "ITUNES", externalId: "1", originalKey: "E" }]);
      const result = await music.search(admin, { q: "way maker", field: "any" });
      expect(result.songs[0]).toMatchObject({ librarySongId: SONG, originalKey: "E" });
      expect(result.songs[1]).toMatchObject({ librarySongId: null, originalKey: null });
    });
  });

  describe("library", () => {
    it("adds a catalog song once, reusing the existing entry", async () => {
      prisma.song.findUnique.mockResolvedValueOnce({ id: SONG, originalKey: null });
      prisma.song.update.mockResolvedValue({ id: SONG, originalKey: "D" });
      const song = await music.addSong(admin, { title: "What a Beautiful Name", source: "ITUNES", externalId: "9", originalKey: "D" });
      expect(prisma.song.create).not.toHaveBeenCalled();
      expect(prisma.song.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: SONG }, data: { originalKey: "D" } }));
      expect(song).toEqual({ id: SONG, originalKey: "D" });
    });

    it("creates a new song with who added it", async () => {
      prisma.song.findUnique.mockResolvedValueOnce(null);
      prisma.song.create.mockResolvedValue({ id: SONG });
      await music.addSong(worship, { title: "Our Song", source: "MANUAL", originalKey: "G" });
      expect(prisma.song.create.mock.calls[0][0].data).toMatchObject({ title: "Our Song", source: "MANUAL", originalKey: "G", createdById: worship.id });
    });
  });

  describe("playlists", () => {
    it("adds a song at the end with its key and transposition", async () => {
      prisma.song.findUnique.mockResolvedValue({ id: SONG, originalKey: "D" });
      prisma.playlistSong.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ sequence: 2 });
      prisma.playlistSong.create.mockResolvedValue({ id: "ps1" });
      await music.addToPlaylist(admin, LIST, { songId: SONG, selectedKey: "E" });
      expect(prisma.playlistSong.create.mock.calls[0][0].data).toEqual({
        playlistId: LIST,
        songId: SONG,
        sequence: 3,
        originalKey: "D",
        selectedKey: "E",
        transposeSemitones: 2,
      });
    });

    it("refuses a song that is already in the playlist", async () => {
      prisma.song.findUnique.mockResolvedValue({ id: SONG, originalKey: "D" });
      prisma.playlistSong.findFirst.mockResolvedValueOnce({ id: "ps1" });
      await expect(music.addToPlaylist(admin, LIST, { songId: SONG })).rejects.toThrow(ConflictException);
    });

    it("saves the whole order with a key per song, each transposed on its own", async () => {
      prisma.song.findMany.mockResolvedValue([
        { id: SONG, originalKey: "D" },
        { id: SONG_2, originalKey: "G" },
      ]);
      prisma.playlist.findUnique.mockResolvedValue({ id: LIST });
      await music.savePlaylist(admin, LIST, {
        name: "Sunday AM",
        songs: [
          { songId: SONG_2, selectedKey: "E" },
          { songId: SONG, selectedKey: "E" },
          { songId: SONG, selectedKey: null, notes: "Reprise" },
        ],
      });
      expect(prisma.playlistSong.deleteMany).toHaveBeenCalledWith({ where: { playlistId: LIST } });
      expect(prisma.playlistSong.createMany.mock.calls[0][0].data).toEqual([
        { playlistId: LIST, songId: SONG_2, sequence: 1, originalKey: "G", selectedKey: "E", transposeSemitones: -3, notes: null },
        { playlistId: LIST, songId: SONG, sequence: 2, originalKey: "D", selectedKey: "E", transposeSemitones: 2, notes: null },
        { playlistId: LIST, songId: SONG, sequence: 3, originalKey: "D", selectedKey: null, transposeSemitones: 0, notes: "Reprise" },
      ]);
      expect(prisma.playlist.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: LIST }, data: { name: "Sunday AM" } }));
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "playlist.save", entityId: LIST }));
    });

    it("refuses to save songs that are not in the library", async () => {
      prisma.song.findMany.mockResolvedValue([{ id: SONG, originalKey: "D" }]);
      await expect(
        music.savePlaylist(admin, LIST, { songs: [{ songId: SONG, selectedKey: null }, { songId: SONG_2, selectedKey: null }] }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.playlistSong.deleteMany).not.toHaveBeenCalled();
    });

    it("duplicates a playlist with its songs and keys", async () => {
      prisma.playlist.findFirst.mockResolvedValue({
        id: LIST,
        name: "Sunday",
        description: "Main service",
        songs: [{ songId: SONG, sequence: 1, originalKey: "D", selectedKey: "E", transposeSemitones: 2, notes: null }],
      });
      prisma.playlist.create.mockResolvedValue({ id: "copy" });
      await music.duplicatePlaylist(admin, LIST);
      const data = prisma.playlist.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ name: "Sunday (copy)", description: "Main service", createdById: admin.id });
      expect(data.songs.create).toEqual([{ songId: SONG, sequence: 1, originalKey: "D", selectedKey: "E", transposeSemitones: 2, notes: null }]);
    });

    it("soft-deletes a playlist and 404s a missing one", async () => {
      await music.deletePlaylist(admin, LIST);
      expect(prisma.playlist.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: LIST }, data: { deletedAt: expect.any(Date) } }));
      prisma.playlist.findFirst.mockResolvedValue(null);
      await expect(music.deletePlaylist(admin, LIST)).rejects.toThrow(NotFoundException);
    });
  });

  describe("chord charts", () => {
    it("reads one song with its chart, or 404", async () => {
      prisma.song.findUnique.mockResolvedValueOnce({ id: SONG, title: "What a Beautiful Name", chart: "[D]Word" });
      await expect(music.getSong(worship, SONG)).resolves.toMatchObject({ chart: "[D]Word" });
      expect(prisma.song.findUnique.mock.calls[0][0].select).toMatchObject({ chart: true, originalKey: true });
      prisma.song.findUnique.mockResolvedValueOnce(null);
      await expect(music.getSong(worship, SONG)).rejects.toThrow(NotFoundException);
    });

    it("saves a chart and audits only its size, not the lyrics", async () => {
      prisma.song.findUnique.mockResolvedValueOnce({ id: SONG });
      prisma.song.update.mockResolvedValue({ id: SONG });
      await music.updateSong(worship, SONG, { chart: "[D]Word at the beginning" });
      expect(prisma.song.update.mock.calls[0][0].data).toEqual({ chart: "[D]Word at the beginning" });
      expect(audit.record.mock.calls[0][0].changes).toEqual({ chart: "24 characters" });
    });

    it("keeps people outside the Worship ministry from reading charts", async () => {
      prisma.ministryMember.findFirst.mockResolvedValue(null);
      await expect(music.getSong(worship, SONG)).rejects.toThrow(ForbiddenException);
    });
  });

  describe("library browsing", () => {
    it("sorts, filters by chart, and marks which songs have one without loading the lyrics", async () => {
      prisma.song.findMany
        .mockResolvedValueOnce([
          { id: SONG, title: "A" },
          { id: SONG_2, title: "B" },
        ])
        .mockResolvedValueOnce([{ id: SONG_2 }]);
      const songs = await music.listSongs(worship, { sort: "artist", hasChart: true });
      const first = prisma.song.findMany.mock.calls[0][0];
      expect(first.orderBy).toEqual([{ artist: "asc" }, { title: "asc" }]);
      expect(first.where.chart).toEqual({ not: null });
      expect(first.select).not.toHaveProperty("chart");
      expect(songs.map((s: { hasChart: boolean }) => s.hasChart)).toEqual([false, true]);
    });

    it("lists songs still missing a chart, newest first", async () => {
      prisma.song.findMany.mockResolvedValueOnce([]);
      await music.listSongs(worship, { sort: "updated", hasChart: false });
      const first = prisma.song.findMany.mock.calls[0][0];
      expect(first.orderBy).toEqual([{ updatedAt: "desc" }]);
      expect(first.where.chart).toBeNull();
    });
  });
});
