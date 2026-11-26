"use client";

import { MINISTRY_POSITIONS, ministryMemberAddSchema, type MinistryPosition } from "@cms/shared";
import { useState, type FormEvent } from "react";
import { MemberPicker, type PickedPerson } from "@/components/member-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useAddRosterMember, type MinistryRole } from "./api";
import { POSITION_LABELS } from "./format";

export interface AddMemberFormProps {
  ministryId: string;
  branchId: string;
  roles: MinistryRole[];
  excludeMemberIds: string[];
  /** Called with true after a successful add, false on cancel. */
  onDone: (saved: boolean) => void;
}

export function AddMemberForm({ ministryId, branchId, roles, excludeMemberIds, onDone }: AddMemberFormProps) {
  const [selected, setSelected] = useState<PickedPerson | null>(null);
  const [position, setPosition] = useState<MinistryPosition>("MEMBER");
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = useAddRosterMember(ministryId);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return setError("Choose a person to add.");
    const parsed = ministryMemberAddSchema.safeParse({
      memberId: selected.id,
      position,
      ...(roleId ? { ministryRoleId: roleId } : {}),
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Invalid input");
    setError(null);
    add.mutate(parsed.data, { onSuccess: () => onDone(true), onError: (e) => setError(e.message) });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <MemberPicker branchId={branchId} excludeIds={excludeMemberIds} selected={selected} onSelect={setSelected} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="position">Position</Label>
          <NativeSelect id="position" value={position} onChange={(e) => setPosition(e.target.value as MinistryPosition)}>
            {MINISTRY_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {POSITION_LABELS[p]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ministryRoleId">Volunteer role</Label>
          <NativeSelect id="ministryRoleId" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">No specific role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {error && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={add.isPending}>
          {add.isPending ? "Adding..." : "Add to roster"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
