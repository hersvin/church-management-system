import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import {
  branchCreateSchema,
  branchUpdateSchema,
  type BranchCreateInput,
  type BranchUpdateInput,
} from "@cms/shared";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodBody } from "../docs/zod-openapi";
import { BranchesService } from "./branches.service";

@ApiProtected("Branches")
@Controller("branches")
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  @RequirePermissions("branches.read")
  list() {
    return this.branches.list();
  }

  @Post()
  @RequirePermissions("branches.manage")
  @ZodBody(branchCreateSchema)
  create(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodValidationPipe(branchCreateSchema)) body: BranchCreateInput,
  ) {
    return this.branches.create(actor.id, body);
  }

  @Patch(":id")
  @RequirePermissions("branches.manage")
  @ZodBody(branchUpdateSchema)
  update(
    @CurrentUser() actor: SessionUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(branchUpdateSchema)) body: BranchUpdateInput,
  ) {
    return this.branches.update(actor.id, id, body);
  }
}
