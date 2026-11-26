"use client";

import { MEMBER_STATUSES, type MemberStatus } from "@cms/shared";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { MotionRow, MotionTableBody } from "@/components/motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/features/admin/queries";
import { useMembers } from "@/features/members/api";
import { ageFrom, fullName, initials, STATUS_LABELS, statusTone } from "@/features/members/format";
import { MemberForm } from "@/features/members/member-form";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

const FILTERS: (MemberStatus | "ALL")[] = ["ALL", ...MEMBER_STATUSES];

function initialStatus(): MemberStatus | undefined {
  if (typeof window === "undefined") return undefined;
  const value = new URLSearchParams(window.location.search).get("status");
  return MEMBER_STATUSES.includes(value as MemberStatus) ? (value as MemberStatus) : undefined;
}

export function MembersView() {
  const router = useRouter();
  const can = useSessionStore((s) => s.can);
  const me = useSessionStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MemberStatus | undefined>(initialStatus);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const filters = { page, pageSize: 20, search: debouncedSearch, status };
  const members = useMembers(filters);
  const branches = useBranches(can("branches.read"));
  const branchOptions = branches.data ?? [];
  const totalPages = members.data ? Math.max(1, Math.ceil(members.data.total / members.data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Members"
        description={members.data ? `${members.data.total} people in your directory` : "Your church directory"}
        actions={
          can("members.manage") && (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon />
              New member
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            aria-label="Search members"
            placeholder="Search name, email, phone"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div role="tablist" aria-label="Filter by status" className="bg-muted flex flex-wrap gap-1 rounded-lg p-1">
          {FILTERS.map((f) => {
            const active = (f === "ALL" && !status) || f === status;
            return (
              <button
                key={f}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setStatus(f === "ALL" ? undefined : f);
                  setPage(1);
                }}
                className={cn(
                  "relative rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="status-filter"
                    className="bg-background absolute inset-0 rounded-md shadow-sm"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative">{f === "ALL" ? "All" : STATUS_LABELS[f]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn("overflow-x-auto rounded-lg border transition-opacity", members.isPlaceholderData && "opacity-60")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead className="hidden lg:table-cell">Household</TableHead>
              <TableHead className="hidden sm:table-cell">Branch</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Age</TableHead>
            </TableRow>
          </TableHeader>
          <MotionTableBody key={`${page}-${debouncedSearch}-${status ?? "all"}-${members.data ? "y" : "n"}`}>
            {members.isPending && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Loading members...
                </TableCell>
              </TableRow>
            )}
            {members.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                  No people match these filters.
                </TableCell>
              </TableRow>
            )}
            {members.data?.items.map((m) => (
              <MotionRow
                key={m.id}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => router.push(`/members/${m.id}`)}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/members/${m.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">{initials(m)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{fullName(m)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusTone(m.status)}>{STATUS_LABELS[m.status]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {m.email ?? m.phone ?? "None"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">{m.household?.name ?? "None"}</TableCell>
                <TableCell className="hidden sm:table-cell">{m.branch.name}</TableCell>
                <TableCell className="hidden text-right lg:table-cell">{ageFrom(m.birthDate) ?? "None"}</TableCell>
              </MotionRow>
            ))}
          </MotionTableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>New member</SheetTitle>
            <SheetDescription>Add a person to the church directory.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {creating && (
              <MemberForm
                branches={branchOptions.length ? branchOptions : me?.branchId ? [{ id: me.branchId, name: "My branch", code: "" }] : []}
                defaultBranchId={me?.branchId ?? undefined}
                onCancel={() => setCreating(false)}
                onSaved={(m) => {
                  setCreating(false);
                  toast.success(`${fullName(m)} added`);
                  router.push(`/members/${m.id}`);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
