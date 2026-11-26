import type { SessionUser } from "../auth/session-user";

export const BRANCH_A = "11111111-1111-4111-8111-111111111111";
export const BRANCH_B = "22222222-2222-4222-8222-222222222222";

export const superAdmin: SessionUser = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "admin@cms.local",
  firstName: "Super",
  lastName: "Admin",
  roleKey: "ADMIN",
  branchId: null,
  permissions: [],
};

export const branchStaff: SessionUser = {
  ...superAdmin,
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  roleKey: "STAFF",
  branchId: BRANCH_A,
};

/** Church-wide user who can request but not approve room bookings. */
export const requester: SessionUser = {
  ...superAdmin,
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  roleKey: "STAFF",
  branchId: BRANCH_A,
  permissions: ["rooms.read", "rooms.book", "events.read", "events.manage"],
};

export const roomManager: SessionUser = {
  ...superAdmin,
  permissions: ["rooms.read", "rooms.book", "rooms.manage", "events.read", "events.manage"],
};
