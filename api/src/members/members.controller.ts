import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  householdCreateSchema,
  householdListQuerySchema,
  householdUpdateSchema,
  memberCreateSchema,
  memberListQuerySchema,
  memberUpdateSchema,
  type HouseholdCreateInput,
  type HouseholdListQuery,
  type HouseholdUpdateInput,
  type MemberCreateInput,
  type MemberListQuery,
  type MemberUpdateInput,
} from "@cms/shared";
import { z } from "zod";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodBody, ZodQuery } from "../docs/zod-openapi";
import { HouseholdsService } from "./households.service";
import { MembersService } from "./members.service";

const statsQuerySchema = z.object({ branchId: z.uuid().optional() });
const uuid = new ParseUUIDPipe();

@ApiProtected("Members")
@Controller("members")
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequirePermissions("members.read")
  @ZodQuery(memberListQuerySchema)
  list(
    @CurrentUser() actor: SessionUser,
    @Query(new ZodValidationPipe(memberListQuerySchema)) query: MemberListQuery,
  ) {
    return this.members.list(actor, query);
  }

  @Get("stats")
  @RequirePermissions("members.read")
  @ZodQuery(statsQuerySchema)
  stats(
    @CurrentUser() actor: SessionUser,
    @Query(new ZodValidationPipe(statsQuerySchema)) query: z.infer<typeof statsQuerySchema>,
  ) {
    return this.members.stats(actor, query.branchId);
  }

  @Get(":id")
  @RequirePermissions("members.read")
  get(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.members.get(actor, id);
  }

  @Post()
  @RequirePermissions("members.manage")
  @ZodBody(memberCreateSchema)
  create(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodValidationPipe(memberCreateSchema)) body: MemberCreateInput,
  ) {
    return this.members.create(actor, body);
  }

  @Patch(":id")
  @RequirePermissions("members.manage")
  @ZodBody(memberUpdateSchema)
  update(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(memberUpdateSchema)) body: MemberUpdateInput,
  ) {
    return this.members.update(actor, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions("members.manage")
  archive(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.members.archive(actor, id);
  }
}

@ApiProtected("Households")
@Controller("households")
export class HouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Get()
  @RequirePermissions("members.read")
  @ZodQuery(householdListQuerySchema)
  list(
    @CurrentUser() actor: SessionUser,
    @Query(new ZodValidationPipe(householdListQuerySchema)) query: HouseholdListQuery,
  ) {
    return this.households.list(actor, query);
  }

  @Get(":id")
  @RequirePermissions("members.read")
  get(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.households.get(actor, id);
  }

  @Post()
  @RequirePermissions("members.manage")
  @ZodBody(householdCreateSchema)
  create(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodValidationPipe(householdCreateSchema)) body: HouseholdCreateInput,
  ) {
    return this.households.create(actor, body);
  }

  @Patch(":id")
  @RequirePermissions("members.manage")
  @ZodBody(householdUpdateSchema)
  update(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(householdUpdateSchema)) body: HouseholdUpdateInput,
  ) {
    return this.households.update(actor, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions("members.manage")
  archive(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.households.archive(actor, id);
  }
}
