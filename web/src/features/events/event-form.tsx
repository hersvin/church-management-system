"use client";

import {
  EVENT_CATEGORIES,
  REPEAT_FREQUENCIES,
  eventCreateSchema,
  eventUpdateSchema,
  expandOccurrences,
  MAX_OCCURRENCES,
  type RepeatFrequency,
} from "@cms/shared";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/conflict-alert";
import { RepeatIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Page } from "@/features/admin/queries";
import type { Ministry } from "@/features/ministries/api";
import { useRooms } from "@/features/rooms/api";
import { apiFetch } from "@/lib/api-client";
import { fromLocalInput, toLocalInput } from "@/lib/datetime";
import { useCreateEvent, useUpdateEvent, type ChurchEvent } from "./api";
import { EVENT_CATEGORY_META, REPEAT_LABELS } from "./format";

type Values = {
  title: string;
  category: string;
  branchId: string;
  start: string;
  end: string;
  roomId: string;
  ministryId: string;
  description: string;
  capacity: string;
  registrationRequired: boolean;
};

function initialValues(event: ChurchEvent | undefined, branchId: string, start: string, end: string): Values {
  return {
    title: event?.title ?? "",
    category: event?.category ?? "OTHER",
    branchId: event?.branchId ?? branchId,
    start: event ? toLocalInput(event.startsAt) : start,
    end: event ? toLocalInput(event.endsAt) : end,
    roomId: event?.roomId ?? "",
    ministryId: event?.ministryId ?? "",
    description: event?.description ?? "",
    capacity: event?.capacity ? String(event.capacity) : "",
    registrationRequired: event?.registrationRequired ?? false,
  };
}

const errorKey = (path: PropertyKey[]) => (path[0] === "repeat" ? "until" : String(path[0] ?? "form"));
const toErrors = (issues: { path: PropertyKey[]; code: string; message: string }[]) =>
  Object.fromEntries(
    issues.map((i) => [errorKey(i.path), i.code === "too_small" || i.code === "invalid_type" ? "Required" : i.message]),
  );

export interface EventFormProps {
  branches: { id: string; name: string; code: string }[];
  defaultBranchId?: string;
  canBookRooms: boolean;
  event?: ChurchEvent;
  defaultStart?: string;
  defaultEnd?: string;
  onSaved: (result: { id: string; count: number }) => void;
  onCancel: () => void;
}

