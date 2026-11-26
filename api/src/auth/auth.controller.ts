import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { loginSchema, type LoginInput } from "@cms/shared";
import type { Request, Response } from "express";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ENV, type Env } from "../config/env";
import { ZodBody } from "../docs/zod-openapi";
import { AuthService } from "./auth.service";
import { CurrentUser, Public } from "./decorators";
import { SESSION_COOKIE, type SessionUser } from "./session-user";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  @HttpCode(200)
  @ZodBody(loginSchema)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser> {
    const { accessToken, user } = await this.auth.login(body, req.ip);
    res.cookie(SESSION_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.env.NODE_ENV === "production",
      maxAge: this.env.JWT_EXPIRES_IN_SECONDS * 1000,
      path: "/",
    });
    return user;
  }

  /**
   * Sign-in for native apps (the church mobile app): same checks and rate limit as login, but the
   * token comes back in the body for secure on-device storage instead of as a cookie.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("token")
  @HttpCode(200)
  @ZodBody(loginSchema)
  async token(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput, @Req() req: Request) {
    const { accessToken, user } = await this.auth.login(body, req.ip);
    return { accessToken, user };
  }

  @ApiCookieAuth("cookie")
  @Post("logout")
  @HttpCode(204)
  async logout(@CurrentUser() user: SessionUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }

  @ApiCookieAuth("cookie")
  @Get("me")
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }
}
