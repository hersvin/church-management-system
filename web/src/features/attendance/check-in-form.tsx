"use client";

import { checkInCreateSchema } from "@cms/shared";
import { useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/conflict-alert";
import { LogInIcon } from "@/components/icons";
import { MemberPicker, type PickedPerson } from "@/components/member-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCheckIn, type CheckInRow, type CheckInTarget } from "./api";

type Mode = "member" | "guest" | "kid";

const MODES: { value: Mode; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "guest", label: "Guest" },
  { value: "kid", label: "Kid" },
];

export interface CheckInFormProps {
  target: CheckInTarget;
  branchId: string;
  /** Members already checked in, hidden from the pickers. */
  excludeIds: string[];
  onCheckedIn: (result: CheckInRow & { pickupCode?: string }) => void;
}

export function CheckInForm({ target, branchId, excludeIds, onCheckedIn }: CheckInFormProps) {
  const [mode, setMode] = useState<Mode>("member");
  const [person, setPerson] = useState<PickedPerson | null>(null);
  const [guest, setGuest] = useState({ name: "", phone: "" });
  const [guardianKind, setGuardianKind] = useState<"member" | "other">("member");
  const [guardian, setGuardian] = useState<PickedPerson | null>(null);
  const [other, setOther] = useState({ name: "", phone: "" });
  const [careNote, setCareNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Bumped after each save so the pickers remount with an empty search.
  const [round, setRound] = useState(0);
  const checkIn = useCheckIn(target);

  function reset() {
    setPerson(null);
    setGuest({ name: "", phone: "" });
    setGuardian(null);
    setOther({ name: "", phone: "" });
    setCareNote("");
    setErrors({});
  }

  function switchMode(next: Mode) {
    setMode(next);
    reset();
    checkIn.reset();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input =
      mode === "member"
        ? { kind: "ATTENDEE", memberId: person?.id }
        : mode === "guest"
          ? { kind: "ATTENDEE", guestName: guest.name, guestPhone: guest.phone }
          : {
              kind: "CHILD",
              memberId: person?.id,
              careNote,
              ...(guardianKind === "member" ? { guardianMemberId: guardian?.id } : { guardianName: other.name, guardianPhone: other.phone }),
            };
    const parsed = checkInCreateSchema.safeParse(input);
    if (!parsed.success) {
      return setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0] ?? "form"), i.path[0] === "memberId" && mode !== "guest" ? "Choose a person first" : i.message]),
        ),
      );
    }
    setErrors({});
    checkIn.mutate(parsed.data, {
      onSuccess: (result) => {
        reset();
        setRound((r) => r + 1);
        onCheckedIn(result);
      },
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div role="tablist" aria-label="Who is checking in" className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            onClick={() => switchMode(m.value)}
            className={cn(
              "rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              mode === m.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "guest" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guest-name">Guest name</Label>
            <Input id="guest-name" value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} />
            {errors.memberId && <p className="text-destructive text-xs">Enter the guest name</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guest-phone">Phone (optional)</Label>
            <Input id="guest-phone" value={guest.phone} onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <MemberPicker
            key={`person-${round}`}
            branchId={branchId}
            excludeIds={excludeIds}
            selected={person}
            onSelect={setPerson}
            label={mode === "kid" ? "Find the child" : "Find a person"}
            inputId="check-in-person"
          />
          {errors.memberId && <p className="text-destructive text-xs">{errors.memberId}</p>}
        </div>
      )}

      {mode === "kid" && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Guardian collecting the child</legend>
            <div className="flex gap-4 text-sm">
              {(
                [
                  ["member", "A member"],
                  ["other", "Someone else"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="guardian-kind"
                    checked={guardianKind === value}
                    onChange={() => setGuardianKind(value)}
                    className="accent-primary size-4"
                  />
                  {label}
                </label>
              ))}
            </div>
            {guardianKind === "member" ? (
              <MemberPicker
                key={`guardian-${round}`}
                branchId={branchId}
                excludeIds={person ? [person.id] : []}
                selected={guardian}
                onSelect={setGuardian}
                label="Find the guardian"
                inputId="check-in-guardian"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="guardian-name">Guardian name</Label>
                  <Input id="guardian-name" value={other.name} onChange={(e) => setOther((o) => ({ ...o, name: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="guardian-phone">Guardian phone</Label>
                  <Input id="guardian-phone" value={other.phone} onChange={(e) => setOther((o) => ({ ...o, phone: e.target.value }))} />
                  {errors.guardianPhone && <p className="text-destructive text-xs">{errors.guardianPhone}</p>}
                </div>
              </div>
            )}
            {errors.guardianMemberId && <p className="text-destructive text-xs">{errors.guardianMemberId}</p>}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="care-note">Care note (allergies, needs)</Label>
            <Input id="care-note" value={careNote} onChange={(e) => setCareNote(e.target.value)} />
          </div>
        </>
      )}

      <ErrorAlert error={checkIn.error} />
      <Button type="submit" disabled={checkIn.isPending}>
        <LogInIcon />
        {checkIn.isPending ? "Checking in..." : "Check in"}
      </Button>
    </form>
  );
}
