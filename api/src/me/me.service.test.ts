import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRANCH_A, BRANCH_B, branchStaff } from "../test/actors";
import { createPrismaMock, type PrismaMock } from "../test/prisma-mock";
import { MeService } from "./me.service";
import { QrTokens } from "./qr-token";

const SECRET = "q".repeat(32);
const NOW = new Date("2026-11-29T00:30:00Z"); // Sunday 8:30 AM in Manila
const SERVICE = "99999999-9999-4999-8999-999999999999";
const MEMBER = "33333333-3333-4333-8333-333333333333";
const MINISTRY = "44444444-4444-4444-8444-444444444444";
const EVENT = "55555555-5555-4555-8555-555555555555";
const REQUEST = "66666666-6666-4666-8666-666666666666";

const member = { ...branchStaff, id: "77777777-7777-4777-8777-777777777777", roleKey: "STAFF" as const, permissions: [] };
const linkedUser = { id: member.id, tokenVersion: 2, memberId: MEMBER, member: { id: MEMBER, branchId: BRANCH_A } };
const service = { id: SERVICE, name: "Sunday Worship 9 AM", startsAt: new Date("2026-11-29T01:00:00Z"), branchId: BRANCH_A, deletedAt: null };
const p2002 = Object.assign(new Error("unique"), { code: "P2002" });

