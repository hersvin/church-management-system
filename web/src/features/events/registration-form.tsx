"use client";

import { registrationCreateSchema } from "@cms/shared";
import { useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/conflict-alert";
import { MemberPicker, type PickedPerson } from "@/components/member-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useRegister } from "./api";

export interface RegistrationFormProps {
  eventId: string;
  branchId: string;
  excludeMemberIds: string[];
  onDone: (saved: boolean) => void;
}

export function RegistrationForm({ eventId, branchId, excludeMemberIds, onDone }: RegistrationFormProps) {
  const [mode, setMode] = useState<"member" | "guest">("member");
  const [selected, setSelected] = useState<PickedPerson | null>(null);
  const [guest, setGuest] = useState({ guestName: "", guestEmail: "", guestPhone: "" });
  const [error, setError] = useState<string | null>(null);
  const register = useRegister(eventId);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload =
      mode === "member"
        ? selected
          ? { memberId: selected.id }
          : null
        : Object.fromEntries(Object.entries(guest).filter(([, v]) => v.trim() !== ""));
    if (!payload || Object.keys(payload).length === 0) {
      return setError(mode === "member" ? "Choose a person to register." : "Enter the guest's name.");
    }
    const parsed = registrationCreateSchema.safeParse(payload);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the details");
    setError(null);
    register.mutate(payload, { onSuccess: () => onDone(true) });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div role="tablist" aria-label="Who is registering" className="bg-muted flex gap-1 rounded-lg p-1">
        {(["member", "guest"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              "flex-1 rounded-md px-3 py-1 text-sm font-medium transition-colors",
              mode === m ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "member" ? "Member" : "Guest"}
          </button>
        ))}
      </div>

      {mode === "member" ? (
        <MemberPicker branchId={branchId} excludeIds={excludeMemberIds} selected={selected} onSelect={setSelected} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="guestName">Guest name</Label>
            <Input id="guestName" value={guest.guestName} onChange={(e) => setGuest({ ...guest, guestName: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guestEmail">Email</Label>
              <Input id="guestEmail" type="email" value={guest.guestEmail} onChange={(e) => setGuest({ ...guest, guestEmail: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guestPhone">Phone</Label>
              <Input id="guestPhone" type="tel" value={guest.guestPhone} onChange={(e) => setGuest({ ...guest, guestPhone: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      <ErrorAlert error={error ?? register.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={register.isPending}>
          Register
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
