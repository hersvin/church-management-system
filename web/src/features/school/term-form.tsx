"use client";

import { termCreateSchema, termUpdateSchema } from "@cms/shared";
import { useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/conflict-alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useCreateTerm, useUpdateTerm, type Term } from "./api";

export interface TermFormProps {
  branches: { id: string; name: string; code: string }[];
  defaultBranchId?: string;
  term?: Term;
  onSaved: (term: Term) => void;
  onCancel: () => void;
}

export function TermForm({ branches, defaultBranchId, term, onSaved, onCancel }: TermFormProps) {
  const [values, setValues] = useState({
    name: term?.name ?? "",
    branchId: term?.branchId ?? defaultBranchId ?? branches[0]?.id ?? "",
    startsOn: term?.startsOn.slice(0, 10) ?? "",
    endsOn: term?.endsOn.slice(0, 10) ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateTerm();
  const update = useUpdateTerm(term?.id ?? "");
  const mutation = term ? update : create;

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  const toErrors = (issues: { path: PropertyKey[]; code: string; message: string }[]) =>
    Object.fromEntries(issues.map((i) => [String(i.path[0]), i.code === "too_small" ? "Required" : i.message]));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!term) {
      const parsed = termCreateSchema.safeParse(values);
      if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
      setErrors({});
      return create.mutate(values, { onSuccess: onSaved });
    }
    const changed = Object.fromEntries(
      (["name", "startsOn", "endsOn"] as const)
        .filter((k) => values[k] !== (k === "name" ? term.name : term[k].slice(0, 10)))
        .map((k) => [k, values[k]]),
    );
    if (Object.keys(changed).length === 0) return onCancel();
    const parsed = termUpdateSchema.safeParse(changed);
    if (!parsed.success) return setErrors(toErrors(parsed.error.issues));
    setErrors({});
    update.mutate(changed, { onSuccess: onSaved });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="term-name">Name</Label>
        <Input id="term-name" value={values.name} onChange={set("name")} placeholder="School Year 2026-2027, Term 3" />
        {errors.name && <p className="text-destructive text-xs">{errors.name}</p>}
      </div>
      {!term && branches.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="term-branch">Branch</Label>
          <NativeSelect id="term-branch" value={values.branchId} onChange={set("branchId")}>
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
          <Label htmlFor="term-starts">Starts</Label>
          <Input id="term-starts" type="date" value={values.startsOn} onChange={set("startsOn")} />
          {errors.startsOn && <p className="text-destructive text-xs">{errors.startsOn}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="term-ends">Ends</Label>
          <Input id="term-ends" type="date" value={values.endsOn} onChange={set("endsOn")} />
          {errors.endsOn && <p className="text-destructive text-xs">{errors.endsOn}</p>}
        </div>
      </div>
      <ErrorAlert error={mutation.error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save term"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
