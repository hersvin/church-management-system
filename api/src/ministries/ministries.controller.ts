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
  ministryCreateSchema,
  ministryListQuerySchema,
  ministryMemberAddSchema,
  ministryMemberUpdateSchema,
  ministryRoleCreateSchema,
  ministryUpdateSchema,
  type MinistryCreateInput,
  type MinistryListQuery,
  type MinistryMemberAddInput,
  type MinistryMemberUpdateInput,
  type MinistryRoleCreateInput,
  type MinistryUpdateInput,
} from "@cms/shared";
import { z } from "zod";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodBody, ZodQuery } from "../docs/zod-openapi";
import { MinistriesService } from "./ministries.service";

const statsQuerySchema = z.object({ branchId: z.uuid().optional() });
const uuid = new ParseUUIDPipe();

@ApiProtected("Ministries")
@Controller()
export class MinistriesController {
  constructor(private readonly ministries: MinistriesService) {}

  @Get("ministries")
  @RequirePermissions("ministries.read")
  @ZodQuery(ministryListQuerySchema)
  list(
    @CurrentUser() actor: SessionUser,
    @Query(new ZodValidationPipe(ministryListQuerySchema)) query: MinistryListQuery,
  ) {
    return this.ministries.list(actor, query);
  }

  @Get("ministries/stats")
  @RequirePermissions("ministries.read")
  @ZodQuery(statsQuerySchema)
  stats(
    @CurrentUser() actor: SessionUser,
    @Query(new ZodValidationPipe(statsQuerySchema)) query: z.infer<typeof statsQuerySchema>,
  ) {
    return this.ministries.stats(actor, query.branchId);
  }

  @Get("ministries/:id")
  @RequirePermissions("ministries.read")
  get(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.ministries.get(actor, id);
  }

  @Post("ministries")
  @RequirePermissions("ministries.manage")
  @ZodBody(ministryCreateSchema)
  create(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodValidationPipe(ministryCreateSchema)) body: MinistryCreateInput,
  ) {
    return this.ministries.create(actor, body);
  }

  @Patch("ministries/:id")
  @RequirePermissions("ministries.manage")
  @ZodBody(ministryUpdateSchema)
  update(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(ministryUpdateSchema)) body: MinistryUpdateInput,
  ) {
    return this.ministries.update(actor, id, body);
  }

  @Delete("ministries/:id")
  @HttpCode(204)
  @RequirePermissions("ministries.manage")
  archive(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.ministries.archive(actor, id);
  }

  @Post("ministries/:id/roles")
  @RequirePermissions("ministries.manage")
  @ZodBody(ministryRoleCreateSchema)
  addRole(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(ministryRoleCreateSchema)) body: MinistryRoleCreateInput,
  ) {
    return this.ministries.addRole(actor, id, body);
  }

  @Delete("ministries/:id/roles/:roleId")
  @HttpCode(204)
  @RequirePermissions("ministries.manage")
  removeRole(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Param("roleId", uuid) roleId: string,
  ) {
    return this.ministries.removeRole(actor, id, roleId);
  }

  @Post("ministries/:id/members")
  @RequirePermissions("ministries.manage")
  @ZodBody(ministryMemberAddSchema)
  addMember(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(new ZodValidationPipe(ministryMemberAddSchema)) body: MinistryMemberAddInput,
  ) {
    return this.ministries.addMember(actor, id, body);
  }

  @Patch("ministries/:id/members/:memberId")
  @RequirePermissions("ministries.manage")
  @ZodBody(ministryMemberUpdateSchema)
  updateMember(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Param("memberId", uuid) memberId: string,
    @Body(new ZodValidationPipe(ministryMemberUpdateSchema)) body: MinistryMemberUpdateInput,
  ) {
    return this.ministries.updateMember(actor, id, memberId, body);
  }

  @Delete("ministries/:id/members/:memberId")
  @HttpCode(204)
  @RequirePermissions("ministries.manage")
  removeMember(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Param("memberId", uuid) memberId: string,
  ) {
    return this.ministries.removeMember(actor, id, memberId);
  }

  @Get("members/:id/ministries")
  @RequirePermissions("ministries.read")
  forMember(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.ministries.forMember(actor, id);
  }
}
