import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  transposeSemitones,
  type CatalogSearchQuery,
  type PlaylistAddSongInput,
  type PlaylistCreateInput,
  type PlaylistSaveInput,
  type PlaylistUpdateInput,
  type SongCreateInput,
  type SongListQuery,
  type SongUpdateInput,
} from "@cms/shared";
import { AuditService } from "../audit/audit.service";
import type { SessionUser } from "../auth/session-user";
import { PrismaService } from "../prisma/prisma.service";
import { MusicCatalog } from "./catalog";

/** The ministry whose members prepare the music. */
const WORSHIP_MINISTRY = "Worship";

const SONG_FIELDS = {
  id: true,
  title: true,
  artist: true,
  composer: true,
  originalKey: true,
  bpm: true,
  genre: true,
  language: true,
  source: true,
  sourceUrl: true,
  previewUrl: true,
  artworkUrl: true,
} as const;

/**
 * The worship team's music library and playlists. Open to admins and to staff serving in the
 * Worship ministry. Catalog search reads outside sources; everything saved lives in our database.
 */
@Injectable()
export class MusicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: MusicCatalog,
  ) {}

  private async assertAccess(actor: SessionUser) {
    if (actor.roleKey === "ADMIN") return;
    const serving = await this.prisma.ministryMember.findFirst({
      where: {
        leftAt: null,
        member: { user: { id: actor.id }, deletedAt: null },
        ministry: { name: { equals: WORSHIP_MINISTRY, mode: "insensitive" }, deletedAt: null },
      },
      select: { id: true },
    });
    if (!serving) throw new ForbiddenException("The music library is for the Worship ministry");
  }

  private async findPlaylist(id: string) {
    const playlist = await this.prisma.playlist.findFirst({ where: { id, deletedAt: null }, select: { id: true, name: true } });
    if (!playlist) throw new NotFoundException("Playlist not found");
    return playlist;
  }

  /** Searches the outside catalogs and marks results the church has already added to its library. */
  async search(actor: SessionUser, query: CatalogSearchQuery) {
    await this.assertAccess(actor);
    const result = await this.catalog.search(query);
    const known = result.songs.length
      ? await this.prisma.song.findMany({
          where: { OR: result.songs.map((s) => ({ source: s.source, externalId: s.externalId })) },
          select: { id: true, source: true, externalId: true, originalKey: true },
        })
      : [];
    const byKey = new Map(known.map((k) => [`${k.source}:${k.externalId}`, k]));
    return {
      unavailable: result.unavailable,
      songs: result.songs.map((s) => {
        const hit = byKey.get(`${s.source}:${s.externalId}`);
        return { ...s, librarySongId: hit?.id ?? null, originalKey: hit?.originalKey ?? null };
      }),
    };
  }

  async listSongs(actor: SessionUser, query: SongListQuery) {
    await this.assertAccess(actor);
    const contains = (value?: string) => (value ? { contains: value, mode: "insensitive" as const } : undefined);
    const orderBy = {
      title: [{ title: "asc" as const }],
      artist: [{ artist: "asc" as const }, { title: "asc" as const }],
      key: [{ originalKey: "asc" as const }, { title: "asc" as const }],
      updated: [{ updatedAt: "desc" as const }],
    }[query.sort ?? "title"];
    const songs = await this.prisma.song.findMany({
      where: {
        ...(query.q ? { OR: [{ title: contains(query.q) }, { artist: contains(query.q) }, { composer: contains(query.q) }] } : {}),
        genre: contains(query.genre),
        language: contains(query.language),
        originalKey: query.originalKey,
        ...(query.hasChart === true ? { chart: { not: null } } : query.hasChart === false ? { chart: null } : {}),
      },
      select: { ...SONG_FIELDS, updatedAt: true },
      orderBy,
      take: 200,
    });
    // The lyrics stay out of the list; one small query says which songs have them.
    const withChart = songs.length
      ? new Set(
          (await this.prisma.song.findMany({ where: { id: { in: songs.map((s) => s.id) }, chart: { not: null } }, select: { id: true } })).map((s) => s.id),
        )
      : new Set<string>();
    return songs.map((s) => ({ ...s, hasChart: withChart.has(s.id) }));
  }

  /** A catalog song is stored once (by source and ID); adding it again fills in a missing key and returns it. */
  async addSong(actor: SessionUser, input: SongCreateInput) {
    await this.assertAccess(actor);
    if (input.source !== "MANUAL" && input.externalId) {
      const existing = await this.prisma.song.findUnique({
        where: { source_externalId: { source: input.source, externalId: input.externalId } },
        select: SONG_FIELDS,
      });
      if (existing) {
        if (!existing.originalKey && input.originalKey) {
          return this.prisma.song.update({ where: { id: existing.id }, data: { originalKey: input.originalKey }, select: SONG_FIELDS });
        }
        return existing;
      }
    }
    const song = await this.prisma.song.create({ data: { ...input, createdById: actor.id }, select: SONG_FIELDS });
    await this.audit.record({ actorId: actor.id, action: "song.create", entity: "Song", entityId: song.id, changes: { title: input.title, source: input.source } });
    return song;
  }

  /** One song with its chord chart, for the song sheet. */
  async getSong(actor: SessionUser, id: string) {
    await this.assertAccess(actor);
    const song = await this.prisma.song.findUnique({ where: { id }, select: { ...SONG_FIELDS, chart: true, updatedAt: true } });
    if (!song) throw new NotFoundException("Song not found");
    return song;
  }

  async updateSong(actor: SessionUser, id: string, input: SongUpdateInput) {
    await this.assertAccess(actor);
    const exists = await this.prisma.song.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException("Song not found");
    const song = await this.prisma.song.update({ where: { id }, data: input, select: { ...SONG_FIELDS, chart: true, updatedAt: true } });
    // Lyrics are licensed text: the audit log records that the chart changed and its size, never the words.
    const { chart, ...rest } = input;
    const changes = chart === undefined ? rest : { ...rest, chart: chart === null ? "removed" : `${chart.length} characters` };
    await this.audit.record({ actorId: actor.id, action: "song.update", entity: "Song", entityId: id, changes });
    return song;
  }

  async listPlaylists(actor: SessionUser) {
    await this.assertAccess(actor);
    return this.prisma.playlist.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { songs: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  async getPlaylist(actor: SessionUser, id: string) {
    await this.assertAccess(actor);
    const playlist = await this.prisma.playlist.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        songs: {
          orderBy: { sequence: "asc" },
          select: { id: true, sequence: true, originalKey: true, selectedKey: true, transposeSemitones: true, notes: true, song: { select: SONG_FIELDS } },
        },
      },
    });
    if (!playlist) throw new NotFoundException("Playlist not found");
    return playlist;
  }

  async createPlaylist(actor: SessionUser, input: PlaylistCreateInput) {
    await this.assertAccess(actor);
    const playlist = await this.prisma.playlist.create({ data: { ...input, createdById: actor.id }, select: { id: true, name: true } });
    await this.audit.record({ actorId: actor.id, action: "playlist.create", entity: "Playlist", entityId: playlist.id, changes: input });
    return playlist;
  }

  async updatePlaylist(actor: SessionUser, id: string, input: PlaylistUpdateInput) {
    await this.assertAccess(actor);
    await this.findPlaylist(id);
    const playlist = await this.prisma.playlist.update({ where: { id }, data: input, select: { id: true, name: true, description: true } });
    await this.audit.record({ actorId: actor.id, action: "playlist.update", entity: "Playlist", entityId: id, changes: input });
    return playlist;
  }

  async deletePlaylist(actor: SessionUser, id: string) {
    await this.assertAccess(actor);
    await this.findPlaylist(id);
    await this.prisma.playlist.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.record({ actorId: actor.id, action: "playlist.delete", entity: "Playlist", entityId: id });
  }

  async duplicatePlaylist(actor: SessionUser, id: string) {
    await this.assertAccess(actor);
    const source = await this.prisma.playlist.findFirst({
      where: { id, deletedAt: null },
      select: {
        name: true,
        description: true,
        songs: { orderBy: { sequence: "asc" }, select: { songId: true, sequence: true, originalKey: true, selectedKey: true, transposeSemitones: true, notes: true } },
      },
    });
    if (!source) throw new NotFoundException("Playlist not found");
    const copy = await this.prisma.playlist.create({
      data: {
        name: `${source.name} (copy)`.slice(0, 120),
        description: source.description,
        createdById: actor.id,
        songs: { create: source.songs },
      },
      select: { id: true, name: true },
    });
    await this.audit.record({ actorId: actor.id, action: "playlist.duplicate", entity: "Playlist", entityId: copy.id, changes: { from: id } });
    return copy;
  }

  /** Adding from search results: appended at the end; a song already in the playlist is refused. */
  async addToPlaylist(actor: SessionUser, id: string, input: PlaylistAddSongInput) {
    await this.assertAccess(actor);
    await this.findPlaylist(id);
    const song = await this.prisma.song.findUnique({ where: { id: input.songId }, select: { id: true, originalKey: true } });
    if (!song) throw new NotFoundException("Song not found");
    const already = await this.prisma.playlistSong.findFirst({ where: { playlistId: id, songId: song.id }, select: { id: true } });
    if (already) throw new ConflictException("This song is already in the playlist. Use Duplicate on it to sing it twice.");
    const last = await this.prisma.playlistSong.findFirst({ where: { playlistId: id }, orderBy: { sequence: "desc" }, select: { sequence: true } });
    const selectedKey = input.selectedKey ?? song.originalKey;
    const entry = await this.prisma.playlistSong.create({
      data: {
        playlistId: id,
        songId: song.id,
        sequence: (last?.sequence ?? 0) + 1,
        originalKey: song.originalKey,
        selectedKey,
        transposeSemitones: transposeSemitones(song.originalKey, selectedKey),
      },
      select: { id: true },
    });
    await this.prisma.playlist.update({ where: { id }, data: { updatedAt: new Date() } });
    return entry;
  }

  /**
   * Saves the playlist as the team arranged it: order, a key per song, and notes. The list is replaced in one
   * transaction, so a failed save leaves the previous version intact. Each song's original key comes from the library.
   */
  async savePlaylist(actor: SessionUser, id: string, input: PlaylistSaveInput) {
    await this.assertAccess(actor);
    await this.findPlaylist(id);
    const ids = [...new Set(input.songs.map((s) => s.songId))];
    const songs = ids.length ? await this.prisma.song.findMany({ where: { id: { in: ids } }, select: { id: true, originalKey: true } }) : [];
    const keys = new Map(songs.map((s) => [s.id, s.originalKey]));
    if (keys.size !== ids.length) throw new NotFoundException("A song in this playlist is no longer in the library");

    const rows = input.songs.map((s, i) => {
      const originalKey = keys.get(s.songId) ?? null;
      return {
        playlistId: id,
        songId: s.songId,
        sequence: i + 1,
        originalKey,
        selectedKey: s.selectedKey,
        transposeSemitones: transposeSemitones(originalKey, s.selectedKey),
        notes: s.notes ?? null,
      };
    });
    const details = { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.description !== undefined ? { description: input.description } : {}) };
    await this.prisma.$transaction([
      this.prisma.playlistSong.deleteMany({ where: { playlistId: id } }),
      this.prisma.playlistSong.createMany({ data: rows }),
      this.prisma.playlist.update({ where: { id }, data: Object.keys(details).length ? details : { updatedAt: new Date() } }),
    ]);
    await this.audit.record({ actorId: actor.id, action: "playlist.save", entity: "Playlist", entityId: id, changes: { ...details, songs: rows.length } });
    return this.getPlaylist(actor, id);
  }
}
