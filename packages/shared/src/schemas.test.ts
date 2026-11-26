import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_KEYS,
  branchCreateSchema,
  loginSchema,
  paginationSchema,
  settingUpsertSchema,
  userCreateSchema,
  userUpdateSchema,
} from "./index";

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    const result = loginSchema.safeParse({ email: "Admin@Church.org", password: "secret-pass" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe("admin@church.org");
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "secret-pass" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.org", password: "" }).success).toBe(false);
  });
});

describe("userCreateSchema", () => {
  const valid = {
    email: "leader@church.org",
    password: "Str0ng-password",
    firstName: "Ana",
    lastName: "Cruz",
    roleKey: "STAFF",
    branchId: "c8a1f9b0-3c55-4c2e-9a77-0e6f3b8f0a11",
  };

  it("accepts a valid user", () => {
    expect(userCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a password shorter than 10 characters", () => {
    expect(userCreateSchema.safeParse({ ...valid, password: "short1" }).success).toBe(false);
  });

  it("rejects an unknown role", () => {
    expect(userCreateSchema.safeParse({ ...valid, roleKey: "WIZARD" }).success).toBe(false);
  });

  it("allows a null branch for church-wide users", () => {
    expect(userCreateSchema.safeParse({ ...valid, branchId: null }).success).toBe(true);
  });

  it("trims names", () => {
    const result = userCreateSchema.parse({ ...valid, firstName: "  Ana  " });
    expect(result.firstName).toBe("Ana");
  });
});

describe("userUpdateSchema", () => {
  it("accepts a partial update", () => {
    expect(userUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("rejects an empty update", () => {
    expect(userUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("does not allow changing the password through update", () => {
    const result = userUpdateSchema.safeParse({ password: "Str0ng-password" });
    expect(result.success).toBe(false);
  });
});

describe("branchCreateSchema", () => {
  it("accepts a valid branch", () => {
    const result = branchCreateSchema.safeParse({ name: "Main Campus", code: "main" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.code).toBe("MAIN");
  });

  it("rejects a code with spaces", () => {
    expect(branchCreateSchema.safeParse({ name: "North", code: "no rth" }).success).toBe(false);
  });
});

describe("settingUpsertSchema", () => {
  it("accepts a namespaced key with a JSON value", () => {
    expect(
      settingUpsertSchema.safeParse({ key: "church.name", value: "Grace Church" }).success,
    ).toBe(true);
  });

  it("rejects keys with invalid characters", () => {
    expect(settingUpsertSchema.safeParse({ key: "Bad Key!", value: 1 }).success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("applies defaults", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces strings from query params", () => {
    expect(paginationSchema.parse({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
  });

  it("caps page size at 100", () => {
    expect(paginationSchema.safeParse({ pageSize: 500 }).success).toBe(false);
  });
});

describe("role permissions", () => {
  it("has exactly three roles: admin, pastor, staff", () => {
    expect([...ROLE_KEYS]).toEqual(["ADMIN", "PASTOR", "STAFF"]);
  });

  it("grants every permission to ADMIN", () => {
    expect([...ROLE_DEFAULT_PERMISSIONS.ADMIN].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("lets pastors manage everything except users, roles, settings, branches, and the audit log", () => {
    const pastor = ROLE_DEFAULT_PERMISSIONS.PASTOR as readonly string[];
    for (const p of ["users.read", "users.manage", "roles.manage", "settings.read", "settings.manage", "branches.manage", "audit.read"]) {
      expect(pastor).not.toContain(p);
    }
    expect([...pastor].sort()).toEqual(
      PERMISSIONS.filter((p) => !["users.read", "users.manage", "roles.manage", "settings.read", "settings.manage", "branches.manage", "audit.read"].includes(p)).sort(),
    );
  });

  it("lets staff read and record check-ins without managing people, users, or settings", () => {
    const staff = ROLE_DEFAULT_PERMISSIONS.STAFF as readonly string[];
    expect(staff).toEqual(expect.arrayContaining(["attendance.read", "attendance.manage", "events.read", "ministries.read"]));
    for (const p of ["members.manage", "users.read", "users.manage", "attendance.override", "settings.read", "settings.manage", "events.manage"]) {
      expect(staff).not.toContain(p);
    }
  });

  it("limits pickup overrides to admins and pastors", () => {
    const withOverride = Object.entries(ROLE_DEFAULT_PERMISSIONS)
      .filter(([, perms]) => (perms as readonly string[]).includes("attendance.override"))
      .map(([key]) => key)
      .sort();
    expect(withOverride).toEqual(["ADMIN", "PASTOR"]);
  });
});
