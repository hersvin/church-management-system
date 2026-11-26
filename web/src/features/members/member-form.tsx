"use client";

import {
  CIVIL_STATUSES,
  GENDERS,
  HOUSEHOLD_ROLES,
  MEMBER_STATUSES,
  memberCreateSchema,
  memberUpdateSchema,
  type MemberUpdateInput,
} from "@cms/shared";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent, type ReactNode } from "react";
import type { Page } from "@/features/admin/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { useCreateMember, useUpdateMember, type Household, type Member } from "./api";
import { STATUS_LABELS } from "./format";

const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");

type Errors = Record<string, string>;

type FieldName =
  | "firstName" | "middleName" | "lastName" | "suffix" | "email" | "phone" | "address" | "occupation" | "notes"
  | "birthDate" | "membershipDate" | "baptismDate"
  | "gender" | "civilStatus" | "status" | "branchId" | "householdId" | "householdRole";

function initialValues(member?: Member, defaultBranchId?: string): Record<FieldName, string> {
  const v = (x: string | null | undefined) => x ?? "";
  return {
    firstName: v(member?.firstName),
    middleName: v(member?.middleName),
    lastName: v(member?.lastName),
    suffix: v(member?.suffix),
    email: v(member?.email),
    phone: v(member?.phone),
    address: v(member?.address),
    occupation: v(member?.occupation),
    notes: v(member?.notes),
    birthDate: v(member?.birthDate?.slice(0, 10)),
    membershipDate: v(member?.membershipDate?.slice(0, 10)),
    baptismDate: v(member?.baptismDate?.slice(0, 10)),
    gender: member?.gender ?? "UNSPECIFIED",
    civilStatus: v(member?.civilStatus),
    status: member?.status ?? "VISITOR",
    branchId: member?.branchId ?? defaultBranchId ?? "",
    householdId: v(member?.householdId),
    householdRole: v(member?.householdRole),
  };
}

function issuesToErrors(issues: { path: PropertyKey[]; code: string; message: string }[]): Errors {
  const errors: Errors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    const missing =
      issue.code === "too_small" || (issue.code === "invalid_type" && issue.message.includes("undefined"));
    errors[key] ??= missing ? "Required" : issue.message;
  }
  return errors;
}

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={`${name}-error`}
            className="text-destructive text-xs"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface MemberFormProps {
  branches: { id: string; name: string; code: string }[];
  defaultBranchId?: string;
  member?: Member;
  onSaved: (member: Member) => void;
  onCancel: () => void;
}

export function MemberForm({ branches, defaultBranchId, member, onSaved, onCancel }: MemberFormProps) {
  const [values, setValues] = useState(() => initialValues(member, defaultBranchId ?? branches[0]?.id));
  const [statusNote, setStatusNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const create = useCreateMember();
  const update = useUpdateMember(member?.id ?? "");
  const mutation = member ? update : create;

  const households = useQuery({
    queryKey: ["households", "options", values.branchId],
    queryFn: () => apiFetch<Page<Household>>(`/households?branchId=${values.branchId}&pageSize=100`),
    enabled: Boolean(values.branchId),
  });

  const set = (name: FieldName) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setValues((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "branchId" ? { householdId: "", householdRole: "" } : {}),
      ...(name === "householdId" && !value ? { householdRole: "" } : {}),
    }));
  };

  const control = (name: FieldName) => ({
    id: name,
    name,
    value: values[name],
    onChange: set(name),
    "aria-invalid": Boolean(errors[name]) || undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) {
      const payload = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ""));
      const parsed = memberCreateSchema.safeParse(payload);
      if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
      setErrors({});
      create.mutate(parsed.data, { onSuccess: onSaved, onError: (e) => setErrors({ form: e.message }) });
      return;
    }

    // Edit: send only fields that changed, with blanks meaning "clear".
    const original = initialValues(member);
    const changed: Record<string, string | null> = {};
    for (const key of Object.keys(values) as FieldName[]) {
      if (values[key] !== original[key]) changed[key] = values[key] === "" ? null : values[key];
    }
    if (changed.status && statusNote.trim()) changed.statusNote = statusNote;
    if (Object.keys(changed).length === 0) return onCancel();
    const parsed = memberUpdateSchema.safeParse(changed);
    if (!parsed.success) return setErrors(issuesToErrors(parsed.error.issues));
    setErrors({});
    update.mutate(parsed.data as MemberUpdateInput, {
      onSuccess: onSaved,
      onError: (e) => setErrors({ form: e.message }),
    });
  }

  const statusChanged = member && values.status !== member.status;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">Personal</legend>
        <Field label="First name" name="firstName" error={errors.firstName}>
          <Input {...control("firstName")} autoComplete="given-name" />
        </Field>
        <Field label="Last name" name="lastName" error={errors.lastName}>
          <Input {...control("lastName")} autoComplete="family-name" />
        </Field>
        <Field label="Middle name" name="middleName" error={errors.middleName}>
          <Input {...control("middleName")} />
        </Field>
        <Field label="Suffix" name="suffix" error={errors.suffix}>
          <Input {...control("suffix")} placeholder="Jr., Sr., III" />
        </Field>
        <Field label="Gender" name="gender" error={errors.gender}>
          <NativeSelect {...control("gender")}>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {title(g)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Civil status" name="civilStatus" error={errors.civilStatus}>
          <NativeSelect {...control("civilStatus")}>
            <option value="">Not set</option>
            {CIVIL_STATUSES.map((c) => (
              <option key={c} value={c}>
                {title(c)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Birth date" name="birthDate" error={errors.birthDate}>
          <Input type="date" {...control("birthDate")} />
        </Field>
        <Field label="Occupation" name="occupation" error={errors.occupation}>
          <Input {...control("occupation")} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">Contact</legend>
        <Field label="Email" name="email" error={errors.email}>
          <Input type="email" {...control("email")} autoComplete="email" />
        </Field>
        <Field label="Phone" name="phone" error={errors.phone}>
          <Input type="tel" {...control("phone")} autoComplete="tel" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address" name="address" error={errors.address}>
            <Input {...control("address")} autoComplete="street-address" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">Church</legend>
        <Field label="Status" name="status" error={errors.status}>
          <NativeSelect {...control("status")}>
            {MEMBER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Branch" name="branchId" error={errors.branchId}>
          <NativeSelect {...control("branchId")}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <AnimatePresence initial={false}>
          {statusChanged && (
            <motion.div
              className="sm:col-span-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Field label="Reason for status change (optional)" name="statusNote">
                <Input id="statusNote" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>
        <Field label="Membership date" name="membershipDate" error={errors.membershipDate}>
          <Input type="date" {...control("membershipDate")} />
        </Field>
        <Field label="Baptism date" name="baptismDate" error={errors.baptismDate}>
          <Input type="date" {...control("baptismDate")} />
        </Field>
        <Field label="Household" name="householdId" error={errors.householdId}>
          <NativeSelect {...control("householdId")}>
            <option value="">No household</option>
            {households.data?.items.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Role in household" name="householdRole" error={errors.householdRole}>
          <NativeSelect {...control("householdRole")} disabled={!values.householdId}>
            <option value="">Select a role</option>
            {HOUSEHOLD_ROLES.map((r) => (
              <option key={r} value={r}>
                {title(r)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes" name="notes" error={errors.notes}>
            <Textarea {...control("notes")} rows={3} />
          </Field>
        </div>
      </fieldset>

      {errors.form && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {errors.form}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save member"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
