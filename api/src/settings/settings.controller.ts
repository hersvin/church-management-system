import { Body, Controller, ForbiddenException, Get, Put, Query } from "@nestjs/common";
import { settingUpsertSchema, type SettingUpsertInput } from "@cms/shared";
import { z } from "zod";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import { isChurchWide, type SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodBody, ZodQuery } from "../docs/zod-openapi";
import { SettingsService } from "./settings.service";

const settingsQuerySchema = z.object({ branchId: z.uuid().optional() });

@ApiProtected("Settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @RequirePermissions("settings.read")
  @ZodQuery(settingsQuerySchema)
  get(
    @CurrentUser() actor: SessionUser,
    @Query(new ZodValidationPipe(settingsQuerySchema)) query: z.infer<typeof settingsQuerySchema>,
  ) {
    const branchId = isChurchWide(actor) ? (query.branchId ?? null) : actor.branchId;
    return this.settings.effective(branchId);
  }

  @Put()
  @RequirePermissions("settings.manage")
  @ZodBody(settingUpsertSchema)
  upsert(
    @CurrentUser() actor: SessionUser,
    @Body(new ZodValidationPipe(settingUpsertSchema)) body: SettingUpsertInput,
  ) {
    if (!isChurchWide(actor) && body.branchId !== actor.branchId) {
      throw new ForbiddenException("You can only change settings for your own branch");
    }
    return this.settings.upsert(actor.id, body);
  }
}
