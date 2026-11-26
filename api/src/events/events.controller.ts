import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import {
  eventCancelSchema,
  eventCreateSchema,
  eventListQuerySchema,
  eventUpdateSchema,
  registrationCreateSchema,
  upcomingEventsQuerySchema,
  type EventCancelInput,
  type EventCreateInput,
  type EventListQuery,
  type EventUpdateInput,
  type RegistrationCreateInput,
} from "@cms/shared";
import type { z } from "zod";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodBody, ZodQuery } from "../docs/zod-openapi";
import { EventsService } from "./events.service";

const uuid = new ParseUUIDPipe();

@ApiProtected("Events")
@Controller("events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @RequirePermissions("events.read")
  @ZodQuery(eventListQuerySchema)
  list(@CurrentUser() actor: SessionUser, @Query(new ZodValidationPipe(eventListQuerySchema)) query: EventListQuery) {
    return this.events.list(actor, query);
  }

  @Get("upcoming")
  @RequirePermissions("events.read")
  @ZodQuery(upcomingEventsQuerySchema)
  upcoming(
    @CurrentUser() actor: SessionUser,
    @Query(new ZodValidationPipe(upcomingEventsQuerySchema)) query: z.infer<typeof upcomingEventsQuerySchema>,
  ) {
    return this.events.upcoming(actor, query.limit, query.branchId);
  }

  @Get(":id")
  @RequirePermissions("events.read")
  get(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.events.get(actor, id);
  }

  @Post()
  @RequirePermissions("events.manage")
  @ZodBody(eventCreateSchema)
  create(@CurrentUser() actor: SessionUser, @Body(new ZodValidationPipe(eventCreateSchema)) body: EventCreateInput) {
    return this.events.create(actor, body);
  }

  @Patch(":id")
  @RequirePermissions("events.manage")
  @ZodBody(eventUpdateSchema)
  update(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(eventUpdateSchema)) body: EventUpdateInput,
  ) {
    return this.events.update(actor, id, body);
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @RequirePermissions("events.manage")
  @ZodBody(eventCancelSchema)
  cancel(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(eventCancelSchema)) body: EventCancelInput,
  ) {
    return this.events.cancel(actor, id, body);
  }

  @Get(":id/registrations")
  @RequirePermissions("events.read")
  registrations(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.events.registrations(actor, id);
  }

  @Post(":id/registrations")
  @RequirePermissions("events.manage")
  @ZodBody(registrationCreateSchema)
  register(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(registrationCreateSchema)) body: RegistrationCreateInput,
  ) {
    return this.events.register(actor, id, body);
  }

  @Delete(":id/registrations/:registrationId")
  @HttpCode(204)
  @RequirePermissions("events.manage")
  cancelRegistration(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Param("registrationId", uuid) registrationId: string,
  ) {
    return this.events.cancelRegistration(actor, id, registrationId);
  }
}
