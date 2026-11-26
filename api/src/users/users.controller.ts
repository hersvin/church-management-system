import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import {
  paginationSchema,
  userCreateSchema,
  userUpdateSchema,
  type PaginationInput,
  type UserCreateInput,
  type UserUpdateInput,
} from "@cms/shared";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import { ApiProtected, ZodBody, ZodQuery } from "../docs/zod-openapi";
import type { SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

@ApiProtected("Users")
@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("users")
  @RequirePermissions("users.read")
  @ZodQuery(paginationSchema)
  list(
    @CurrentUser() actor: SessionUser,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
  ) {
    return this.users.list(actor, query);
  }

  @Post("users")
  @RequirePermissions("users.manage")
  @ZodBody(userCreateSchema)
  create(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodValidationPipe(userCreateSchema)) body: UserCreateInput,
  ) {
    return this.users.create(actor, body);
  }

  @Patch("users/:id")
  @RequirePermissions("users.manage")
  @ZodBody(userUpdateSchema)
  update(
    @CurrentUser() actor: SessionUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(userUpdateSchema)) body: UserUpdateInput,
  ) {
    return this.users.update(actor, id, body);
  }

  @Get("roles")
  @RequirePermissions("users.read")
  roles() {
    return this.prisma.role.findMany({ orderBy: { name: "asc" } });
  }
}
