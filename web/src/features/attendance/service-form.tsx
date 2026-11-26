"use client";

import { serviceCreateSchema, serviceUpdateSchema } from "@cms/shared";
import { useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/conflict-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { fromLocalInput, toLocalInput } from "@/lib/datetime";
import { useCreateService, useUpdateService, type Service } from "./api";

export interface ServiceFormProps {
  branches: { id: string; name: string }[];
  defaultBranchId?: string;
  service?: Service;
  onSaved: (service: Service) => void;
  onCancel: () => void;
}

export function ServiceForm({ branches, defaultBranchId, service, onSaved, onCancel }: ServiceFormProps) {
  const [values, setValues] = useState({
    name: service?.name ?? "Sunday Worship",
    branchId: service?.branchId ?? defaultBranchId ?? branches[0]?.id ?? "",
    startsAt: service ? toLocalInput(service.startsAt) : "",
    headcount: service?.headcount?.toString() ?? "",
    notes: service?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateService();
  const update = useUpdateService(service?.id ?? "");
  const mutation = service ? update : create;

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const toErrors = (issues: { path: PropertyKey[]; message: string }[]) =>
    Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const startsAt = fromLocalInput(values.startsAt);
    if (!startsAt) return setErrors({ startsAt: "Choose a date and time" });

    if (!service) {
      const input = {
        name: values.name,
        branchId: values.branchId,
        startsAt,
        notes: values.notes,
        ...(values.headcount ? { headcount: values.headcount } : {}),
      };
      const parsed = serviceCreateSchema.safeParse(input);
      if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
      setErrors({});
      return create.mutate(input, { onSuccess: onSaved });
    }

    const changed: Record<string, unknown> = {};
    if (values.name !== service.name) changed.name = values.name;
    if (startsAt !== new Date(service.startsAt).toISOString()) changed.startsAt = startsAt;
    const headcount = values.headcount ? Number(values.headcount) : null;
    if (headcount !== service.headcount) changed.headcount = headcount;
    if (values.notes !== (service.notes ?? "")) changed.notes = values.notes;
    if (Object.keys(changed).length === 0) return onCancel();
    const parsed = serviceUpdateSchema.safeParse(changed);
    if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
    setErrors({});
    update.mutate(changed, { onSuccess: onSaved });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="service-name">Name</Label>
        <Input id="service-name" value={values.name} onChange={set("name")} />
        {errors.name && <p className="text-destructive text-xs">{errors.name}</p>}
      </div>
      {!service && branches.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="service-branch">Branch</Label>
          <NativeSelect id="service-branch" value={values.branchId} onChange={set("branchId")}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="service-starts">Starts</Label>
          <Input id="service-starts" type="datetime-local" value={values.startsAt} onChange={set("startsAt")} />
          {errors.startsAt && <p className="text-destructive text-xs">{errors.startsAt}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="service-headcount">Usher headcount</Label>
          <Input id="service-headcount" type="number" min={0} inputMode="numeric" value={values.headcount} onChange={set("headcount")} />
          {errors.headcount && <p className="text-destructive text-xs">{errors.headcount}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="service-notes">Notes</Label>
        <Textarea id="service-notes" value={values.notes} onChange={set("notes")} />
      </div>
      <ErrorAlert error={mutation.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save service"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
