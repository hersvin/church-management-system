"use client";

import { CLASS_AUDIENCES, classCreateSchema, classUpdateSchema } from "@cms/shared";
import { useState, type FormEvent, type ReactNode } from "react";
import { ErrorAlert } from "@/components/conflict-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRooms } from "@/features/rooms/api";
import { useCreateClass, useUpdateClass, type SchoolClass } from "./api";
import { AUDIENCE_META, WEEKDAYS } from "./format";

type Values = {
  name: string;
  audience: string;
  ageRange: string;
  meetingDay: string;
  startTime: string;
  endTime: string;
  roomId: string;
  capacity: string;
  description: string;
};

const initialValues = (c?: SchoolClass): Values => ({
  name: c?.name ?? "",
  audience: c?.audience ?? "CHILDREN",
  ageRange: c?.ageRange ?? "",
  meetingDay: c?.meetingDay === null || c?.meetingDay === undefined ? "" : String(c.meetingDay),
  startTime: c?.startTime ?? "",
  endTime: c?.endTime ?? "",
  roomId: c?.roomId ?? "",
  capacity: c?.capacity ? String(c.capacity) : "",
  description: c?.description ?? "",
});

/** Converts form strings to API values; blank means "not set" (null on edit). */
function toApi(key: keyof Values, value: string): unknown {
  if (value === "") return null;
  return key === "meetingDay" || key === "capacity" ? Number(value) : value;
}

export interface ClassFormProps {
  termId: string;
  branchId: string;
  klass?: SchoolClass;
  onSaved: (klass: SchoolClass) => void;
  onCancel: () => void;
}

export function ClassForm({ termId, branchId, klass, onSaved, onCancel }: ClassFormProps) {
  const [values, setValues] = useState(() => initialValues(klass));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateClass();
  const update = useUpdateClass(klass?.id ?? "");
  const mutation = klass ? update : create;
  const rooms = useRooms({ branchId, pageSize: 100 });

  const bind = (key: keyof Values) => ({
    id: key,
    value: values[key],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });

  const toErrors = (issues: { path: PropertyKey[]; code: string; message: string }[]) =>
    Object.fromEntries(issues.map((i) => [String(i.path[0]), i.code === "too_small" ? "Required" : i.message]));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!klass) {
      const payload: Record<string, unknown> = { termId };
      for (const key of Object.keys(values) as (keyof Values)[]) {
        const value = toApi(key, values[key]);
        if (value !== null) payload[key] = value;
      }
      const parsed = classCreateSchema.safeParse(payload);
      if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
      setErrors({});
      return create.mutate(payload, { onSuccess: onSaved });
    }

    const original = initialValues(klass);
    const changed: Record<string, unknown> = {};
    for (const key of Object.keys(values) as (keyof Values)[]) {
      if (values[key] !== original[key]) changed[key] = toApi(key, values[key]);
    }
    if (Object.keys(changed).length === 0) return onCancel();
    const parsed = classUpdateSchema.safeParse(changed);
    if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
    setErrors({});
    update.mutate(changed, { onSuccess: onSaved });
  }

  const field = (key: keyof Values, label: string, control: ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={key}>{label}</Label>
      {control}
      {errors[key] && <p className="text-destructive text-xs">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {field("name", "Name", <Input {...bind("name")} placeholder="Grade 3 Bible" />)}
      <div className="grid gap-4 sm:grid-cols-2">
        {field(
          "audience",
          "Audience",
          <NativeSelect {...bind("audience")}>
            {CLASS_AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {AUDIENCE_META[a].label}
              </option>
            ))}
          </NativeSelect>,
        )}
        {field("ageRange", "Age range", <Input {...bind("ageRange")} placeholder="6 to 11" />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field(
          "meetingDay",
          "Meets on",
          <NativeSelect {...bind("meetingDay")}>
            <option value="">No set day</option>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={String(i)}>
                {d}
              </option>
            ))}
          </NativeSelect>,
        )}
        {field("startTime", "Starts", <Input {...bind("startTime")} type="time" />)}
        {field("endTime", "Ends", <Input {...bind("endTime")} type="time" />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field(
          "roomId",
          "Room",
          <NativeSelect {...bind("roomId")}>
            <option value="">No room</option>
            {rooms.data?.items
              .filter((r) => r.isActive)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </NativeSelect>,
        )}
        {field("capacity", "Capacity", <Input {...bind("capacity")} type="number" min={1} />)}
      </div>
      {field("description", "Description", <Textarea {...bind("description")} rows={3} />)}
      <ErrorAlert error={mutation.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save class"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
