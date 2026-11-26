"use client";

import { MINISTRY_CATEGORIES, type MinistryCategory } from "@cms/shared";
import { ClockIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/icons";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBranches } from "@/features/admin/queries";
import { useMinistries } from "@/features/ministries/api";
import { CATEGORY_META, leadersLine } from "@/features/ministries/format";
import { MinistryForm } from "@/features/ministries/ministry-form";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

const FILTERS: (MinistryCategory | "ALL")[] = ["ALL", ...MINISTRY_CATEGORIES];

export function MinistriesView() {
  const router = useRouter();
  const can = useSessionStore((s) => s.can);
  const me = useSessionStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MinistryCategory | undefined>();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const debounced = useDebouncedValue(search);
  const ministries = useMinistries({ page, pageSize: 24, search: debounced, category });
  const branches = useBranches(can("branches.read"));
  const totalPages = ministries.data ? Math.max(1, Math.ceil(ministries.data.total / ministries.data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Ministries"
        description="Teams that serve, grow, and care together."
        actions={
          can("ministries.manage") && (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon />
              New ministry
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-64">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            aria-label="Search ministries"
            placeholder="Search ministries"
            className="pl-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div role="tablist" aria-label="Filter by category" className="bg-muted flex flex-wrap gap-1 rounded-lg p-1">
          {FILTERS.map((f) => {
            const active = (f === "ALL" && !category) || f === category;
            return (
              <button
                key={f}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setCategory(f === "ALL" ? undefined : f);
                  setPage(1);
                }}
                className={cn(
                  "relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="category-filter"
                    className="bg-background absolute inset-0 rounded-md shadow-sm"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative">{f === "ALL" ? "All" : CATEGORY_META[f].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {ministries.data?.items.length === 0 && (
        <p className="text-muted-foreground py-10 text-center text-sm">No ministries match these filters.</p>
      )}

      <Stagger
        key={`${debounced}-${category ?? "all"}-${page}-${ministries.data ? "y" : "n"}`}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {ministries.data?.items.map((m) => {
          const meta = CATEGORY_META[m.category];
          return (
            <StaggerItem key={m.id} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
              <Link href={`/ministries/${m.id}`} className="block h-full rounded-xl focus-visible:outline-2">
                <Card className={cn("relative h-full overflow-hidden transition-[box-shadow] hover:ring-foreground/35", !m.isActive && "opacity-60")}>
                  <span className={cn("absolute inset-y-0 left-0 w-1", meta.accent)} aria-hidden />
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="flex items-center gap-2">
                        <span className={cn("flex size-7 items-center justify-center rounded-md text-white", meta.accent)}>
                          <meta.icon className="size-4" />
                        </span>
                        {m.name}
                      </CardTitle>
                      {!m.isActive && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <CardDescription>{leadersLine(m.members ?? [])}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="flex items-center gap-1">
                      <UsersIcon className="size-3.5" />
                      {m._count?.members ?? 0} serving
                    </span>
                    {m.meetingSchedule && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="size-3.5" />
                        {m.meetingSchedule}
                      </span>
                    )}
                    <span>{m.branch.name}</span>
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      {totalPages > 1 && (
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
      )}

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>New ministry</SheetTitle>
            <SheetDescription>Add volunteer roles and people after creating it.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {creating && (
              <MinistryForm
                branches={branches.data ?? []}
                defaultBranchId={me?.branchId ?? undefined}
                onCancel={() => setCreating(false)}
                onSaved={(m) => {
                  setCreating(false);
                  toast.success(`${m.name} created`);
                  router.push(`/ministries/${m.id}`);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
