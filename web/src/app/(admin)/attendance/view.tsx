"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, ShieldCheckIcon, UsersIcon } from "@/components/icons";
import { AnimatedNumber, FadeIn, MotionRow, MotionTableBody } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/features/admin/queries";
import { useAttendanceStats, useServices } from "@/features/attendance/api";
import { AttendanceTrend } from "@/features/attendance/attendance-trend";
import { serviceTiming } from "@/features/attendance/format";
import { ServiceForm } from "@/features/attendance/service-form";
import { formatDayLong, formatTime } from "@/lib/datetime";
import { useSessionStore } from "@/stores/session-store";

const TIMING_BADGE = {
  today: { label: "Today", variant: "default" },
  upcoming: { label: "Upcoming", variant: "outline" },
  past: null,
} as const;

export function AttendanceView() {
  const router = useRouter();
  const can = useSessionStore((s) => s.can);
  const me = useSessionStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const services = useServices({ page });
  const stats = useAttendanceStats();
  const branches = useBranches(can("branches.read"));

  const weeks = stats.data?.weeks ?? [];
  const thisWeek = weeks.at(-1);
  const lastWeek = weeks.at(-2);
  const pages = services.data ? Math.max(1, Math.ceil(services.data.total / services.data.pageSize)) : 1;
  const branchOptions = branches.data ?? (me?.branchId ? [{ id: me.branchId, name: "My branch" }] : []);

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Worship services, check-in, and kids pickup."
        actions={
          can("attendance.manage") && (
            <Button onClick={() => setCreating(true)} disabled={branchOptions.length === 0}>
              <PlusIcon />
              New service
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Weekly attendance</CardTitle>
            <CardDescription>Usher headcount, or check-ins where no count was given, over the last 8 weeks.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceTrend stats={stats.data} />
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <FadeIn>
            <Card>
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  <UsersIcon className="size-4" />
                  Last full week
                </CardDescription>
                <CardTitle className="text-3xl">
                  {lastWeek ? <AnimatedNumber value={lastWeek.attendance} /> : <Skeleton className="h-8 w-16" />}
                </CardTitle>
                {thisWeek && thisWeek.services > 0 && (
                  <CardDescription>This week so far: {thisWeek.attendance}</CardDescription>
                )}
              </CardHeader>
            </Card>
          </FadeIn>
          <FadeIn delay={0.08}>
            <Card>
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  <ShieldCheckIcon className="size-4" />
                  Kids in care right now
                </CardDescription>
                <CardTitle className="text-3xl">
                  {stats.data ? <AnimatedNumber value={stats.data.childrenInCare} /> : <Skeleton className="h-8 w-16" />}
                </CardTitle>
              </CardHeader>
            </Card>
          </FadeIn>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
          <CardDescription>Open a service to check people in.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {services.isPending && <Skeleton className="mx-4 h-32" />}
          {services.data?.items.length === 0 && <p className="text-muted-foreground px-4 py-8 text-center text-sm">No services yet.</p>}
          {services.data && services.data.items.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Service</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Checked in</TableHead>
                    <TableHead className="text-right">Kids</TableHead>
                    <TableHead className="pr-4 text-right">Attendance</TableHead>
                  </TableRow>
                </TableHeader>
                <MotionTableBody key={page}>
                  {services.data.items.map((s) => {
                    const badge = TIMING_BADGE[serviceTiming(s.startsAt)];
                    return (
                      <MotionRow key={s.id} className="cursor-pointer" onClick={() => router.push(`/attendance/services/${s.id}`)}>
                        <TableCell className="pl-4">
                          <Link href={`/attendance/services/${s.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                            {s.name}
                          </Link>
                          {badge && (
                            <Badge variant={badge.variant} className="ml-2">
                              {badge.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDayLong(s.startsAt)}, {formatTime(s.startsAt)}
                        </TableCell>
                        <TableCell className="text-sm">{s.branch.name}</TableCell>
                        <TableCell className="text-right font-data">{s.checkIns}</TableCell>
                        <TableCell className="text-right font-data">{s.children}</TableCell>
                        <TableCell className="pr-4 text-right font-medium font-data">
                          {s.attendance}
                          {s.headcount === null && s.checkIns > 0 && <span className="text-muted-foreground ml-1 text-xs">(check-ins)</span>}
                        </TableCell>
                      </MotionRow>
                    );
                  })}
                </MotionTableBody>
              </Table>
            </div>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 px-4 pt-3 text-sm">
              <span className="text-muted-foreground">
                Page {page} of {pages}
              </span>
              <Button size="icon-sm" variant="outline" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeftIcon />
              </Button>
              <Button size="icon-sm" variant="outline" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRightIcon />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New service</SheetTitle>
            <SheetDescription>Add a worship service to take attendance and check-ins.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {creating && (
              <ServiceForm
                branches={branchOptions}
                defaultBranchId={me?.branchId ?? undefined}
                onCancel={() => setCreating(false)}
                onSaved={(s) => {
                  setCreating(false);
                  toast.success("Service created");
                  router.push(`/attendance/services/${s.id}`);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