describe("MeService", () => {
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };
  let checkIns: { checkIn: ReturnType<typeof vi.fn> };
  let events: { register: ReturnType<typeof vi.fn> };
  let qr: QrTokens;
  let me: MeService;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = { record: vi.fn() };
    checkIns = { checkIn: vi.fn().mockResolvedValue({ id: "c1" }) };
    events = { register: vi.fn().mockResolvedValue({ id: "r1" }) };
    qr = new QrTokens(SECRET);
    me = new MeService(prisma as never, audit as never, checkIns as never, events as never, qr);
    prisma.user.findUnique.mockResolvedValue(linkedUser);
  });

  describe("linked member", () => {
    it("refuses member features for an account with no member record", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...linkedUser, memberId: null, member: null });
      await expect(me.qr(member, NOW)).rejects.toThrow(NotFoundException);
      await expect(me.selfCheckIn(member, { token: "cmsqr1.x.y" }, NOW)).rejects.toThrow(NotFoundException);
    });
  });

  describe("member QR card", () => {
    it("signs the member ID with the account's token version, valid for 180 days", async () => {
      const card = await me.qr(member, NOW);
      expect(qr.verify(card.token, "member", NOW)).toMatchObject({ id: MEMBER, version: 2 });
      expect(card.expiresAt.getTime() - NOW.getTime()).toBe(180 * 24 * 60 * 60 * 1000);
      expect(card.svg.startsWith("<svg")).toBe(true);
      expect(card.svg.trim().endsWith("</svg>")).toBe(true);
    });
  });

  describe("self check-in", () => {
    const token = () => qr.sign({ type: "service", id: SERVICE }, new Date("2026-11-29T07:00:00Z"));

    it("checks the member in to the service on the QR", async () => {
      prisma.service.findFirst.mockResolvedValue(service);
      prisma.checkIn.create.mockResolvedValue({ id: "c1", checkedInAt: NOW });
      const result = await me.selfCheckIn(member, { token: token() }, NOW);
      expect(prisma.checkIn.create.mock.calls[0][0].data).toEqual({
        kind: "ATTENDEE",
        serviceId: SERVICE,
        branchId: BRANCH_A,
        memberId: MEMBER,
        checkedInById: member.id,
      });
      expect(result).toMatchObject({ id: "c1", service: { id: SERVICE, name: "Sunday Worship 9 AM" } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "attendance.self_check_in", entityId: "c1" }));
    });

    it("rejects a forged or member token", async () => {
      await expect(me.selfCheckIn(member, { token: "cmsqr1.abc.def" }, NOW)).rejects.toThrow(BadRequestException);
      const memberToken = qr.sign({ type: "member", id: MEMBER, version: 2 }, new Date("2027-01-01T00:00:00Z"));
      await expect(me.selfCheckIn(member, { token: memberToken }, NOW)).rejects.toThrow(BadRequestException);
    });

    it("opens check-in three hours before the service starts", async () => {
      prisma.service.findFirst.mockResolvedValue({ ...service, startsAt: new Date("2026-11-29T05:00:00Z") });
      await expect(me.selfCheckIn(member, { token: token() }, NOW)).rejects.toThrow(/not open yet/);
    });

    it("says so when the member is already checked in", async () => {
      prisma.service.findFirst.mockResolvedValue(service);
      prisma.checkIn.create.mockRejectedValue(p2002);
      await expect(me.selfCheckIn(member, { token: token() }, NOW)).rejects.toThrow(ConflictException);
    });
  });

  describe("usher scan", () => {
    it("checks in the member on a valid card through the normal check-in rules", async () => {
      prisma.user.findFirst.mockResolvedValue({ tokenVersion: 2 });
      const card = qr.sign({ type: "member", id: MEMBER, version: 2 }, new Date("2027-01-01T00:00:00Z"));
      await me.scan(branchStaff, SERVICE, { token: card }, NOW);
      expect(prisma.user.findFirst.mock.calls[0][0].where).toEqual({ memberId: MEMBER });
      expect(checkIns.checkIn).toHaveBeenCalledWith(branchStaff, { type: "service", id: SERVICE }, { kind: "ATTENDEE", memberId: MEMBER });
    });

    it("refuses a card revoked by signing out everywhere", async () => {
      prisma.user.findFirst.mockResolvedValue({ tokenVersion: 3 });
      const card = qr.sign({ type: "member", id: MEMBER, version: 2 }, new Date("2027-01-01T00:00:00Z"));
      await expect(me.scan(branchStaff, SERVICE, { token: card }, NOW)).rejects.toThrow(/no longer valid/);
      expect(checkIns.checkIn).not.toHaveBeenCalled();
    });
  });

  describe("service QR", () => {
    it("issues a code that lasts until six hours after the start, for services in the user's branch", async () => {
      prisma.service.findFirst.mockResolvedValue(service);
      const poster = await me.serviceQr(branchStaff, SERVICE, NOW);
      expect(prisma.service.findFirst.mock.calls[0][0].where).toEqual({ id: SERVICE, deletedAt: null, branchId: BRANCH_A });
      expect(poster.expiresAt).toEqual(new Date("2026-11-29T07:00:00Z"));
      expect(qr.verify(poster.token, "service", NOW)?.id).toBe(SERVICE);
      expect(poster.svg.startsWith("<svg")).toBe(true);
    });

    it("refuses a service that has finished", async () => {
      prisma.service.findFirst.mockResolvedValue({ ...service, startsAt: new Date("2026-11-20T01:00:00Z") });
      await expect(me.serviceQr(branchStaff, SERVICE, NOW)).rejects.toThrow(BadRequestException);
    });
  });

  describe("ministry join requests", () => {
    beforeEach(() => {
      prisma.ministry.findFirst.mockResolvedValue({ id: MINISTRY, name: "Worship Team", branchId: BRANCH_A });
    });

    it("creates a pending request", async () => {
      prisma.ministryMember.findFirst.mockResolvedValue(null);
      prisma.ministryJoinRequest.create.mockResolvedValue({ id: REQUEST, status: "PENDING" });
      await me.requestJoin(member, { ministryId: MINISTRY, note: "I play guitar" });
      expect(prisma.ministryJoinRequest.create.mock.calls[0][0].data).toEqual({ ministryId: MINISTRY, memberId: MEMBER, note: "I play guitar" });
    });

    it("refuses when the member already serves there or has a pending request", async () => {
      prisma.ministryMember.findFirst.mockResolvedValue({ id: "mm1" });
      await expect(me.requestJoin(member, { ministryId: MINISTRY })).rejects.toThrow(/already serve/);
      prisma.ministryMember.findFirst.mockResolvedValue(null);
      prisma.ministryJoinRequest.create.mockRejectedValue(p2002);
      await expect(me.requestJoin(member, { ministryId: MINISTRY })).rejects.toThrow(/already asked/);
    });

    it("adds the member to the roster when a leader approves", async () => {
      prisma.ministryJoinRequest.findFirst.mockResolvedValue({ id: REQUEST, status: "PENDING", memberId: MEMBER, ministryId: MINISTRY, ministry: { branchId: BRANCH_A } });
      prisma.ministryMember.findFirst.mockResolvedValue(null);
      prisma.ministryJoinRequest.update.mockResolvedValue({ id: REQUEST, status: "APPROVED" });
      await me.decide(branchStaff, REQUEST, { decision: "APPROVED" }, NOW);
      expect(prisma.ministryJoinRequest.update.mock.calls[0][0].data).toEqual({ status: "APPROVED", decidedAt: NOW, decidedById: branchStaff.id });
      expect(prisma.ministryMember.create.mock.calls[0][0].data).toEqual({ ministryId: MINISTRY, memberId: MEMBER, position: "MEMBER" });
    });

    it("refuses requests outside the leader's branch or already decided", async () => {
      prisma.ministryJoinRequest.findFirst.mockResolvedValue({ id: REQUEST, status: "PENDING", ministry: { branchId: BRANCH_B } });
      await expect(me.decide(branchStaff, REQUEST, { decision: "DECLINED" }, NOW)).rejects.toThrow(NotFoundException);
      prisma.ministryJoinRequest.findFirst.mockResolvedValue({ id: REQUEST, status: "APPROVED", ministry: { branchId: BRANCH_A } });
      await expect(me.decide(branchStaff, REQUEST, { decision: "DECLINED" }, NOW)).rejects.toThrow(ConflictException);
    });
  });

  describe("accounts without a member record (staff and admins)", () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ ...linkedUser, memberId: null, member: null });
    });

    it("still lists services, using the account's branch as the home campus", async () => {
      prisma.service.findMany.mockResolvedValue([
        { ...service, branch: { name: "Main", address: null } },
        { ...service, id: "s2", branchId: BRANCH_B, branch: { name: "North", address: null } },
      ]);
      const list = await me.services(branchStaff, NOW);
      expect(list.map((s) => [s.myCampus, s.checkedIn])).toEqual([
        [true, false],
        [false, false],
      ]);
      expect(prisma.checkIn.findMany).not.toHaveBeenCalled();
    });

    it("still lists ministries, with no personal status", async () => {
      prisma.ministry.findMany.mockResolvedValue([{ id: MINISTRY, name: "Worship Team" }]);
      expect(await me.ministries(branchStaff)).toEqual([{ id: MINISTRY, name: "Worship Team", status: null }]);
      expect(prisma.ministryMember.findMany).not.toHaveBeenCalled();
    });

  });

  describe("events", () => {
    const pastor = { ...member, roleKey: "PASTOR" as const, branchId: null };
    const serving = [
      { ministry: { id: MINISTRY, name: "Usher" }, ministryRole: null },
      { ministry: { id: "88888888-8888-4888-8888-888888888888", name: "Worship" }, ministryRole: { name: "Vocalist" } },
    ];

    it("shows admins and pastors every upcoming event at every branch", async () => {
      prisma.event.findMany.mockResolvedValue([]);
      await me.upcomingEvents(pastor, NOW);
      const where = prisma.event.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty("branchId");
      expect(where).not.toHaveProperty("ministryId");
    });

    it("shows staff the events of their ministries at any branch", async () => {
      prisma.ministryMember.findMany.mockResolvedValue(serving);
      prisma.event.findMany.mockResolvedValue([]);
      await me.upcomingEvents(member, NOW);
      const where = prisma.event.findMany.mock.calls[0][0].where;
      expect(where.ministryId).toEqual({ in: [MINISTRY, "88888888-8888-4888-8888-888888888888"] });
      expect(where).not.toHaveProperty("branchId");
    });

    it("shows staff who serve in no ministry no events", async () => {
      prisma.ministryMember.findMany.mockResolvedValue([]);
      await expect(me.upcomingEvents(member, NOW)).resolves.toEqual([]);
      expect(prisma.event.findMany).not.toHaveBeenCalled();
    });

    it("lists the account's ministries with their position, empty when none is set", async () => {
      prisma.ministryMember.findMany.mockResolvedValue(serving);
      await expect(me.ministriesServed(member)).resolves.toEqual([
        { id: MINISTRY, name: "Usher", position: null },
        { id: "88888888-8888-4888-8888-888888888888", name: "Worship", position: "Vocalist" },
      ]);
      expect(prisma.ministryMember.findMany.mock.calls[0][0].where).toMatchObject({ leftAt: null, member: { user: { id: member.id } } });
    });

    it("registers the member through the normal registration rules", async () => {
      await me.registerForEvent(member, { eventId: EVENT });
      expect(events.register).toHaveBeenCalledWith(member, EVENT, { memberId: MEMBER });
    });
  });

  describe("profile edit", () => {
    it("updates only the linked member's record and records an audit entry", async () => {
      prisma.member.update.mockResolvedValue({ id: MEMBER });
      prisma.member.findUnique.mockResolvedValue({ id: MEMBER, phone: "0917" });
      const result = await me.updateProfile(member, { phone: "0917", address: null });
      expect(prisma.member.update).toHaveBeenCalledWith({ where: { id: MEMBER }, data: { phone: "0917", address: null } });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "member.self_update",
          entity: "Member",
          entityId: MEMBER,
          branchId: BRANCH_A,
          changes: { phone: "0917", address: null },
        }),
      );
      expect(result).toEqual({ id: MEMBER, phone: "0917" });
    });

    it("refuses an account with no member record", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...linkedUser, memberId: null, member: null });
      await expect(me.updateProfile(member, { phone: "0917" })).rejects.toThrow(NotFoundException);
      expect(prisma.member.update).not.toHaveBeenCalled();
    });
  });

  describe("profile photo", () => {
    const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]).toString("base64");
    const at = new Date("2026-11-26T03:00:00Z");

    it("stores the photo on the account, so staff without a member record get one too", async () => {
      prisma.userPhoto.upsert.mockResolvedValue({ updatedAt: at });
      const result = await me.setPhoto(member, { mimeType: "image/png", data: PNG });
      const call = prisma.userPhoto.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId: member.id });
      expect(call.create.mimeType).toBe("image/png");
      expect(Buffer.from(call.create.data).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "user.photo_update", entity: "User", entityId: member.id }));
      expect(result).toEqual({ photoUpdatedAt: at });
    });

    it("refuses data whose file signature does not match the stated type", async () => {
      await expect(me.setPhoto(member, { mimeType: "image/png", data: JPEG })).rejects.toThrow(BadRequestException);
      await expect(me.setPhoto(member, { mimeType: "image/jpeg", data: Buffer.from("<svg>").toString("base64") })).rejects.toThrow(BadRequestException);
      expect(prisma.userPhoto.upsert).not.toHaveBeenCalled();
    });

    it("serves the photo, or 404 when there is none", async () => {
      prisma.userPhoto.findUnique.mockResolvedValueOnce({ mimeType: "image/jpeg", data: Buffer.from(JPEG, "base64"), updatedAt: at });
      await expect(me.photo(member)).resolves.toMatchObject({ mimeType: "image/jpeg" });
      prisma.userPhoto.findUnique.mockResolvedValueOnce(null);
      await expect(me.photo(member)).rejects.toThrow(NotFoundException);
    });

    it("removes the photo", async () => {
      prisma.userPhoto.deleteMany.mockResolvedValue({ count: 1 });
      await me.removePhoto(member);
      expect(prisma.userPhoto.deleteMany).toHaveBeenCalledWith({ where: { userId: member.id } });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "user.photo_remove" }));
    });

    it("describes the account with its branch, ministries, and photo version", async () => {
      prisma.ministryMember.findMany.mockResolvedValue([{ ministry: { id: MINISTRY, name: "Usher" }, ministryRole: null }]);
      prisma.user.findUnique.mockResolvedValue({
        id: member.id,
        email: "m@cms.local",
        firstName: "Ngozi",
        lastName: "Okafor",
        role: { key: "MEMBER", name: "Member" },
        branch: { id: BRANCH_A, name: "Main Campus" },
        photo: { updatedAt: at },
      });
      await expect(me.account(member)).resolves.toEqual({
        id: member.id,
        email: "m@cms.local",
        firstName: "Ngozi",
        lastName: "Okafor",
        role: { key: "MEMBER", name: "Member" },
        branch: { id: BRANCH_A, name: "Main Campus" },
        photoUpdatedAt: at,
        ministries: [{ id: MINISTRY, name: "Usher", position: null }],
      });
    });
  });

  describe("detail screens", () => {
    const pastor = { ...member, roleKey: "PASTOR" as const, branchId: null };
    const event = {
      id: EVENT,
      title: "Christmas Concert",
      description: "Carols",
      ministryId: MINISTRY,
      branchId: BRANCH_A,
      registrations: [{ id: "r1" }],
      checkIns: [],
      _count: { registrations: 12 },
    };

    it("shows staff an event of their ministry, with their registration", async () => {
      prisma.ministryMember.findMany.mockResolvedValue([{ ministry: { id: MINISTRY, name: "Worship" }, ministryRole: null }]);
      prisma.event.findFirst.mockResolvedValue(event);
      const detail = await me.eventDetail(member, EVENT);
      expect(prisma.event.findFirst.mock.calls[0][0].where).toEqual({ id: EVENT, ministryId: { in: [MINISTRY] } });
      expect(detail).toMatchObject({ title: "Christmas Concert", registered: 12, myRegistrationId: "r1", checkedIn: false });
      expect(detail).not.toHaveProperty("_count");
    });

    it("lets admins and pastors open any event, and 404s staff outside its ministry", async () => {
      prisma.event.findFirst.mockResolvedValueOnce(event);
      await me.eventDetail(pastor, EVENT);
      expect(prisma.event.findFirst.mock.calls[0][0].where).toEqual({ id: EVENT });
      prisma.ministryMember.findMany.mockResolvedValue([]);
      await expect(me.eventDetail(member, EVENT)).rejects.toThrow(NotFoundException);
      prisma.ministryMember.findMany.mockResolvedValue([{ ministry: { id: MINISTRY, name: "Worship" }, ministryRole: null }]);
      prisma.event.findFirst.mockResolvedValueOnce(null);
      await expect(me.eventDetail(member, EVENT)).rejects.toThrow(NotFoundException);
    });

    it("shows a service with the check-in window and whether the person is checked in", async () => {
      prisma.service.findFirst.mockResolvedValue({
        ...service,
        notes: "Communion Sunday",
        branch: { name: "Main Campus", address: "100 Grace Avenue", phone: null },
        _count: { checkIns: 40 },
      });
      prisma.checkIn.findFirst.mockResolvedValue({ checkedInAt: NOW });
      const detail = await me.serviceDetail(member, SERVICE, NOW);
      expect(detail).toMatchObject({
        name: "Sunday Worship 9 AM",
        notes: "Communion Sunday",
        myCampus: true,
        checkedIn: true,
        checkedInAt: NOW,
        checkInOpensAt: new Date("2026-11-28T22:00:00Z"),
        checkInClosesAt: new Date("2026-11-29T07:00:00Z"),
        checkInOpen: true,
      });
      // Members do not see the headcount; staff with attendance.read do.
      expect(detail).not.toHaveProperty("checkIns");
      const staff = await me.serviceDetail({ ...member, permissions: ["attendance.read"] }, SERVICE, NOW);
      expect(staff).toMatchObject({ checkIns: 40 });
    });

    it("404s a deleted or unknown service", async () => {
      prisma.service.findFirst.mockResolvedValue(null);
      await expect(me.serviceDetail(member, SERVICE, NOW)).rejects.toThrow(NotFoundException);
    });
  });
});
