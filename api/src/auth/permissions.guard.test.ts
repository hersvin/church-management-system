import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { PERMISSIONS_KEY } from "./decorators";
import { PermissionsGuard } from "./permissions.guard";

function ctx(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardWith(required: string[] | undefined) {
  const reflector = new Reflector();
  reflector.getAllAndOverride = ((key: string) =>
    key === PERMISSIONS_KEY ? required : undefined) as unknown as Reflector["getAllAndOverride"];
  return new PermissionsGuard(reflector);
}

describe("PermissionsGuard", () => {
  it("allows when no permissions are required", () => {
    expect(guardWith(undefined).canActivate(ctx(undefined))).toBe(true);
  });

  it("allows when the user has every required permission", () => {
    const user = { permissions: ["users.read", "users.manage"] };
    expect(guardWith(["users.manage"]).canActivate(ctx(user))).toBe(true);
  });

  it("forbids when a permission is missing", () => {
    const user = { permissions: ["users.read"] };
    expect(() => guardWith(["users.manage"]).canActivate(ctx(user))).toThrow(ForbiddenException);
  });
});
