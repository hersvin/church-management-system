"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { CalendarIcon, MapPinIcon, PlusIcon, SearchIcon, TagIcon, UsersIcon } from "@/components/icons";
import { Stagger, StaggerItem } from "@/components/motion";
import { StatusGlyph } from "@/components/status-glyph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBranches } from "@/features/admin/queries";
import { useRooms, type Room } from "@/features/rooms/api";
import { formatHourlyRate } from "@/features/rooms/format";
import { BookingForm } from "@/features/rooms/booking-form";
import { PendingRequests } from "@/features/rooms/pending-requests";
import { RoomForm } from "@/features/rooms/room-form";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

function roomStatus(room: Room) {
  const now = Date.now();
  const today = room.bookings ?? [];
  const current = today.find((b) => new Date(b.startsAt).getTime() <= now && new Date(b.endsAt).getTime() > now);
  if (current) return { busy: true, text: `In use: ${current.purpose} until ${formatTime(current.endsAt)}` };
  const next = today.find((b) => new Date(b.startsAt).getTime() > now);
  return { busy: false, text: next ? `Free until ${formatTime(next.startsAt)} (${next.purpose})` : "Free for the rest of today" };
}

export function RoomsView() {
  const can = useSessionStore((s) => s.can);
  const me = useSessionStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [booking, setBooking] = useState(false);
  const debounced = useDebouncedValue(search);
  const rooms = useRooms({ search: debounced, pageSize: 100 });
  const branches = useBranches(can("branches.read"));
  const activeRooms = rooms.data?.items.filter((r) => r.isActive) ?? [];

  return (
    <>
      <PageHeader
        title="Rooms"
        description="Spaces you can book for services, classes, and meetings."
        actions={
          <div className="flex gap-2">
            {can("rooms.book") && (
              <Button variant="outline" onClick={() => setBooking(true)} disabled={activeRooms.length === 0}>
                <CalendarIcon />
                Request booking
              </Button>
            )}
            {can("rooms.manage") && (
              <Button onClick={() => setCreating(true)}>
                <PlusIcon />
                New room
              </Button>
            )}
          </div>
        }
      />

      <PendingRequests canDecide={can("rooms.manage")} />

      <div className="relative sm:max-w-xs">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input aria-label="Search rooms" placeholder="Search rooms" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {rooms.data?.items.length === 0 && <p className="text-muted-foreground py-10 text-center text-sm">No rooms found.</p>}

      <Stagger key={`${debounced}-${rooms.data ? "y" : "n"}`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rooms.data?.items.map((room) => {
          const status = roomStatus(room);
          return (
            <StaggerItem key={room.id} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
              <Link href={`/rooms/${room.id}`} className="block h-full rounded-xl focus-visible:outline-2">
                <Card className={cn("h-full transition-[box-shadow] hover:ring-foreground/35", !room.isActive && "opacity-60")}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>{room.name}</CardTitle>
                      {room.isActive ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <StatusGlyph state={status.busy ? "active" : "done"} pulse={status.busy} />
                          {status.busy ? "In use" : "Free"}
                        </span>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                    <CardDescription>{status.text}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {room.capacity && (
                        <span className="flex items-center gap-1">
                          <UsersIcon className="size-3.5" />
                          {room.capacity} seats
                        </span>
                      )}
                      {room.location && (
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="size-3.5" />
                          {room.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-data">
                        <TagIcon className="size-3.5" />
                        {formatHourlyRate(room.hourlyRate)}
                      </span>
                      <span>{room.branch.name}</span>
                    </div>
                    {room.features.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {room.features.map((f) => (
                          <Badge key={f} variant="secondary" className="text-[10px]">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New room</SheetTitle>
            <SheetDescription>People can book it once it exists.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {creating && (
              <RoomForm
                branches={branches.data ?? []}
                defaultBranchId={me?.branchId ?? undefined}
                onCancel={() => setCreating(false)}
                onSaved={(r) => {
                  setCreating(false);
                  toast.success(`${r.name} created`);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={booking} onOpenChange={setBooking}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Request a booking</SheetTitle>
            <SheetDescription>
              {can("rooms.manage") ? "As a room manager, your booking is confirmed right away." : "A room manager will approve or decline it."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {booking && (
              <BookingForm
                rooms={activeRooms}
                onDone={(b) => {
                  setBooking(false);
                  if (b) toast.success(b.status === "APPROVED" ? "Room booked" : "Request sent for approval");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
