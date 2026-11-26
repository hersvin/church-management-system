import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { JoinRequestCreateInput, JoinRequestDecisionInput, PhotoUploadInput, ScanCheckInInput, SelfCheckInInput, SelfProfileUpdateInput, SelfRegistrationInput } from "@cms/shared";
import { CheckInService } from "../attendance/check-in.service";
import { AuditService } from "../audit/audit.service";
import { isChurchWide, type SessionUser } from "../auth/session-user";
import { branchFilter } from "../common/branch-scope";
import { EventsService } from "../events/events.service";
import { PrismaService } from "../prisma/prisma.service";
import QRCode from "qrcode";
import { QrTokens } from "./qr-token";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Self check-in opens this long before a service starts; service codes last this long after. */
const OPENS_BEFORE = 3 * HOUR;
const OPEN_AFTER = 6 * HOUR;
const CARD_LIFETIME = 180 * DAY;

/** QR image as SVG in the app's ink-on-paper colors; medium error correction survives a scuffed print. */
const qrSvg = (token: string) =>
  QRCode.toString(token, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#141310", light: "#f4f1ea" } });

/** The first bytes every file of that type starts with. */
const PHOTO_SIGNATURES: Record<PhotoUploadInput["mimeType"], Buffer> = {
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff]),
  "image/png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
};

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

/**
 * Everything the mobile app does for the signed-in person: their member profile, QR card,
 * self check-in, attendance, ministries, and events. Responses carry only the person's own data
 * and public details (service times, ministry and event names), never other people's records.
 */
