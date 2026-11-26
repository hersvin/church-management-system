import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore, type SessionUser } from "@/stores/session-store";

const user: SessionUser = {
  id: "u1",
  email: "admin@cms.local",
  firstName: "Ana",
  lastName: "Cruz",
  roleKey: "ADMIN",
  branchId: null,
  permissions: ["users.read", "branches.read"],
};

describe("session store", () => {
  beforeEach(() => useSessionStore.getState().clear());

  it("starts signed out", () => {
    expect(useSessionStore.getState().user).toBeNull();
    expect(useSessionStore.getState().can("users.read")).toBe(false);
  });

  it("checks permissions for the signed in user", () => {
    useSessionStore.getState().setUser(user);
    expect(useSessionStore.getState().can("users.read")).toBe(true);
    expect(useSessionStore.getState().can("users.manage")).toBe(false);
  });

  it("clears the user", () => {
    useSessionStore.getState().setUser(user);
    useSessionStore.getState().clear();
    expect(useSessionStore.getState().user).toBeNull();
  });
});
