import { Controller, Get, Query } from "@nestjs/common";
import { paginationSchema, type PaginationInput } from "@cms/shared";
import { RequirePermissions } from "../auth/decorators";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodQuery } from "../docs/zod-openapi";
import { AuditService } from "./audit.service";

@ApiProtected("Audit")
@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions("audit.read")
  @ZodQuery(paginationSchema)
  list(@Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput) {
    return this.audit.list(query);
  }
}