@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly checkIns: CheckInService,
    private readonly events: EventsService,
    private readonly tokens: QrTokens,
  ) {}

  /** The member record linked to this account, or 404. */
  private async linked(actor: SessionUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, tokenVersion: true, memberId: true, member: { select: { id: true, branchId: true } } },
    });
    if (!user?.member) throw new NotFoundException("This account is not linked to a member record. Ask the church office to link it.");
    return { user, member: user.member };
  }

  /**
   * The linked member, or null for accounts without one (staff and admins). Lists still work for them;
   * the home campus is then the account's branch (none for church-wide accounts).
   */
  private async optionalMember(actor: SessionUser): Promise<{ id: string | null; campus: string | null }> {
    const user = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { member: { select: { id: true, branchId: true } } } });
    return user?.member ? { id: user.member.id, campus: user.member.branchId } : { id: null, campus: actor.branchId };
  }

  async profile(actor: SessionUser) {
    const { member } = await this.linked(actor);
    return this.readProfile(member.id);
  }

  /** A member editing their own contact and personal details; the change is audited like an office edit. */
  async updateProfile(actor: SessionUser, input: SelfProfileUpdateInput) {
    const { member } = await this.linked(actor);
    await this.prisma.member.update({ where: { id: member.id }, data: input });
    await this.audit.record({
      actorId: actor.id,
      action: "member.self_update",
      entity: "Member",
      entityId: member.id,
      branchId: member.branchId,
      changes: input,
    });
    return this.readProfile(member.id);
  }

  /** Who is signed in, for every account type: name, role, campus, and the photo version for cache busting. */
  async account(actor: SessionUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: { select: { key: true, name: true } },
        branch: { select: { id: true, name: true } },
        photo: { select: { updatedAt: true } },
      },
    });
    if (!user) throw new NotFoundException("Account not found");
    const { photo, ...rest } = user;
    return { ...rest, photoUpdatedAt: photo?.updatedAt ?? null, ministries: await this.ministriesServed(actor) };
  }

  /**
   * The ministries this account serves in through its linked member record, with the position (ministry role)
   * when one is set. Staff see events by these; ushers get the door scanner.
   */
  async ministriesServed(actor: SessionUser) {
    const rows = await this.prisma.ministryMember.findMany({
      where: { leftAt: null, member: { user: { id: actor.id }, deletedAt: null }, ministry: { deletedAt: null } },
      select: { ministry: { select: { id: true, name: true } }, ministryRole: { select: { name: true } } },
      orderBy: { ministry: { name: "asc" } },
    });
    return rows.map((r) => ({ id: r.ministry.id, name: r.ministry.name, position: r.ministryRole?.name ?? null }));
  }

  /** Saves the account's profile photo after checking the bytes really are the stated image type. */
  async setPhoto(actor: SessionUser, input: PhotoUploadInput) {
    const data = Buffer.from(input.data, "base64");
    const signature = PHOTO_SIGNATURES[input.mimeType];
    if (data.length < signature.length || !data.subarray(0, signature.length).equals(signature)) {
      throw new BadRequestException("This photo is not a valid JPEG or PNG image");
    }
    const saved = await this.prisma.userPhoto.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id, mimeType: input.mimeType, data },
      update: { mimeType: input.mimeType, data },
      select: { updatedAt: true },
    });
    await this.audit.record({
      actorId: actor.id,
      action: "user.photo_update",
      entity: "User",
      entityId: actor.id,
      branchId: actor.branchId,
      changes: { mimeType: input.mimeType, bytes: data.length },
    });
    return { photoUpdatedAt: saved.updatedAt };
  }

  async photo(actor: SessionUser) {
    const photo = await this.prisma.userPhoto.findUnique({
      where: { userId: actor.id },
      select: { mimeType: true, data: true, updatedAt: true },
    });
    if (!photo) throw new NotFoundException("No profile photo");
    return photo;
  }

  async removePhoto(actor: SessionUser) {
    await this.prisma.userPhoto.deleteMany({ where: { userId: actor.id } });
    await this.audit.record({ actorId: actor.id, action: "user.photo_remove", entity: "User", entityId: actor.id, branchId: actor.branchId });
  }

  private readProfile(memberId: string) {
    return this.prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        email: true,
        phone: true,
        address: true,
        occupation: true,
        gender: true,
        civilStatus: true,
        birthDate: true,
        status: true,
        membershipDate: true,
        baptismDate: true,
        branch: { select: { id: true, name: true } },
        household: {
          select: {
            name: true,
            members: { where: { deletedAt: null }, select: { id: true, firstName: true, lastName: true, householdRole: true } },
          },
        },
      },
    });
  }

  /** The member's personal QR card for ushers to scan; revoked when the account signs out everywhere. */
  async qr(actor: SessionUser, now = new Date()) {
    const { user, member } = await this.linked(actor);
    const expiresAt = new Date(now.getTime() + CARD_LIFETIME);
    const token = this.tokens.sign({ type: "member", id: member.id, version: user.tokenVersion }, expiresAt);
    return { token, expiresAt, svg: await qrSvg(token) };
  }

  async selfCheckIn(actor: SessionUser, input: SelfCheckInInput, now = new Date()) {
    const { member } = await this.linked(actor);
    const claims = this.tokens.verify(input.token, "service", now);
    if (!claims) throw new BadRequestException("This is not a valid service code. Scan the code posted at the entrance.");
    const service = await this.prisma.service.findFirst({ where: { id: claims.id, deletedAt: null } });
    if (!service) throw new BadRequestException("This service no longer exists");
    if (now.getTime() < service.startsAt.getTime() - OPENS_BEFORE) {
      throw new BadRequestException("Check-in is not open yet. It opens three hours before the service.");
    }
    try {
      const created = await this.prisma.checkIn.create({
        data: { kind: "ATTENDEE", serviceId: service.id, branchId: service.branchId, memberId: member.id, checkedInById: actor.id },
        select: { id: true, checkedInAt: true },
      });
      await this.audit.record({
        actorId: actor.id,
        action: "attendance.self_check_in",
        entity: "CheckIn",
        entityId: created.id,
        branchId: service.branchId,
        changes: { serviceId: service.id, memberId: member.id },
      });
      return { ...created, service: { id: service.id, name: service.name, startsAt: service.startsAt } };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("You are already checked in to this service");
      throw error;
    }
  }

  /** An usher scanning a member's card: the normal check-in rules (branch, duplicates, audit) apply. */
  async scan(actor: SessionUser, serviceId: string, input: ScanCheckInInput, now = new Date()) {
    const claims = this.tokens.verify(input.token, "member", now);
    if (!claims) throw new BadRequestException("This is not a valid member card");
    const owner = await this.prisma.user.findFirst({ where: { memberId: claims.id }, select: { tokenVersion: true } });
    if (!owner || owner.tokenVersion !== claims.version) {
      throw new BadRequestException("This member card is no longer valid. Ask the member to open a fresh one in the app.");
    }
    return this.checkIns.checkIn(actor, { type: "service", id: serviceId }, { kind: "ATTENDEE", memberId: claims.id });
  }

  /** The code to print or show at the entrance; valid until six hours after the service starts. */
  async serviceQr(actor: SessionUser, serviceId: string, now = new Date()) {
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, deletedAt: null, ...branchFilter(actor) } });
    if (!service) throw new NotFoundException("Service not found");
    const expiresAt = new Date(service.startsAt.getTime() + OPEN_AFTER);
    if (expiresAt <= now) throw new BadRequestException("This service has finished");
    const token = this.tokens.sign({ type: "service", id: service.id }, expiresAt);
    return { token, expiresAt, svg: await qrSvg(token), service: { id: service.id, name: service.name, startsAt: service.startsAt } };
  }

  async attendance(actor: SessionUser) {
    const { member } = await this.linked(actor);
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const [items, thisYear] = await Promise.all([
      this.prisma.checkIn.findMany({
        where: { memberId: member.id },
        select: {
          id: true,
          checkedInAt: true,
          service: { select: { id: true, name: true, startsAt: true, branch: { select: { name: true } } } },
          event: { select: { id: true, title: true, startsAt: true, branch: { select: { name: true } } } },
        },
        orderBy: { checkedInAt: "desc" },
        take: 50,
      }),
      this.prisma.checkIn.count({ where: { memberId: member.id, checkedInAt: { gte: yearStart } } }),
    ]);
    return { items, thisYear };
  }

  /** Upcoming services at every campus for the next two weeks, marking the ones the member checked in to. */
  async services(actor: SessionUser, now = new Date()) {
    const member = await this.optionalMember(actor);
    const services = await this.prisma.service.findMany({
      where: { deletedAt: null, startsAt: { gte: new Date(now.getTime() - OPEN_AFTER), lt: new Date(now.getTime() + 14 * DAY) } },
      select: { id: true, name: true, startsAt: true, branchId: true, branch: { select: { name: true, address: true } } },
      orderBy: { startsAt: "asc" },
    });
    const mine = new Set(
      member.id
        ? (
            await this.prisma.checkIn.findMany({
              where: { memberId: member.id, serviceId: { in: services.map((s) => s.id) } },
              select: { serviceId: true },
            })
          ).map((c) => c.serviceId)
        : [],
    );
    return services.map((s) => ({ ...s, myCampus: s.branchId === member.campus, checkedIn: mine.has(s.id) }));
  }

  /** Active ministries with the member's place in each: serving, asked, or neither. */
  async ministries(actor: SessionUser) {
    const member = await this.optionalMember(actor);
    const none = Promise.resolve([] as { ministryId: string }[]);
    const [ministries, roster, pending] = await Promise.all([
      this.prisma.ministry.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, description: true, category: true, meetingSchedule: true, branch: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      member.id ? this.prisma.ministryMember.findMany({ where: { memberId: member.id, leftAt: null }, select: { ministryId: true } }) : none,
      member.id
        ? this.prisma.ministryJoinRequest.findMany({ where: { memberId: member.id, status: "PENDING" }, select: { ministryId: true } })
        : none,
    ]);
    const serving = new Set(roster.map((r) => r.ministryId));
    const asked = new Set(pending.map((r) => r.ministryId));
    return ministries.map((m) => ({ ...m, status: serving.has(m.id) ? "SERVING" : asked.has(m.id) ? "PENDING" : null }));
  }

  async requestJoin(actor: SessionUser, input: JoinRequestCreateInput) {
    const { member } = await this.linked(actor);
    const ministry = await this.prisma.ministry.findFirst({ where: { id: input.ministryId, deletedAt: null, isActive: true } });
    if (!ministry) throw new NotFoundException("Ministry not found");
    const serving = await this.prisma.ministryMember.findFirst({ where: { ministryId: ministry.id, memberId: member.id, leftAt: null } });
    if (serving) throw new ConflictException("You already serve in this ministry");
    try {
      const request = await this.prisma.ministryJoinRequest.create({
        data: { ministryId: ministry.id, memberId: member.id, ...(input.note ? { note: input.note } : {}) },
      });
      await this.audit.record({ actorId: actor.id, action: "ministries.join_request", entity: "Ministry", entityId: ministry.id, branchId: ministry.branchId });
      return request;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("You already asked to join this ministry");
      throw error;
    }
  }

  /** Pending requests for one ministry, for its leaders (ministries.manage, own branch). */
  async ministryRequests(actor: SessionUser, ministryId: string) {
    const ministry = await this.prisma.ministry.findFirst({ where: { id: ministryId, deletedAt: null, ...branchFilter(actor) } });
    if (!ministry) throw new NotFoundException("Ministry not found");
    return this.prisma.ministryJoinRequest.findMany({
      where: { ministryId, status: "PENDING" },
      select: { id: true, note: true, createdAt: true, member: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async decide(actor: SessionUser, requestId: string, input: JoinRequestDecisionInput, now = new Date()) {
    const request = await this.prisma.ministryJoinRequest.findFirst({
      where: { id: requestId },
      select: { id: true, status: true, memberId: true, ministryId: true, ministry: { select: { branchId: true } } },
    });
    if (!request || (!isChurchWide(actor) && request.ministry.branchId !== actor.branchId)) throw new NotFoundException("Request not found");
    if (request.status !== "PENDING") throw new ConflictException("This request has already been decided");
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ministryJoinRequest.update({
        where: { id: requestId },
        data: { status: input.decision, decidedAt: now, decidedById: actor.id },
      });
      if (input.decision === "APPROVED") {
        const serving = await tx.ministryMember.findFirst({ where: { ministryId: request.ministryId, memberId: request.memberId, leftAt: null } });
        if (!serving) await tx.ministryMember.create({ data: { ministryId: request.ministryId, memberId: request.memberId, position: "MEMBER" } });
      }
      return updated;
    });
    await this.audit.record({
      actorId: actor.id,
      action: input.decision === "APPROVED" ? "ministries.approve_join" : "ministries.decline_join",
      entity: "Ministry",
      entityId: request.ministryId,
      branchId: request.ministry.branchId,
      changes: { requestId, memberId: request.memberId },
    });
    return result;
  }

  /** Upcoming events at the member's campus, marking the ones they registered for. */
  /**
   * Upcoming events for the Events tab. Admins and pastors see every event at every branch;
   * staff see the events of the ministries they serve in, at any branch.
   */
  async upcomingEvents(actor: SessionUser, now = new Date()) {
    const member = await this.optionalMember(actor);
    let scope: { ministryId?: { in: string[] } } = {};
    if (!isChurchWide(actor)) {
      const ministries = await this.ministriesServed(actor);
      if (ministries.length === 0) return [];
      scope = { ministryId: { in: ministries.map((m) => m.id) } };
    }
    const events = await this.prisma.event.findMany({
      where: { ...scope, status: "SCHEDULED", endsAt: { gte: now }, startsAt: { lt: new Date(now.getTime() + 60 * DAY) } },
      select: {
        id: true,
        title: true,
        branch: { select: { name: true } },
        ministry: { select: { name: true } },
        description: true,
        category: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        registrationRequired: true,
        room: { select: { name: true } },
        _count: { select: { registrations: { where: { cancelledAt: null } } } },
        // Accounts without a member record have no registrations; this filter then matches nothing.
        registrations: { where: { memberId: member.id ?? "00000000-0000-0000-0000-000000000000", cancelledAt: null }, select: { id: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 30,
    });
    return events.map(({ registrations, _count, ...e }) => ({
      ...e,
      registered: _count.registrations,
      myRegistrationId: registrations[0]?.id ?? null,
    }));
  }

  /**
   * One event for its detail screen, under the same rule as the Events tab: admins and pastors see any event;
   * staff only events of their ministries (anything else is a 404, so other events are not revealed).
   */
  async eventDetail(actor: SessionUser, id: string) {
    const member = await this.optionalMember(actor);
    let scope: { ministryId?: { in: string[] } } = {};
    if (!isChurchWide(actor)) {
      const ministries = await this.ministriesServed(actor);
      if (ministries.length === 0) throw new NotFoundException("Event not found");
      scope = { ministryId: { in: ministries.map((m) => m.id) } };
    }
    const none = "00000000-0000-0000-0000-000000000000";
    const event = await this.prisma.event.findFirst({
      where: { id, ...scope },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        registrationRequired: true,
        status: true,
        cancelReason: true,
        branch: { select: { name: true, address: true, phone: true } },
        room: { select: { name: true, location: true } },
        ministry: { select: { name: true } },
        _count: { select: { registrations: { where: { cancelledAt: null } } } },
        // Accounts without a member record match nothing here.
        registrations: { where: { memberId: member.id ?? none, cancelledAt: null }, select: { id: true } },
        checkIns: { where: { memberId: member.id ?? none }, select: { checkedInAt: true }, take: 1 },
      },
    });
    if (!event) throw new NotFoundException("Event not found");
    const { _count, registrations, checkIns, ...rest } = event;
    return {
      ...rest,
      registered: _count.registrations,
      myRegistrationId: registrations[0]?.id ?? null,
      checkedIn: checkIns.length > 0,
    };
  }

  /** One service for its detail screen: where and when, the check-in window, and whether this person is checked in. */
  async serviceDetail(actor: SessionUser, id: string, now = new Date()) {
    const member = await this.optionalMember(actor);
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        startsAt: true,
        notes: true,
        branchId: true,
        branch: { select: { name: true, address: true, phone: true } },
        _count: { select: { checkIns: true } },
      },
    });
    if (!service) throw new NotFoundException("Service not found");
    const mine = member.id
      ? await this.prisma.checkIn.findFirst({ where: { serviceId: id, memberId: member.id }, select: { checkedInAt: true } })
      : null;
    const opensAt = new Date(service.startsAt.getTime() - OPENS_BEFORE);
    const closesAt = new Date(service.startsAt.getTime() + OPEN_AFTER);
    const { _count, branchId, ...rest } = service;
    return {
      ...rest,
      myCampus: branchId === member.campus,
      checkedIn: Boolean(mine),
      checkedInAt: mine?.checkedInAt ?? null,
      checkInOpensAt: opensAt,
      checkInClosesAt: closesAt,
      checkInOpen: now >= opensAt && now <= closesAt,
      // The headcount is for people who take attendance, not for every member.
      ...(actor.permissions.includes("attendance.read") ? { checkIns: _count.checkIns } : {}),
    };
  }

  async registerForEvent(actor: SessionUser, input: SelfRegistrationInput) {
    const { member } = await this.linked(actor);
    return this.events.register(actor, input.eventId, { memberId: member.id });
  }
}
