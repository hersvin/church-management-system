"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, SearchIcon } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Page } from "@/features/admin/queries";
import type { Member } from "@/features/members/api";
import { buildMemberQuery, fullName, initials, STATUS_LABELS } from "@/features/members/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type PickedPerson = Pick<Member, "id" | "firstName" | "lastName" | "status" | "email">;

export interface MemberPickerProps {
  branchId: string;
  excludeIds: string[];
  selected: PickedPerson | null;
  onSelect: (person: PickedPerson) => void;
  label?: string;
  /** Needed when a form shows more than one picker. */
  inputId?: string;
}

/** Search-as-you-type person picker limited to one branch. */
export function MemberPicker({ branchId, excludeIds, selected, onSelect, label = "Find a person", inputId = "person-search" }: MemberPickerProps) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const results = useQuery({
    queryKey: ["members", "picker", branchId, debounced],
    queryFn: () =>
      apiFetch<Page<PickedPerson>>(`/members?${buildMemberQuery({ page: 1, pageSize: 8, search: debounced, branchId })}`),
    enabled: debounced.length > 0,
  });
  const excluded = new Set(excludeIds);
  const options = (results.data?.items ?? []).filter((p) => !excluded.has(p.id));

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          id={inputId}
          className="pl-8"
          placeholder="Type a name, email, or phone"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ul role="listbox" aria-label="Matching people" className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {options.map((p) => {
            const active = selected?.id === p.id;
            return (
              <motion.li key={p.id} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onSelect(p)}
                  className={cn(
                    "hover:bg-muted flex w-full items-center gap-3 rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                    active ? "border-primary bg-muted" : "border-transparent",
                  )}
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">{initials(p)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1">
                    <span className="font-medium">{fullName(p)}</span>
                    <span className="text-muted-foreground block text-xs">
                      {STATUS_LABELS[p.status]}
                      {p.email ? ` · ${p.email}` : ""}
                    </span>
                  </span>
                  {active && <CheckIcon className="text-primary size-4" />}
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {debounced && results.data && options.length === 0 && (
        <p className="text-muted-foreground text-xs">No one else matches in this branch.</p>
      )}
    </div>
  );
}
