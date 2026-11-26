"use client";

import Link from "next/link";
import { StaggerItem, Stagger } from "@/components/motion";
import { StatusGlyph } from "@/components/status-glyph";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { roomUsageToday } from "@/features/reports/format";
import { formatTimeRange } from "@/lib/datetime";
import { useRooms } from "./api";

/** Dashboard card: rooms with approved bookings today, rooms in use right now first. */
export function RoomUsageCard() {
  const rooms = useRooms({ pageSize: 100 });
  const usage = rooms.data ? roomUsageToday(rooms.data.items, new Date()) : null;
  const inUse = usage?.filter((u) => u.inUse).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rooms today</CardTitle>
        <CardDescription>
          {usage ? (
            <>
              <span className="font-data">{usage.length}</span> booked today,{" "}
              <span className="font-data">{inUse}</span> in use now.
            </>
          ) : (
            "Approved bookings for today."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!usage && <Skeleton className="h-16 w-full" />}
        {usage?.length === 0 && <p className="text-muted-foreground text-sm">No rooms are booked today.</p>}
        {usage && usage.length > 0 && (
          <Stagger className="divide-border flex flex-col divide-y">
            {usage.map((room) => (
              <StaggerItem key={room.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 text-sm">
                <Link href={`/rooms/${room.id}`} className="w-40 shrink-0 font-medium underline-offset-4 hover:underline">
                  {room.name}
                  {room.inUse && <span className="micro-label ml-2">in use</span>}
                </Link>
                <ul className="flex flex-1 flex-wrap gap-x-4 gap-y-1">
                  {room.bookings.map((b) => (
                    <li key={b.id} className="text-muted-foreground flex items-center gap-1.5">
                      <StatusGlyph state={b.state} pulse={b.state === "active"} />
                      <span className="font-data text-foreground">{formatTimeRange(b.startsAt, b.endsAt)}</span>
                      <span className="truncate">{b.purpose}</span>
                    </li>
                  ))}
                </ul>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </CardContent>
    </Card>
  );
}
