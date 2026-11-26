"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MemberPicker, type PickedPerson } from "@/components/member-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useBranches, useUpdateUser } from "./queries";

export interface LinkableUser {
  id: string;
  firstName: string;
  lastName: string;
  branchId: string | null;
  member: { id: string; firstName: string; lastName: string } | null;
}

/**
 * Links an account to its member record so the person can use the mobile app as themselves
 * (QR card, self check-in, ministries, events). Linking or unlinking signs the account out.
 */
export function LinkMemberForm({ user, onDone }: { user: LinkableUser; onDone: () => void }) {
  const update = useUpdateUser();
  const branches = useBranches(user.branchId === null);
  const [branchId, setBranchId] = useState(user.branchId ?? "");
  const [picked, setPicked] = useState<PickedPerson | null>(null);

  const save = (memberId: string | null) =>
    update.mutate(
      { id: user.id, input: { memberId } },
      {
        onSuccess: () => {
          toast.success(memberId ? "Member linked. The person signs in again on the app." : "Link removed");
          onDone();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  return (
    <div className="flex flex-col gap-4">
      {user.member ? (
        <div className="border-border flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <span>
            Linked to {user.member.firstName} {user.member.lastName}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={update.isPending} onClick={() => save(null)}>
            Remove link
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Not linked yet. Find the person in the directory.</p>
      )}

      {user.branchId === null && (
        <div className="grid gap-1.5">
          <Label htmlFor="link-branch">Member&apos;s branch</Label>
          <NativeSelect id="link-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Choose a branch</option>
            {(branches.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      {branchId && (
        <MemberPicker
          branchId={branchId}
          excludeIds={user.member ? [user.member.id] : []}
          selected={picked}
          onSelect={setPicked}
          label="Find the member"
          inputId="link-member-search"
        />
      )}

      <div className="flex gap-2">
        <Button type="button" disabled={!picked || update.isPending} onClick={() => picked && save(picked.id)}>
          Link member
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
