import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Res, StreamableFile } from "@nestjs/common";
import {
  joinRequestCreateSchema,
  joinRequestDecisionSchema,
  photoUploadSchema,
  type PhotoUploadInput,
  scanCheckInSchema,
  selfCheckInSchema,
  selfProfileUpdateSchema,
  selfRegistrationSchema,
  type SelfProfileUpdateInput,
  type JoinRequestCreateInput,
  type JoinRequestDecisionInput,
  type ScanCheckInInput,
  type SelfCheckInInput,
  type SelfRegistrationInput,
} from "@cms/shared";
import type { Response } from "express";
import type { z } from "zod";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodBody } from "../docs/zod-openapi";
import { MeService } from "./me.service";

const uuid = new ParseUUIDPipe();
const pipe = <T extends z.ZodType>(schema: T) => new ZodValidationPipe(schema);

/** The signed-in person's own data for the mobile app. Any signed-in account; member features need a linked member record. */
@ApiProtected("Me (mobile app)")
@Controller("me")
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get("member")
  member(@CurrentUser() actor: SessionUser) {
    return this.me.profile(actor);
  }

  /** Members update their own contact and personal details; office-managed fields are refused. */
  @Patch("member")
  @ZodBody(selfProfileUpdateSchema)
  updateMember(@CurrentUser() actor: SessionUser, @Body(pipe(selfProfileUpdateSchema)) body: SelfProfileUpdateInput) {
    return this.me.updateProfile(actor, body);
  }

  @Get("account")
  account(@CurrentUser() actor: SessionUser) {
    return this.me.account(actor);
  }

  /** The account's profile photo as an image; the app adds ?v=<photoUpdatedAt> so a new photo is fetched fresh. */
  @Get("photo")
  async photo(@CurrentUser() actor: SessionUser, @Res({ passthrough: true }) res: Response) {
    const photo = await this.me.photo(actor);
    res.setHeader("Content-Type", photo.mimeType);
    res.setHeader("Cache-Control", "private, max-age=86400");
    return new StreamableFile(Buffer.from(photo.data));
  }

  @Put("photo")
  @ZodBody(photoUploadSchema)
  setPhoto(@CurrentUser() actor: SessionUser, @Body(pipe(photoUploadSchema)) body: PhotoUploadInput) {
    return this.me.setPhoto(actor, body);
  }

  @Delete("photo")
  @HttpCode(204)
  async removePhoto(@CurrentUser() actor: SessionUser) {
    await this.me.removePhoto(actor);
  }

  @Get("qr")
  qr(@CurrentUser() actor: SessionUser) {
    return this.me.qr(actor);
  }

  @Post("check-ins")
  @ZodBody(selfCheckInSchema)
  selfCheckIn(@CurrentUser() actor: SessionUser, @Body(pipe(selfCheckInSchema)) body: SelfCheckInInput) {
    return this.me.selfCheckIn(actor, body);
  }

  @Get("attendance")
  attendance(@CurrentUser() actor: SessionUser) {
    return this.me.attendance(actor);
  }

  @Get("services")
  services(@CurrentUser() actor: SessionUser) {
    return this.me.services(actor);
  }

  @Get("services/:id")
  service(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.me.serviceDetail(actor, id);
  }

  @Get("ministries")
  ministries(@CurrentUser() actor: SessionUser) {
    return this.me.ministries(actor);
  }

  @Post("ministry-requests")
  @ZodBody(joinRequestCreateSchema)
  requestJoin(@CurrentUser() actor: SessionUser, @Body(pipe(joinRequestCreateSchema)) body: JoinRequestCreateInput) {
    return this.me.requestJoin(actor, body);
  }

  @Get("events")
  events(@CurrentUser() actor: SessionUser) {
    return this.me.upcomingEvents(actor);
  }

  /** Same visibility as the Events tab: admins and pastors any event, staff their ministries only. */
  @Get("events/:id")
  event(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.me.eventDetail(actor, id);
  }

  @Post("event-registrations")
  @ZodBody(selfRegistrationSchema)
  register(@CurrentUser() actor: SessionUser, @Body(pipe(selfRegistrationSchema)) body: SelfRegistrationInput) {
    return this.me.registerForEvent(actor, body);
  }
}

/** Staff tools behind the app's QR features: service codes, card scanning, and join approvals. */
@ApiProtected("Attendance")
@Controller()
export class QrStaffController {
  constructor(private readonly me: MeService) {}

  @Get("services/:id/qr")
  @RequirePermissions("attendance.manage")
  serviceQr(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.me.serviceQr(actor, id);
  }

  @Post("services/:id/check-ins/scan")
  @RequirePermissions("attendance.manage")
  @ZodBody(scanCheckInSchema)
  scan(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(scanCheckInSchema)) body: ScanCheckInInput) {
    return this.me.scan(actor, id, body);
  }

  @Get("ministries/:id/join-requests")
  @RequirePermissions("ministries.manage")
  joinRequests(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.me.ministryRequests(actor, id);
  }

  @Post("ministry-requests/:id/decision")
  @HttpCode(200)
  @RequirePermissions("ministries.manage")
  @ZodBody(joinRequestDecisionSchema)
  decide(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(joinRequestDecisionSchema)) body: JoinRequestDecisionInput) {
    return this.me.decide(actor, id, body);
  }
}
