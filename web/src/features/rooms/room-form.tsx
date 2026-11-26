"use client";

import { roomCreateSchema, roomUpdateSchema } from "@cms/shared";
import { useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/conflict-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRoom, useUpdateRoom, type Room } from "./api";

type Values = { name: string; branchId: string; capacity: string; hourlyRate: string; location: string; description: string; features: string };

const splitFeatures = (value: string) =>
  value
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

function initialValues(room: Room | undefined, branchId: string): Values {
  return {
    name: room?.name ?? "",
    branchId: room?.branchId ?? branchId,
    capacity: room?.capacity ? String(room.capacity) : "",
    hourlyRate: room?.hourlyRate != null ? String(room.hourlyRate) : "",
    location: room?.location ?? "",
    description: room?.description ?? "",
    features: room?.features.join(", ") ?? "",
  };
}

export interface RoomFormProps {
  branches: { id: string; name: string; code: string }[];
  defaultBranchId?: string;
  room?: Room;
  onSaved: (room: Room) => void;
  onCancel: () => void;
}

export function RoomForm({ branches, defaultBranchId, room, onSaved, onCancel }: RoomFormProps) {
  const [values, setValues] = useState(() => initialValues(room, defaultBranchId ?? branches[0]?.id ?? ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateRoom();
  const update = useUpdateRoom(room?.id ?? "");
  const mutation = room ? update : create;

  const bind = (key: keyof Values) => ({
    id: key,
    value: values[key],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });

  const toErrors = (issues: { path: PropertyKey[]; code: string; message: string }[]) =>
    Object.fromEntries(issues.map((i) => [String(i.path[0]), i.code === "too_small" ? "Required" : i.message]));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room) {
      const payload = {
        name: values.name,
        branchId: values.branchId,
        ...(values.capacity ? { capacity: Number(values.capacity) } : {}),
        ...(values.hourlyRate.trim() ? { hourlyRate: Number(values.hourlyRate) } : {}),
        ...(values.location.trim() ? { location: values.location } : {}),
        ...(values.description.trim() ? { description: values.description } : {}),
        features: splitFeatures(values.features),
      };
      const parsed = roomCreateSchema.safeParse(payload);
      if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
      setErrors({});
      return create.mutate(parsed.data, { onSuccess: onSaved });
    }

    const original = initialValues(room, room.branchId);
    const changed: Record<string, unknown> = {};
    if (values.name !== original.name) changed.name = values.name;
    if (values.capacity !== original.capacity) changed.capacity = values.capacity ? Number(values.capacity) : null;
    if (values.hourlyRate !== original.hourlyRate) changed.hourlyRate = values.hourlyRate.trim() ? Number(values.hourlyRate) : null;
    if (values.location !== original.location) changed.location = values.location || null;
    if (values.description !== original.description) changed.description = values.description || null;
    if (values.features !== original.features) changed.features = splitFeatures(values.features);
    if (Object.keys(changed).length === 0) return onCancel();
    const parsed = roomUpdateSchema.safeParse(changed);
    if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
    setErrors({});
    update.mutate(parsed.data, { onSuccess: onSaved });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input {...bind("name")} placeholder="Fellowship Hall" />
        {errors.name && <p className="text-destructive text-xs">{errors.name}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capacity">Capacity</Label>
          <Input {...bind("capacity")} type="number" min={1} />
          {errors.capacity && <p className="text-destructive text-xs">{errors.capacity}</p>}
        </div>
        {!room && branches.length > 1 ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branchId">Branch</Label>
            <NativeSelect {...bind("branchId")}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input {...bind("location")} placeholder="Annex, 2nd floor" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlyRate">Rate per hour (PHP)</Label>
        <Input {...bind("hourlyRate")} type="number" min={0} step="0.01" inputMode="decimal" placeholder="Leave blank if not for hire" />
        {errors.hourlyRate && <p className="text-destructive text-xs">{errors.hourlyRate}</p>}
      </div>
      {!room && branches.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input {...bind("location")} placeholder="Annex, 2nd floor" />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="features">Features</Label>
        <Input {...bind("features")} placeholder="Projector, Piano, Kitchen" />
        <p className="text-muted-foreground text-xs">Separate with commas.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea {...bind("description")} rows={3} />
      </div>
      <ErrorAlert error={mutation.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save room"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
