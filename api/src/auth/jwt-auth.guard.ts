import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { IS_PUBLIC_KEY } from "./decorators";
import { SESSION_COOKIE, type SessionUser, type TokenPayload } from "./session-user";

function extractToken(req: Request): string | undefined {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
  if (cookie) return cookie;
  const [scheme, value] = req.headers.authorization?.split(" ") ?? [];
  return scheme === "Bearer" ? value : undefined;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const token = extractToken(req);
    if (!token) throw new UnauthorizedException("Authentication required");

    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token);
    } catch {
      throw new UnauthorizedException("Session expired");
    }
    req.user = await this.auth.resolveSession(payload);
    return true;
  }
}
