"use client";

import { bookingCreateSchema } from "@cms/shared";
import { useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/conflict-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { fromLocalInput } from "@/lib/datetime";
import { useCreateBooking, type Booking } from "./api";

export interface BookingFormProps {
  rooms: { id: string; name: string }[];
  defaultRoomId?: string;
  /** Prefilled datetime-local values, for example from a clicked calendar slot. */
  defaultStart?: string;
  defaultEnd?: string;
  onDone: (booking: Booking | null) => void;
}

export function BookingForm({ rooms, defaultRoomId, defaultStart = "", defaultEnd = "", onDone }: BookingFormProps) {
  const [roomId, setRoomId] = useState(defaultRoomId ?? rooms[0]?.id ?? "");
  const [purpose, setPurpose] = useState("");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateBooking();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { roomId, purpose, startsAt: fromLocalInput(start), endsAt: fromLocalInput(end) };
    const parsed = bookingCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), i.code === "too_small" || i.code === "invalid_type" ? "Required" : i.message]),
        ),
      );
      return;
    }
    setErrors({});
    create.mutate(
      { roomId, purpose: parsed.data.purpose, startsAt: payload.startsAt!, endsAt: payload.endsAt! },
      { onSuccess: (booking) => onDone(booking) },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {rooms.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-room">Room</Label>
          <NativeSelect id="booking-room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="purpose">Purpose</Label>
        <Input id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Choir practice" />
        {errors.purpose && <p className="text-destructive text-xs">{errors.purpose}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="starts">Starts</Label>
          <Input id="starts" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          {errors.startsAt && <p className="text-destructive text-xs">{errors.startsAt}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ends">Ends</Label>
          <Input id="ends" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          {errors.endsAt && <p className="text-destructive text-xs">{errors.endsAt}</p>}
        </div>
      </div>
      <ErrorAlert error={create.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Sending..." : "Request booking"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(null)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
