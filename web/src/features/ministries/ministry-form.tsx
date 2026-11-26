"use client";

import { MINISTRY_CATEGORIES, ministryCreateSchema, ministryUpdateSchema } from "@cms/shared";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMinistry, useUpdateMinistry, type Ministry } from "./api";
import { CATEGORY_META } from "./format";

type FieldName = "name" | "description" | "category" | "meetingSchedule" | "branchId";

function initialValues(ministry?: Ministry, defaultBranchId?: string): Record<FieldName, string> {
  return {
    name: ministry?.name ?? "",
    description: ministry?.description ?? "",
    category: ministry?.category ?? "OTHER",
    meetingSchedule: ministry?.meetingSchedule ?? "",
    branchId: ministry?.branchId ?? defaultBranchId ?? "",
  };
}

export interface MinistryFormProps {
  branches: { id: string; name: string; code: string }[];
  defaultBranchId?: string;
  ministry?: Ministry;
  onSaved: (ministry: Ministry) => void;
  onCancel: () => void;
}

export function MinistryForm({ branches, defaultBranchId, ministry, onSaved, onCancel }: MinistryFormProps) {
  const [values, setValues] = useState(() => initialValues(ministry, defaultBranchId ?? branches[0]?.id));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateMinistry();
  const update = useUpdateMinistry(ministry?.id ?? "");
  const pending = create.isPending || update.isPending;

  const bind = (name: FieldName) => ({
    id: name,
    name,
    value: values[name],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value })),
    "aria-invalid": Boolean(errors[name]) || undefined,
  });

  const toErrors = (issues: { path: PropertyKey[]; code: string; message: string }[]) =>
    Object.fromEntries(
      issues.map((i) => [String(i.path[0] ?? "form"), i.code === "too_small" ? "Required" : i.message]),
    );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const onError = (e: Error) => setErrors({ form: e.message });

    if (!ministry) {
      const parsed = ministryCreateSchema.safeParse(values);
      if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
      setErrors({});
      return create.mutate(parsed.data, { onSuccess: onSaved, onError });
    }

    const original = initialValues(ministry);
    const changed = Object.fromEntries(
      (Object.keys(values) as FieldName[])
        .filter((k) => values[k] !== original[k])
        .map((k) => [k, values[k] === "" ? null : values[k]]),
    );
    if (Object.keys(changed).length === 0) return onCancel();
    const parsed = ministryUpdateSchema.safeParse(changed);
    if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
    setErrors({});
    update.mutate(parsed.data, { onSuccess: onSaved, onError });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input {...bind("name")} placeholder="Worship Team" />
        {errors.name && <p className="text-destructive text-xs">{errors.name}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <NativeSelect {...bind("category")}>
            {MINISTRY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="branchId">Branch</Label>
          <NativeSelect {...bind("branchId")}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
          {errors.branchId && <p className="text-destructive text-xs">{errors.branchId}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="meetingSchedule">Meeting schedule</Label>
        <Input {...bind("meetingSchedule")} placeholder="Thursdays 7:00 PM" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea {...bind("description")} rows={4} />
      </div>
      {errors.form && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {errors.form}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save ministry"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
