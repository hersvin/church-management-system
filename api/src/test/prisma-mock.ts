import { vi } from "vitest";

const model = () => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  groupBy: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
  createMany: vi.fn(),
  createManyAndReturn: vi.fn(),
});

export function createPrismaMock() {
  const mock = {
    user: model(),
    role: model(),
    branch: model(),
    setting: model(),
    auditLog: model(),
    member: model(),
    household: model(),
    memberStatusHistory: model(),
    ministry: model(),
    ministryRole: model(),
    ministryMember: model(),
    room: model(),
    roomBooking: model(),
    event: model(),
    eventRegistration: model(),
    schoolTerm: model(),
    schoolClass: model(),
    classTeacher: model(),
    enrollment: model(),
    classSession: model(),
    sessionAttendance: model(),
    service: model(),
    checkIn: model(),
    ministryJoinRequest: model(),
    userPhoto: model(),
    song: model(),
    playlist: model(),
    playlistSong: model(),
    $transaction: vi.fn(),
  };
  // Interactive transactions receive the same mock as their client.
  mock.$transaction.mockImplementation(async (ops: unknown) =>
    Array.isArray(ops) ? Promise.all(ops) : (ops as (tx: unknown) => unknown)(mock),
  );
  return mock;
}

export type PrismaMock = ReturnType<typeof createPrismaMock>;
