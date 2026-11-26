"use client";

import { MEMBER_STATUSES } from "@cms/shared";
import { type AppIcon, BookBookmarkIcon, ClipboardListIcon, ClockIcon, HandIcon, HeartIcon, HistoryIcon, HouseIcon, MapIcon, ShieldCheckIcon, MapPinIcon, SparklesIcon, UserCogIcon, UsersIcon } from "@/components/icons";
import { motion } from "motion/react";
import Link from "next/link";
import { AnimatedNumber, EASE_OUT, Stagger, StaggerItem } from "@/components/motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudit, useBranches, useUsers } from "@/features/admin/queries";
import { useMemberStats } from "@/features/members/api";
import { useUpcomingEvents } from "@/features/events/api";
import { EVENT_CATEGORY_META } from "@/features/events/format";
import { useMinistryStats } from "@/features/ministries/api";
import { usePendingBookings } from "@/features/rooms/api";
import { RoomUsageCard } from "@/features/rooms/room-usage-card";
import { useSchoolStats } from "@/features/school/api";
import { useAttendanceStats } from "@/features/attendance/api";
import { AttendanceTrend } from "@/features/attendance/attendance-trend";
import { formatDayLong, formatTimeRange } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/features/members/format";
import { useSessionStore } from "@/stores/session-store";

const STATUS_BAR: Record<string, string> = {
  MEMBER: "bg-primary",
  REGULAR: "bg-primary/60",
  VISITOR: "bg-primary/30",
  INACTIVE: "bg-foreground/15",
};

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | undefined;
  icon: AppIcon;
  href?: string;
}) {
  const card = (
    <Card className="h-full transition-[box-shadow] hover:ring-foreground/35">
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="text-3xl">
          {value === undefined ? <Skeleton className="h-8 w-16" /> : <AnimatedNumber value={value} />}
        </CardTitle>
      </CardHeader>
    </Card>
  );
  return (
    <StaggerItem whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      {href ? (
        <Link href={href} className="block h-full rounded-xl focus-visible:outline-2">
          {card}
        </Link>
      ) : (
        card
      )}
    </StaggerItem>
  );
}

export function DashboardView() {
  const user = useSessionStore((s) => s.user);
  const can = useSessionStore((s) => s.can);
  const members = useMemberStats(can("members.read"));
  const ministries = useMinistryStats(can("ministries.read"));
  const users = useUsers(1, can("users.read"));
  const branches = useBranches(can("branches.read"));
  const audit = useAudit(1, can("audit.read"));
  const stats = members.data;
  const upcoming = useUpcomingEvents(6, can("events.read"));
  const pending = usePendingBookings(can("rooms.manage"));
  const school = useSchoolStats(can("school.read"));
  const attendance = useAttendanceStats(can("attendance.read"));
  const lastWeek = attendance.data?.weeks.at(-2);

  return (
    <>
      <section className="ink-grain bg-card border-border rounded-lg border px-5 py-6">
        <p className="micro-label">
          Today · <span className="font-data">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Welcome, {user?.firstName ?? ""}</h1>
        <p className="text-muted-foreground text-sm">Here is what is happening across your church.</p>
      </section>
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {can("members.read") && (
          <>
            <StatCard label="People" value={stats?.total} icon={UsersIcon} href="/members" />
            <StatCard label="Members" value={stats?.byStatus.MEMBER} icon={UsersIcon} href="/members?status=MEMBER" />
            <StatCard label="New this month" value={stats?.newThisMonth} icon={SparklesIcon} href="/members" />
            <StatCard label="Households" value={stats?.households} icon={HouseIcon} href="/households" />
          </>
        )}
        {can("ministries.read") && (
          <>
            <StatCard label="Active ministries" value={ministries.data?.ministries} icon={HeartIcon} href="/ministries" />
            <StatCard label="People serving" value={ministries.data?.participants} icon={HandIcon} href="/ministries" />
          </>
        )}
        {can("school.read") && (
          <>
            <StatCard label="Classes this term" value={school.data?.activeClasses} icon={BookBookmarkIcon} href="/school" />
            <StatCard label="Students enrolled" value={school.data?.students} icon={UsersIcon} href="/school" />
            {school.data?.attendanceRate !== null && (
              <StatCard label="Class attendance, 30 days (%)" value={school.data?.attendanceRate} icon={ClipboardListIcon} href="/school" />
            )}
          </>
        )}
        {can("attendance.read") && (
          <>
            <StatCard label="Attendance last week" value={attendance.data ? (lastWeek?.attendance ?? 0) : undefined} icon={ClipboardListIcon} href="/attendance" />
            <StatCard label="Kids in care now" value={attendance.data?.childrenInCare} icon={ShieldCheckIcon} href="/attendance" />
          </>
        )}
        {can("rooms.manage") && (
          <StatCard label="Room requests to review" value={pending.data?.length} icon={ClockIcon} href="/rooms" />
        )}
        {can("users.read") && <StatCard label="User accounts" value={users.data?.total} icon={UserCogIcon} href="/users" />}
        {can("branches.read") && <StatCard label="Branches" value={branches.data?.length} icon={MapIcon} href="/branches" />}
        {can("audit.read") && <StatCard label="Audit entries" value={audit.data?.total} icon={HistoryIcon} href="/audit" />}
      </Stagger>

      {can("attendance.read") && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance trend</CardTitle>
            <CardDescription>Weekly worship attendance over the last 8 weeks.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceTrend stats={attendance.data} />
          </CardContent>
        </Card>
      )}

      {can("rooms.read") && <RoomUsageCard />}

      {can("events.read") && (
        <Card>
          <CardHeader>
            <CardTitle>Coming up</CardTitle>
            <CardDescription>The next few events across your branches.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {upcoming.isPending && <Skeleton className="h-16 w-full" />}
            {upcoming.data?.length === 0 && <p className="text-muted-foreground text-sm">Nothing scheduled yet.</p>}
            {upcoming.data?.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.1 + i * 0.05 }}
              >
                <Link href={`/events/${e.id}`} className="hover:bg-muted flex items-start gap-3 rounded-md p-2 transition-colors">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", EVENT_CATEGORY_META[e.category].dot)} />
                  <span className="flex-1 text-sm">
                    <span className="font-medium">{e.title}</span>
                    <span className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                      <span>{formatDayLong(e.startsAt)}, {formatTimeRange(e.startsAt, e.endsAt)}</span>
                      {e.room && (
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="size-3" />
                          {e.room.name}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {can("members.read") && (
        <Card>
          <CardHeader>
            <CardTitle>People by status</CardTitle>
            <CardDescription>Visitors to members: where everyone is on the journey.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {MEMBER_STATUSES.map((status, i) => {
              const count = stats?.byStatus[status] ?? 0;
              const pct = stats && stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={status} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
                  <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                    <motion.div
                      className={`h-full rounded-full ${STATUS_BAR[status]}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.1 + i * 0.08 }}
                    />
                  </div>
                  <span className="text-right font-medium">
                    <AnimatedNumber value={count} />
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </>
  );
}
