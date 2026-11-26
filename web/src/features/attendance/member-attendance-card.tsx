"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayLong } from "@/lib/datetime";
import { useMemberAttendance } from "./api";

export function MemberAttendanceCard({ memberId }: { memberId: string }) {
  const attendance = useMemberAttendance(memberId);
  const data = attendance.data;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Attendance</CardTitle>
        <CardDescription>
          {data ? `${data.recentCount} check-in${data.recentCount === 1 ? "" : "s"} in the last ${data.recentWeeks} weeks.` : "Recent services and events."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {attendance.isPending && <Skeleton className="h-10 w-full" />}
        {data?.items.length === 0 && <p className="text-muted-foreground text-sm">No check-ins yet.</p>}
        {data?.items.slice(0, 6).map((c) => {
          const href = c.service ? `/attendance/services/${c.service.id}` : `/events/${c.event?.id}`;
          const name = c.service?.name ?? c.event?.title ?? "Gathering";
          return (
            <Link key={c.id} href={href} className="hover:bg-muted flex items-center gap-3 rounded-md p-2 text-sm transition-colors">
              <span className="flex-1">
                <span className="font-medium">{name}</span>
                <span className="text-muted-foreground block text-xs">{formatDayLong(c.service?.startsAt ?? c.event?.startsAt ?? c.checkedInAt)}</span>
              </span>
              {c.kind === "CHILD" && <Badge variant="secondary">Kids</Badge>}
              {c.event && <Badge variant="outline">Event</Badge>}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
