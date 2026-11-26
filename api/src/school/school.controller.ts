import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from "@nestjs/common";
import {
  attendanceSaveSchema,
  classCreateSchema,
  classListQuerySchema,
  classUpdateSchema,
  enrollmentCreateSchema,
  enrollmentUpdateSchema,
  schoolStatsQuerySchema,
  sessionCreateSchema,
  teacherAddSchema,
  termCreateSchema,
  termListQuerySchema,
  termUpdateSchema,
  type AttendanceSaveInput,
  type ClassCreateInput,
  type ClassListQuery,
  type ClassUpdateInput,
  type EnrollmentCreateInput,
  type EnrollmentUpdateInput,
  type SessionCreateInput,
  type TeacherAddInput,
  type TermCreateInput,
  type TermUpdateInput,
} from "@cms/shared";
import type { z } from "zod";
import { CurrentUser, RequirePermissions } from "../auth/decorators";
import type { SessionUser } from "../auth/session-user";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ApiProtected, ZodBody, ZodQuery } from "../docs/zod-openapi";
import { AttendanceService } from "./attendance.service";
import { SchoolService } from "./school.service";

const uuid = new ParseUUIDPipe();
const pipe = <T extends z.ZodType>(schema: T) => new ZodValidationPipe(schema);

@ApiProtected("School")
@Controller()
export class SchoolController {
  constructor(
    private readonly school: SchoolService,
    private readonly attendance: AttendanceService,
  ) {}

  // Terms

  @Get("school/terms")
  @RequirePermissions("school.read")
  @ZodQuery(termListQuerySchema)
  listTerms(@CurrentUser() actor: SessionUser, @Query(pipe(termListQuerySchema)) q: z.infer<typeof termListQuerySchema>) {
    return this.school.listTerms(actor, q.branchId);
  }

  @Post("school/terms")
  @RequirePermissions("school.manage")
  @ZodBody(termCreateSchema)
  createTerm(@CurrentUser() actor: SessionUser, @Body(pipe(termCreateSchema)) body: TermCreateInput) {
    return this.school.createTerm(actor, body);
  }

  @Patch("school/terms/:id")
  @RequirePermissions("school.manage")
  @ZodBody(termUpdateSchema)
  updateTerm(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(termUpdateSchema)) body: TermUpdateInput) {
    return this.school.updateTerm(actor, id, body);
  }

  @Delete("school/terms/:id")
  @HttpCode(204)
  @RequirePermissions("school.manage")
  archiveTerm(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.school.archiveTerm(actor, id);
  }

  // Classes

  @Get("school/classes")
  @RequirePermissions("school.read")
  @ZodQuery(classListQuerySchema)
  listClasses(@CurrentUser() actor: SessionUser, @Query(pipe(classListQuerySchema)) q: ClassListQuery) {
    return this.school.listClasses(actor, q);
  }

  @Get("school/stats")
  @RequirePermissions("school.read")
  @ZodQuery(schoolStatsQuerySchema)
  stats(@CurrentUser() actor: SessionUser, @Query(pipe(schoolStatsQuerySchema)) q: z.infer<typeof schoolStatsQuerySchema>) {
    return this.school.stats(actor, q.branchId);
  }

  @Get("school/classes/:id")
  @RequirePermissions("school.read")
  getClass(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.school.getClass(actor, id);
  }

  @Post("school/classes")
  @RequirePermissions("school.manage")
  @ZodBody(classCreateSchema)
  createClass(@CurrentUser() actor: SessionUser, @Body(pipe(classCreateSchema)) body: ClassCreateInput) {
    return this.school.createClass(actor, body);
  }

  @Patch("school/classes/:id")
  @RequirePermissions("school.manage")
  @ZodBody(classUpdateSchema)
  updateClass(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(classUpdateSchema)) body: ClassUpdateInput) {
    return this.school.updateClass(actor, id, body);
  }

  @Delete("school/classes/:id")
  @HttpCode(204)
  @RequirePermissions("school.manage")
  archiveClass(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.school.archiveClass(actor, id);
  }

  // Teachers

  @Post("school/classes/:id/teachers")
  @RequirePermissions("school.manage")
  @ZodBody(teacherAddSchema)
  addTeacher(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(teacherAddSchema)) body: TeacherAddInput) {
    return this.school.addTeacher(actor, id, body);
  }

  @Delete("school/classes/:id/teachers/:memberId")
  @HttpCode(204)
  @RequirePermissions("school.manage")
  removeTeacher(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Param("memberId", uuid) memberId: string) {
    return this.school.removeTeacher(actor, id, memberId);
  }

  // Enrollment

  @Post("school/classes/:id/enrollments")
  @RequirePermissions("school.manage")
  @ZodBody(enrollmentCreateSchema)
  enroll(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(enrollmentCreateSchema)) body: EnrollmentCreateInput) {
    return this.school.enroll(actor, id, body);
  }

  @Patch("school/enrollments/:id")
  @RequirePermissions("school.manage")
  @ZodBody(enrollmentUpdateSchema)
  updateEnrollment(
    @CurrentUser() actor: SessionUser,
    @Param("id", uuid) id: string,
    @Body(pipe(enrollmentUpdateSchema)) body: EnrollmentUpdateInput,
  ) {
    return this.school.updateEnrollment(actor, id, body);
  }

  // Sessions and attendance

  @Get("school/classes/:id/sessions")
  @RequirePermissions("school.read")
  listSessions(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.attendance.listSessions(actor, id);
  }

  @Post("school/classes/:id/sessions")
  @RequirePermissions("school.manage")
  @ZodBody(sessionCreateSchema)
  createSession(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(sessionCreateSchema)) body: SessionCreateInput) {
    return this.attendance.createSession(actor, id, body);
  }

  @Get("school/sessions/:id")
  @RequirePermissions("school.read")
  getSession(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.attendance.getSession(actor, id);
  }

  @Put("school/sessions/:id/attendance")
  @RequirePermissions("school.manage")
  @ZodBody(attendanceSaveSchema)
  saveAttendance(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string, @Body(pipe(attendanceSaveSchema)) body: AttendanceSaveInput) {
    return this.attendance.saveAttendance(actor, id, body);
  }

  // Member history

  @Get("members/:id/school")
  @RequirePermissions("school.read")
  forMember(@CurrentUser() actor: SessionUser, @Param("id", uuid) id: string) {
    return this.school.forMember(actor, id);
  }
}
