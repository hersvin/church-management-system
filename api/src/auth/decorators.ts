import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { Permission } from "@cms/shared";
import type { SessionUser } from "./session-user";

export const IS_PUBLIC_KEY = "isPublic";
export const PERMISSIONS_KEY = "permissions";

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser =>
    ctx.switchToHttp().getRequest<{ user: SessionUser }>().user,
);
