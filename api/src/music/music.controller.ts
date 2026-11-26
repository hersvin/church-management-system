import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from "@nestjs/common";
import {
  catalogSearchQuerySchema,
  playlistAddSongSchema,
  playlistCreateSchema,
  playlistSaveSchema,
  playlistUpdateSchema,
  songCreateSchema,
  songListQuerySchema,
  songUpdateSchema,
  type CatalogSearchQuery,
  type PlaylistAddSongInput,
  type PlaylistCreateInput,
  type PlaylistSaveInput,
  type PlaylistUpdateInput,
  type SongCreateInput,
  type SongListQuery,
  type SongUpdateInput,
} from "@cms/shared";
import type { z } from "zod";
import { CurrentUser } from "../auth/decorators";
import type { SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodBody, ZodQuery } from "../docs/zod-openapi";
import { MusicService } from "./music.service";

const uuid = new ParseUUIDPipe();
const pipe = <T extends z.ZodType>(schema: T) => new ZodValidationPipe(schema);

/** Music library and playlists for the worship team. Admins and Worship ministry staff only (checked in the service). */
@ApiProtected("Music library")
@Controller("music")
export class MusicController {
  constructor(private readonly music: MusicService) {}

  /** Searches iTunes and MusicBrainz. `unavailable` names a catalog that could not be reached. */
  @Get("search")
  @ZodQuery(catalogSearchQuerySchema)
  search(@CurrentUser() actor: SessionUser, @Query(pipe(catalogSearchQuerySchema)) query: CatalogSearchQuery) {
    return this.music.search(actor, query);
  }

  @Get("songs")
  @ZodQuery(songListQuerySchema)
  songs(@CurrentUser() actor: SessionUser, @Query(pipe(songListQuerySchema)) query: SongListQuery) {
    return this.music.listSongs(actor, query);
  }

  @Post("songs")
  @ZodBody(songCreateSchema)
  addSong(@CurrentUser() actor: SessionUser, @Body(pipe(songCreateSchema)) body: SongCreateInput) {
    return this.music.addSong(actor, body);
  }

  @Get("songs/:id")
  song(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.music.getSong(actor, id);
  }

  @Patch("songs/:id")
  @ZodBody(songUpdateSchema)
  updateSong(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(songUpdateSchema)) body: SongUpdateInput) {
    return this.music.updateSong(actor, id, body);
  }

  @Get("playlists")
  playlists(@CurrentUser() actor: SessionUser) {
    return this.music.listPlaylists(actor);
  }

  @Post("playlists")
  @ZodBody(playlistCreateSchema)
  createPlaylist(@CurrentUser() actor: SessionUser, @Body(pipe(playlistCreateSchema)) body: PlaylistCreateInput) {
    return this.music.createPlaylist(actor, body);
  }

  @Get("playlists/:id")
  playlist(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.music.getPlaylist(actor, id);
  }

  @Patch("playlists/:id")
  @ZodBody(playlistUpdateSchema)
  updatePlaylist(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(playlistUpdateSchema)) body: PlaylistUpdateInput) {
    return this.music.updatePlaylist(actor, id, body);
  }

  /** Saves the arranged playlist: order, a key per song, notes, and optionally a new name. */
  @Put("playlists/:id/songs")
  @ZodBody(playlistSaveSchema)
  savePlaylist(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(playlistSaveSchema)) body: PlaylistSaveInput) {
    return this.music.savePlaylist(actor, id, body);
  }

  @Post("playlists/:id/songs")
  @ZodBody(playlistAddSongSchema)
  addToPlaylist(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(playlistAddSongSchema)) body: PlaylistAddSongInput) {
    return this.music.addToPlaylist(actor, id, body);
  }

  @Post("playlists/:id/duplicate")
  duplicatePlaylist(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.music.duplicatePlaylist(actor, id);
  }

  @Delete("playlists/:id")
  @HttpCode(204)
  async deletePlaylist(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    await this.music.deletePlaylist(actor, id);
  }
}
