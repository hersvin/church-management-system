import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import {
  attendanceStatsQuerySchema,
  checkInCreateSchema,
  checkOutSchema,
  serviceCreateSchema,
  serviceListQuerySchema,
  serviceUpdateSchema,
  type AttendanceStatsQuery,
  type CheckInCreateInput,
  type CheckOutInput,
  type ServiceCreateInput,
  type ServiceListQuery,
  type ServiceUpdateInput,
} from "@cms/shared";
import type { z } from "zod";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodBody, ZodQuery } from "../docs/zod-openapi";
import { CheckInService } from "./check-in.service";
import { ServicesService } from "./services.service";

const uuid = new ParseUUIDPipe();
const pipe = <T extends z.ZodType>(schema: T) => new ZodValidationPipe(schema);

@ApiProtected("Attendance")
@Controller()
export class AttendanceController {
  constructor(
    private readonly services: ServicesService,
    private readonly checkIns: CheckInService,
  ) {}

  // Services

  @Get("services")
  @RequirePermissions("attendance.read")
  @ZodQuery(serviceListQuerySchema)
  listServices(@CurrentUser() actor: SessionUser, @Query(pipe(serviceListQuerySchema)) q: ServiceListQuery) {
    return this.services.list(actor, q);
  }

  @Post("services")
  @RequirePermissions("attendance.manage")
  @ZodBody(serviceCreateSchema)
  createService(@CurrentUser() actor: SessionUser, @Body(pipe(serviceCreateSchema)) body: ServiceCreateInput) {
    return this.services.create(actor, body);
  }

  @Get("services/:id")
  @RequirePermissions("attendance.read")
  getService(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.services.get(actor, id);
  }

  @Patch("services/:id")
  @RequirePermissions("attendance.manage")
  @ZodBody(serviceUpdateSchema)
  updateService(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(serviceUpdateSchema)) body: ServiceUpdateInput) {
    return this.services.update(actor, id, body);
  }

  @Delete("services/:id")
  @HttpCode(204)
  @RequirePermissions("attendance.manage")
  archiveService(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.services.archive(actor, id);
  }

  @Get("attendance/stats")
  @RequirePermissions("attendance.read")
  @ZodQuery(attendanceStatsQuerySchema)
  stats(@CurrentUser() actor: SessionUser, @Query(pipe(attendanceStatsQuerySchema)) q: AttendanceStatsQuery) {
    return this.services.stats(actor, q);
  }

  @Get("members/:id/attendance")
  @RequirePermissions("attendance.read")
  forMember(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.services.forMember(actor, id);
  }

  // Check-in

  @Get("services/:id/check-ins")
  @RequirePermissions("attendance.read")
  serviceCheckIns(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.checkIns.list(actor, { type: "service", id });
  }

  @Post("services/:id/check-ins")
  @RequirePermissions("attendance.manage")
  @ZodBody(checkInCreateSchema)
  checkInToService(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(checkInCreateSchema)) body: CheckInCreateInput) {
    return this.checkIns.checkIn(actor, { type: "service", id }, body);
  }

  @Get("events/:id/check-ins")
  @RequirePermissions("attendance.read")
  eventCheckIns(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.checkIns.list(actor, { type: "event", id });
  }

  @Post("events/:id/check-ins")
  @RequirePermissions("attendance.manage")
  @ZodBody(checkInCreateSchema)
  checkInToEvent(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(checkInCreateSchema)) body: CheckInCreateInput) {
    return this.checkIns.checkIn(actor, { type: "event", id }, body);
  }

  @Get("check-ins/:id/guardians")
  @RequirePermissions("attendance.manage")
  guardians(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.checkIns.guardians(actor, id);
  }

  @Post("check-ins/:id/checkout")
  @HttpCode(200)
  @RequirePermissions("attendance.manage")
  @ZodBody(checkOutSchema)
  checkOut(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(checkOutSchema)) body: CheckOutInput) {
    return this.checkIns.checkOut(actor, id, body);
  }

  @Delete("check-ins/:id")
  @HttpCode(204)
  @RequirePermissions("attendance.manage")
  undo(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.checkIns.undo(actor, id);
  }
}
