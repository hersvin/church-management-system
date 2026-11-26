import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { LoginInput, RoleKey } from "@cms/shared";
import bcrypt from "bcryptjs";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { SessionUser, TokenPayload } from "./session-user";

const INVALID_CREDENTIALS = "Invalid email or password";
// Compared against when the email is unknown so response timing does not reveal account existence.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("dummy-password-for-timing", 12));

interface UserWithRole {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  tokenVersion: number;
  branchId: string | null;
  role: { key: string; permissions: string[] };
}

function toSessionUser(user: UserWithRole): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roleKey: user.role.key as RoleKey,
    branchId: user.branchId,
    permissions: user.role.permissions,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(input: LoginInput, ipAddress?: string) {
    const user = (await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { role: true },
    })) as UserWithRole | null;

    const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? getDummyHash());
    if (!user || !passwordOk || !user.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.record({
      actorId: user.id,
      action: "auth.login",
      entity: "User",
      entityId: user.id,
      branchId: user.branchId,
      ipAddress: ipAddress ?? null,
    });

    const payload: TokenPayload = { sub: user.id, ver: user.tokenVersion };
    return { accessToken: await this.jwt.signAsync(payload), user: toSessionUser(user) };
  }

  async resolveSession(payload: TokenPayload): Promise<SessionUser> {
    const user = (await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    })) as UserWithRole | null;
    if (!user || !user.isActive || user.tokenVersion !== payload.ver) {
      throw new UnauthorizedException("Session expired");
    }
    return toSessionUser(user);
  }

  async logout(user: SessionUser): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    await this.audit.record({ actorId: user.id, action: "auth.logout", entity: "User", entityId: user.id });
  }
}