export function EventForm({
  branches,
  defaultBranchId,
  canBookRooms,
  event,
  defaultStart = "",
  defaultEnd = "",
  onSaved,
  onCancel,
}: EventFormProps) {
  const [values, setValues] = useState(() =>
    initialValues(event, defaultBranchId ?? branches[0]?.id ?? "", defaultStart, defaultEnd),
  );
  const [frequency, setFrequency] = useState<RepeatFrequency | "">("");
  const [until, setUntil] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateEvent();
  const update = useUpdateEvent(event?.id ?? "");
  const mutation = event ? update : create;

  const rooms = useRooms({ branchId: values.branchId, pageSize: 100 }, canBookRooms && Boolean(values.branchId));
  const ministries = useQuery({
    queryKey: ["ministries", "options", values.branchId],
    queryFn: () => apiFetch<Page<Ministry>>(`/ministries?branchId=${values.branchId}&pageSize=100`),
    enabled: Boolean(values.branchId),
  });

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((v) => ({ ...v, [key]: value, ...(key === "branchId" ? { roomId: "", ministryId: "" } : {}) }));

  const startsAt = fromLocalInput(values.start);
  const endsAt = fromLocalInput(values.end);

  const occurrenceCount = useMemo(() => {
    if (!frequency || !until || !startsAt || !endsAt) return null;
    const untilDate = new Date(until);
    if (Number.isNaN(untilDate.getTime())) return null;
    return expandOccurrences(new Date(startsAt), new Date(endsAt), { frequency, until: untilDate }).length;
  }, [frequency, until, startsAt, endsAt]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event) {
      const payload: Record<string, unknown> = {
        title: values.title,
        category: values.category,
        startsAt,
        endsAt,
        branchId: values.branchId,
        registrationRequired: values.registrationRequired,
        ...(values.roomId ? { roomId: values.roomId } : {}),
        ...(values.ministryId ? { ministryId: values.ministryId } : {}),
        ...(values.description.trim() ? { description: values.description } : {}),
        ...(values.capacity ? { capacity: Number(values.capacity) } : {}),
        ...(frequency ? { repeat: { frequency, until } } : {}),
      };
      const parsed = eventCreateSchema.safeParse(payload);
      if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
      setErrors({});
      create.mutate(payload, { onSuccess: (r) => onSaved({ id: r.items[0].id, count: r.count }) });
      return;
    }

    const original = initialValues(event, event.branchId, "", "");
    const changed: Record<string, unknown> = {};
    if (values.title !== original.title) changed.title = values.title;
    if (values.category !== original.category) changed.category = values.category;
    if (values.start !== original.start) changed.startsAt = startsAt;
    if (values.end !== original.end) changed.endsAt = endsAt;
    if (values.roomId !== original.roomId) changed.roomId = values.roomId || null;
    if (values.ministryId !== original.ministryId) changed.ministryId = values.ministryId || null;
    if (values.description !== original.description) changed.description = values.description || null;
    if (values.capacity !== original.capacity) changed.capacity = values.capacity ? Number(values.capacity) : null;
    if (values.registrationRequired !== original.registrationRequired) changed.registrationRequired = values.registrationRequired;
    if (Object.keys(changed).length === 0) return onCancel();

    const parsed = eventUpdateSchema.safeParse(changed);
    if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
    setErrors({});
    update.mutate(changed, { onSuccess: (r) => onSaved({ id: r.id, count: 1 }) });
  }

  const field = (id: string, label: string, control: React.ReactNode, className = "") => (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      {control}
      {errors[id] && <p className="text-destructive text-xs">{errors[id]}</p>}
    </div>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {field("title", "Title", <Input id="title" value={values.title} onChange={(e) => set("title", e.target.value)} />)}
      <div className="grid gap-4 sm:grid-cols-2">
        {field(
          "category",
          "Category",
          <NativeSelect id="category" value={values.category} onChange={(e) => set("category", e.target.value)}>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EVENT_CATEGORY_META[c].label}
              </option>
            ))}
          </NativeSelect>,
        )}
        {!event &&
          branches.length > 1 &&
          field(
            "branchId",
            "Branch",
            <NativeSelect id="branchId" value={values.branchId} onChange={(e) => set("branchId", e.target.value)}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </NativeSelect>,
          )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("startsAt", "Starts", <Input id="startsAt" type="datetime-local" value={values.start} onChange={(e) => set("start", e.target.value)} />)}
        {field("endsAt", "Ends", <Input id="endsAt" type="datetime-local" value={values.end} onChange={(e) => set("end", e.target.value)} />)}
      </div>

      {!event && (
        <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-3">
          <div className="grid gap-4 sm:grid-cols-2">
            {field(
              "frequency",
              "Repeats",
              <NativeSelect id="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as RepeatFrequency | "")}>
                <option value="">Does not repeat</option>
                {REPEAT_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {REPEAT_LABELS[f]}
                  </option>
                ))}
              </NativeSelect>,
            )}
            {frequency &&
              field("until", "Until", <Input id="until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />)}
          </div>
          <AnimatePresence>
            {occurrenceCount !== null && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-muted-foreground flex items-center gap-2 text-xs"
              >
                <RepeatIcon className="size-3.5" />
                This creates {occurrenceCount} {occurrenceCount === 1 ? "date" : "dates"}
                {occurrenceCount === MAX_OCCURRENCES && ` (the maximum for one series)`}.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {canBookRooms &&
          field(
            "roomId",
            "Room",
            <NativeSelect id="roomId" value={values.roomId} onChange={(e) => set("roomId", e.target.value)}>
              <option value="">No room</option>
              {rooms.data?.items
                .filter((r) => r.isActive)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.capacity ? ` (${r.capacity})` : ""}
                  </option>
                ))}
            </NativeSelect>,
          )}
        {field(
          "ministryId",
          "Ministry",
          <NativeSelect id="ministryId" value={values.ministryId} onChange={(e) => set("ministryId", e.target.value)}>
            <option value="">None</option>
            {ministries.data?.items.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>,
        )}
      </div>

      <div className="grid items-end gap-4 sm:grid-cols-2">
        {field(
          "capacity",
          "Capacity",
          <Input id="capacity" type="number" min={1} value={values.capacity} onChange={(e) => set("capacity", e.target.value)} />,
        )}
        <label className="flex h-8 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={values.registrationRequired}
            onChange={(e) => set("registrationRequired", e.target.checked)}
          />
          Take registrations
        </label>
      </div>

      {field(
        "description",
        "Description",
        <Textarea id="description" rows={3} value={values.description} onChange={(e) => set("description", e.target.value)} />,
      )}

      <ErrorAlert error={mutation.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save event"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
