import { Controller, Get, Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ApiTags } from "@nestjs/swagger";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AttendanceController } from "./attendance/attendance.controller";
import { CheckInService } from "./attendance/check-in.service";
import { ServicesService } from "./attendance/services.service";
import { AuditController } from "./audit/audit.controller";
import { AuditService } from "./audit/audit.service";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { Public } from "./auth/decorators";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { PermissionsGuard } from "./auth/permissions.guard";
import { BranchesController } from "./branches/branches.controller";
import { BranchesService } from "./branches/branches.service";
import { ENV, parseEnv, type Env } from "./config/env";
import { HouseholdsService } from "./members/households.service";
import { HouseholdsController, MembersController } from "./members/members.controller";
import { MembersService } from "./members/members.service";
import { MinistriesController } from "./ministries/ministries.controller";
import { MinistriesService } from "./ministries/ministries.service";
import { EventsController } from "./events/events.controller";
import { EventsService } from "./events/events.service";
import { PrismaService } from "./prisma/prisma.service";
import { PublicController } from "./public/public.controller";
import { PublicService } from "./public/public.service";
import { YoutubeFeed } from "./public/youtube";
import { MusicCatalog } from "./music/catalog";
import { MusicController } from "./music/music.controller";
import { MusicService } from "./music/music.service";
import { MeController, QrStaffController } from "./me/me.controller";
import { MeService } from "./me/me.service";
import { QrTokens } from "./me/qr-token";
import { ReportsController } from "./reports/reports.controller";
import { ReportsService } from "./reports/reports.service";
import { BookingsService } from "./rooms/bookings.service";
import { BookingsController, RoomsController } from "./rooms/rooms.controller";
import { RoomsService } from "./rooms/rooms.service";
import { AttendanceService } from "./school/attendance.service";
import { SchoolController } from "./school/school.controller";
import { SchoolService } from "./school/school.service";
import { SettingsController } from "./settings/settings.controller";
import { SettingsService } from "./settings/settings.service";
import { UsersController } from "./users/users.controller";
import { UsersService } from "./users/users.service";

@ApiTags("Health")
@Controller("health")
class HealthController {
  @Public()
  @Get()
  check() {
    return { status: "ok" };
  }
}

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => parseEnv(process.env) },
    PrismaService,
    AuditService,
  ],
  exports: [ENV, PrismaService, AuditService],
})
class CoreModule {}

@Module({
  imports: [
    CoreModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_SECRET,
        signOptions: { expiresIn: env.JWT_EXPIRES_IN_SECONDS },
      }),
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    BranchesController,
    SettingsController,
    AuditController,
    MembersController,
    HouseholdsController,
    MinistriesController,
    RoomsController,
    BookingsController,
    EventsController,
    SchoolController,
    AttendanceController,
    ReportsController,
    PublicController,
    MusicController,
    MeController,
    QrStaffController,
  ],
  providers: [
    AuthService,
    UsersService,
    BranchesService,
    SettingsService,
    MembersService,
    HouseholdsService,
    MinistriesService,
    RoomsService,
    BookingsService,
    EventsService,
    SchoolService,
    AttendanceService,
    ServicesService,
    CheckInService,
    ReportsService,
    PublicService,
    YoutubeFeed,
    { provide: MusicCatalog, inject: [ENV], useFactory: (env: Env) => new MusicCatalog(env.MUSICBRAINZ_CONTACT) },
    MusicService,
    MeService,
    { provide: QrTokens, inject: [ENV], useFactory: (env: Env) => new QrTokens(env.JWT_SECRET) },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
