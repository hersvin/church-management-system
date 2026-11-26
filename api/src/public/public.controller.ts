import { Controller, Get, Header } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../auth/decorators";
import { PublicService } from "./public.service";

/** Unauthenticated, read-only data for the public landing page. */
@ApiTags("Public")
@Controller("public")
export class PublicController {
  constructor(private readonly publicData: PublicService) {}

  @Public()
  @Get("landing")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header("Cache-Control", "public, max-age=300")
  landing() {
    return this.publicData.landing();
  }

  @Public()
  @Get("videos")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header("Cache-Control", "public, max-age=600")
  videos() {
    return this.publicData.videos();
  }
}
