import { ForbiddenException } from "@nestjs/common";
import { isChurchWide, type SessionUser } from "../auth/session-user";

/**
 * Branch filter for reads. Church-wide users may narrow to a requested branch;
 * branch users are always pinned to their own branch.
 */
export function branchFilter(actor: SessionUser, requested?: string): { branchId?: string } {
  if (isChurchWide(actor)) return requested ? { branchId: requested } : {};
  return { branchId: actor.branchId! };
}

/** Throws unless the actor may write to the given branch. */
export function assertBranchAccess(actor: SessionUser, branchId: string): void {
  if (!isChurchWide(actor) && actor.branchId !== branchId) {
    throw new ForbiddenException("You can only manage records in your own branch");
  }
}
