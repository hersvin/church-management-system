import { Controller, Get, Header, Param, Query, Res } from "@nestjs/common";
import { ApiParam, ApiProduces } from "@nestjs/swagger";
import { REPORT_KINDS, reportKindSchema, reportQuerySchema, type ReportKind, type ReportQuery } from "@cms/shared";
import type { Response } from "express";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodQuery } from "../docs/zod-openapi";
import { ReportsService } from "./reports.service";

const kindPipe = new ZodValidationPipe(reportKindSchema);
const queryPipe = new ZodValidationPipe(reportQuerySchema);
const KIND_PARAM = { name: "kind", enum: [...REPORT_KINDS] };

@ApiProtected("Reports")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(":kind")
  @RequirePermissions("reports.read")
  @ApiParam(KIND_PARAM)
  @ZodQuery(reportQuerySchema)
  get(@CurrentUser() actor: SessionUser, @Param("kind", kindPipe) kind: ReportKind, @Query(queryPipe) q: ReportQuery) {
    return this.reports.build(actor, kind, q);
  }

  @Get(":kind/csv")
  @RequirePermissions("reports.read")
  @ApiParam(KIND_PARAM)
  @ZodQuery(reportQuerySchema)
  @ApiProduces("text/csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async csv(
    @CurrentUser() actor: SessionUser,
    @Param("kind", kindPipe) kind: ReportKind,
    @Query(queryPipe) q: ReportQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.reports.exportCsv(actor, kind, q);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    return file.body;
  }
}
