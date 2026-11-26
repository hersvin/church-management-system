import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import {
  bookingCreateSchema,
  bookingDecisionSchema,
  bookingListQuerySchema,
  pendingBookingsQuerySchema,
  roomCreateSchema,
  roomListQuerySchema,
  roomUpdateSchema,
  type BookingCreateInput,
  type BookingDecisionInput,
  type BookingListQuery,
  type RoomCreateInput,
  type RoomListQuery,
  type RoomUpdateInput,
} from "@cms/shared";
import type { z } from "zod";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodBody, ZodQuery } from "../docs/zod-openapi";
import { BookingsService } from "./bookings.service";
import { RoomsService } from "./rooms.service";

const uuid = new ParseUUIDPipe();

@ApiProtected("Rooms")
@Controller("rooms")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @RequirePermissions("rooms.read")
  @ZodQuery(roomListQuerySchema)
  list(@CurrentUser() actor: SessionUser, @Query(new ZodValidationPipe(roomListQuerySchema)) query: RoomListQuery) {
    return this.rooms.list(actor, query);
  }

  @Get(":id")
  @RequirePermissions("rooms.read")
  get(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.rooms.get(actor, id);
  }

  @Post()
  @RequirePermissions("rooms.manage")
  @ZodBody(roomCreateSchema)
  create(@CurrentUser() actor: SessionUser, @Body(new ZodValidationPipe(roomCreateSchema)) body: RoomCreateInput) {
    return this.rooms.create(actor, body);
  }

  @Patch(":id")
  @RequirePermissions("rooms.manage")
  @ZodBody(roomUpdateSchema)
  update(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(roomUpdateSchema)) body: RoomUpdateInput,
  ) {
    return this.rooms.update(actor, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions("rooms.manage")
  archive(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.rooms.archive(actor, id);
  }
}

@ApiProtected("Room bookings")
@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  @RequirePermissions("rooms.read")
  @ZodQuery(bookingListQuerySchema)
  list(@CurrentUser() actor: SessionUser, @Query(new ZodValidationPipe(bookingListQuerySchema)) query: BookingListQuery) {
    return this.bookings.list(actor, query);
  }

  @Get("pending")
  @RequirePermissions("rooms.read")
  @ZodQuery(pendingBookingsQuerySchema)
  pending(
    @CurrentUser() actor: SessionUser,
    @Query(new ZodValidationPipe(pendingBookingsQuerySchema)) query: z.infer<typeof pendingBookingsQuerySchema>,
  ) {
    return this.bookings.pending(actor, query.branchId);
  }

  @Post()
  @RequirePermissions("rooms.book")
  @ZodBody(bookingCreateSchema)
  create(@CurrentUser() actor: SessionUser, @Body(new ZodValidationPipe(bookingCreateSchema)) body: BookingCreateInput) {
    return this.bookings.create(actor, body);
  }

  @Post(":id/approve")
  @HttpCode(200)
  @RequirePermissions("rooms.manage")
  @ZodBody(bookingDecisionSchema)
  approve(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(bookingDecisionSchema)) body: BookingDecisionInput,
  ) {
    return this.bookings.approve(actor, id, body);
  }

  @Post(":id/reject")
  @HttpCode(200)
  @RequirePermissions("rooms.manage")
  @ZodBody(bookingDecisionSchema)
  reject(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(bookingDecisionSchema)) body: BookingDecisionInput,
  ) {
    return this.bookings.reject(actor, id, body);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @RequirePermissions("rooms.book")
  cancel(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.bookings.cancel(actor, id);
  }
}
