"use client";

import { checkOutSchema, type CheckOutInput } from "@cms/shared";
import { useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/conflict-alert";
import { InfoIcon, LockIcon, ShieldCheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCheckOut, useGuardians, type CheckInRow } from "./api";
import { checkInName } from "./format";

const ROLE_LABEL: Record<string, string> = { HEAD: "Household head", SPOUSE: "Spouse" };
const NAMED = "named-guardian";

export interface CheckOutFormProps {
  checkIn: CheckInRow;
  /** Admins and pastors may release a child without the code, with a reason. */
  canOverride: boolean;
  onDone: () => void;
}

/** Releases a child: staff match the pickup code and confirm who is collecting against the allowed guardians. */
export function CheckOutForm({ checkIn, canOverride, onDone }: CheckOutFormProps) {
  const guardians = useGuardians(checkIn.id);
  const checkOut = useCheckOut(checkIn.id);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [override, setOverride] = useState(false);
  const [collectedBy, setCollectedBy] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const named = guardians.data?.guardianName;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const who =
      override && collectedBy.trim()
        ? { pickedUpByName: collectedBy.trim() }
        : pickedId === NAMED && named
          ? { pickedUpByName: named }
          : pickedId
            ? { pickedUpByMemberId: pickedId }
            : {};
    const input = override ? { method: "OVERRIDE", reason, ...who } : { method: "CODE", code, ...who };
    const parsed = checkOutSchema.safeParse(input);
    if (!parsed.success) {
      return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0] ?? "form"), i.message])));
    }
    setErrors({});
    checkOut.mutate(parsed.data as CheckOutInput, { onSuccess: onDone });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="bg-muted/60 rounded-lg p-3 text-sm">
        <p className="font-medium">{checkInName(checkIn)}</p>
        {checkIn.careNote && (
          <p className="mt-1 flex items-start gap-1.5 font-medium">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            {checkIn.careNote}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Who is collecting?</legend>
        {guardians.isPending && <Skeleton className="h-9 w-full" />}
        {guardians.data?.members.map((g) => (
          <GuardianOption key={g.id} id={g.id} checked={pickedId === g.id} onPick={setPickedId}>
            <span className="font-medium">
              {g.firstName} {g.lastName}
            </span>
            <span className="text-muted-foreground text-xs">
              {checkIn.guardianMember?.id === g.id ? "Brought the child" : (ROLE_LABEL[g.householdRole ?? ""] ?? "Guardian")}
            </span>
          </GuardianOption>
        ))}
        {named && (
          <GuardianOption id={NAMED} checked={pickedId === NAMED} onPick={setPickedId}>
            <span className="font-medium">{named}</span>
            <span className="text-muted-foreground text-xs">Named at check-in{guardians.data?.guardianPhone ? ` · ${guardians.data.guardianPhone}` : ""}</span>
          </GuardianOption>
        )}
        {guardians.data && guardians.data.members.length === 0 && !named && (
          <p className="text-muted-foreground text-xs">No guardian on record. Use an override.</p>
        )}
        {errors.pickedUpByMemberId && <p className="text-destructive text-xs">{errors.pickedUpByMemberId}</p>}
      </fieldset>

      {!override && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pickup-code">Pickup code</Label>
          <Input
            id="pickup-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="K7R-QX"
            autoComplete="off"
            disabled={checkIn.locked}
            className="font-mono text-lg tracking-[0.3em] uppercase"
          />
          {checkIn.locked && (
            <p className="text-destructive flex items-center gap-1.5 text-xs">
              <LockIcon className="size-3.5" />
              This check-in is locked after too many wrong codes. An admin or pastor must release the child.
            </p>
          )}
          {errors.code && <p className="text-destructive text-xs">{errors.code}</p>}
        </div>
      )}

      {canOverride && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="accent-primary size-4" />
          Release without code (override)
        </label>
      )}

      {override && (
        <div className="border-foreground/50 flex flex-col gap-3 rounded-lg border border-dashed p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="collected-by">Collected by (if not listed above)</Label>
            <Input id="collected-by" value={collectedBy} onChange={(e) => setCollectedBy(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="override-reason">Reason</Label>
            <Textarea id="override-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tag lost; photo ID checked" />
            {errors.reason && <p className="text-destructive text-xs">{errors.reason}</p>}
          </div>
          <p className="text-muted-foreground text-xs">Overrides are recorded in the audit log with your name.</p>
        </div>
      )}

      <ErrorAlert error={checkOut.error} />
      <Button type="submit" disabled={checkOut.isPending || (!override && checkIn.locked)}>
        <ShieldCheckIcon />
        {checkOut.isPending ? "Releasing..." : "Release child"}
      </Button>
    </form>
  );
}

function GuardianOption({
  id,
  checked,
  onPick,
  children,
}: {
  id: string;
  checked: boolean;
  onPick: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
        checked ? "border-primary bg-muted" : "border-border",
      )}
    >
      <input type="radio" name="guardian" checked={checked} onChange={() => onPick(id)} className="accent-primary size-4" />
      <span className="flex flex-col">{children}</span>
    </label>
  );
}
