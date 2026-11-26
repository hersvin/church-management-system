"use client";

import { CLASS_AUDIENCES, type ClassAudience } from "@cms/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { ClockIcon, MapPinIcon, PlusIcon, UsersIcon } from "@/components/icons";
import { Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBranches } from "@/features/admin/queries";
import { formatDate } from "@/features/members/format";
import { useClasses, useTerms } from "@/features/school/api";
import { ClassForm } from "@/features/school/class-form";
import { AUDIENCE_META, scheduleLine, termState } from "@/features/school/format";
import { RateBar } from "@/features/school/rate-bar";
import { TermForm } from "@/features/school/term-form";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

const STATE_LABEL = { current: "Current", upcoming: "Upcoming", ended: "Ended" } as const;

export function SchoolView() {
  const router = useRouter();
  const can = useSessionStore((s) => s.can);
  const me = useSessionStore((s) => s.user);
  const terms = useTerms();
  const branches = useBranches(can("branches.read"));
  const [chosenTermId, setChosenTermId] = useState<string | null>(null);
  const [audience, setAudience] = useState<ClassAudience | undefined>();
  const [creating, setCreating] = useState<"term" | "class" | null>(null);

  // Default to the first current term, else the most recent one.
  const termId = useMemo(() => {
    if (chosenTermId) return chosenTermId;
    const list = terms.data ?? [];
    return (list.find((t) => termState(t.startsOn, t.endsOn) === "current") ?? list[0])?.id ?? null;
  }, [chosenTermId, terms.data]);
  const term = terms.data?.find((t) => t.id === termId);
  const classes = useClasses({ termId: termId ?? undefined, audience }, Boolean(termId));

  return (
    <>
      <PageHeader
        title="School"
        description="Terms, classes, teachers, and attendance."
        actions={
          can("school.manage") && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreating("term")}>
                <PlusIcon />
                New term
              </Button>
              <Button onClick={() => setCreating("class")} disabled={!term}>
                <PlusIcon />
                New class
              </Button>
            </div>
          )
        }
      />

      {terms.data?.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No terms yet</CardTitle>
            <CardDescription>Create a term first, then add classes to it.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2">
            <NativeSelect
              aria-label="Term"
              className="w-auto min-w-64"
              value={termId ?? ""}
              onChange={(e) => setChosenTermId(e.target.value)}
            >
              {terms.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.branch.name}
                </option>
              ))}
            </NativeSelect>
            {term && (
              <Badge variant={termState(term.startsOn, term.endsOn) === "current" ? "default" : "outline"}>
                {STATE_LABEL[termState(term.startsOn, term.endsOn)]}
              </Badge>
            )}
          </div>
          {term && (
            <span className="text-muted-foreground text-sm">
              {formatDate(term.startsOn)} to {formatDate(term.endsOn)}
            </span>
          )}
          <div className="flex flex-wrap gap-1 lg:ml-auto">
            {[undefined, ...CLASS_AUDIENCES].map((a) => (
              <button
                key={a ?? "all"}
                aria-pressed={a === audience}
                onClick={() => setAudience(a)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  a === audience ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {a ? AUDIENCE_META[a].label : "All"}
              </button>
            ))}
          </div>
        </div>
      )}

      {classes.data?.items.length === 0 && (
        <p className="text-muted-foreground py-10 text-center text-sm">No classes in this term yet.</p>
      )}

      <Stagger key={`${termId}-${audience ?? "all"}-${classes.data ? "y" : "n"}`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {classes.data?.items.map((c) => {
          const meta = AUDIENCE_META[c.audience];
          const lead = c.teachers.filter((t) => t.role === "LEAD").map((t) => `${t.member.firstName} ${t.member.lastName}`);
          return (
            <StaggerItem key={c.id} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
              <Link href={`/school/classes/${c.id}`} className="block h-full rounded-xl focus-visible:outline-2">
                <Card className="relative h-full overflow-hidden transition-[box-shadow] hover:ring-foreground/35">
                  <span className={cn("absolute inset-y-0 left-0 w-1", meta.accent)} aria-hidden />
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>{c.name}</CardTitle>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", meta.chip)}>
                        {meta.label}
                        {c.ageRange ? ` · ${c.ageRange}` : ""}
                      </span>
                    </div>
                    <CardDescription>{lead.length ? `Taught by ${lead.join(", ")}` : "No teacher assigned"}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="size-3.5" />
                        {scheduleLine(c.meetingDay, c.startTime, c.endTime)}
                      </span>
                      {c.room && (
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="size-3.5" />
                          {c.room.name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <UsersIcon className="size-3.5" />
                        {c._count.enrollments}
                        {c.capacity ? ` / ${c.capacity}` : ""} students
                      </span>
                    </div>
                    <RateBar rate={c.attendanceRate} />
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      <Sheet open={creating !== null} onOpenChange={(open) => !open && setCreating(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{creating === "term" ? "New term" : `New class in ${term?.name ?? ""}`}</SheetTitle>
            <SheetDescription>
              {creating === "term" ? "Classes, enrollment, and attendance belong to a term." : "Add teachers and students after creating it."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {creating === "term" && (
              <TermForm
                branches={branches.data ?? []}
                defaultBranchId={me?.branchId ?? undefined}
                onCancel={() => setCreating(null)}
                onSaved={(t) => {
                  setCreating(null);
                  setChosenTermId(t.id);
                  toast.success("Term created");
                }}
              />
            )}
            {creating === "class" && term && (
              <ClassForm
                termId={term.id}
                branchId={term.branchId}
                onCancel={() => setCreating(null)}
                onSaved={(c) => {
                  setCreating(null);
                  toast.success("Class created");
                  router.push(`/school/classes/${c.id}`);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
