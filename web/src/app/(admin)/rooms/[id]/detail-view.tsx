"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArchiveIcon, ArrowLeftIcon, CalendarIcon, MapPinIcon, PencilIcon, TagIcon, UsersIcon, XIcon } from "@/components/icons";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranches } from "@/features/admin/queries";
import { BOOKING_STATUS_META } from "@/features/events/format";
import { useArchiveRoom, useBookings, useCancelBooking, useRoom } from "@/features/rooms/api";
import { formatHourlyRate } from "@/features/rooms/format";
import { BookingForm } from "@/features/rooms/booking-form";
import { RoomForm } from "@/features/rooms/room-form";
import { formatDayLong, formatTimeRange, groupByDay } from "@/lib/datetime";
import { useSessionStore } from "@/stores/session-store";

const DAYS_AHEAD = 14;

export function RoomDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const can = useSessionStore((s) => s.can);
  const me = useSessionStore((s) => s.user);
  const room = useRoom(id);
  const branches = useBranches(can("branches.read"));
  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + DAYS_AHEAD);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const bookings = useBookings({ ...range, roomId: id });
  const cancelBooking = useCancelBooking();
  const archive = useArchiveRoom();
  const [editing, setEditing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  if (room.isError) {
    return (
      <FadeIn className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">{room.error.message}</p>
        <Link href="/rooms" className={buttonVariants({ variant: "outline" })}>
          Back to rooms
        </Link>
      </FadeIn>
    );
  }
  if (!room.data) return <Skeleton className="h-40 w-full" />;
  const r = room.data;
  const days = groupByDay(bookings.data ?? []);

  return (
    <>
      <Link href="/rooms" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" />
        Rooms
      </Link>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{r.name}</h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{r.branch.name}</span>
            {r.capacity && (
              <span className="flex items-center gap-1">
                <UsersIcon className="size-3.5" />
                {r.capacity} seats
              </span>
            )}
            {r.location && (
              <span className="flex items-center gap-1">
                <MapPinIcon className="size-3.5" />
                {r.location}
              </span>
            )}
            <span className="flex items-center gap-1 font-data">
              <TagIcon className="size-3.5" />
              {formatHourlyRate(r.hourlyRate)}
            </span>
            {!r.isActive && <Badge variant="outline">Inactive</Badge>}
          </div>
          {r.features.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {r.features.map((f) => (
                <Badge key={f} variant="secondary">
                  {f}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {can("rooms.book") && r.isActive && (
            <Button onClick={() => setRequesting(true)}>
              <CalendarIcon />
              Book this room
            </Button>
          )}
          {can("rooms.manage") && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <PencilIcon />
                Edit
              </Button>
              <Button variant="outline" onClick={() => setArchiving(true)}>
                <ArchiveIcon />
                Archive
              </Button>
            </>
          )}
        </div>
      </div>
      {r.description && <p className="text-muted-foreground max-w-3xl text-sm">{r.description}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Next {DAYS_AHEAD} days</CardTitle>
          <CardDescription>Approved and pending bookings for this room.</CardDescription>
        </CardHeader>
        <CardContent>
          {bookings.data && bookings.data.length === 0 && <p className="text-muted-foreground text-sm">Nothing booked. The room is free.</p>}
          <Stagger key={bookings.data ? "y" : "n"} className="flex flex-col gap-4">
            {[...days.entries()].map(([day, items]) => (
              <StaggerItem key={day} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{formatDayLong(items[0].startsAt)}</h3>
                <ul className="flex flex-col gap-1.5">
                  {items.map((b) => {
                    const meta = BOOKING_STATUS_META[b.status];
                    const canCancel = !b.event && (b.requestedById === me?.id || can("rooms.manage"));
                    return (
                      <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm">
                        <span className="text-muted-foreground w-40 shrink-0 font-data">{formatTimeRange(b.startsAt, b.endsAt)}</span>
                        <span className="flex-1 font-medium">
                          {b.event ? (
                            <Link href={`/events/${b.event.id}`} className="hover:underline">
                              {b.event.title}
                            </Link>
                          ) : (
                            b.purpose
                          )}
                        </span>
                        {b.status === "PENDING" && <Badge variant={meta.variant}>Pending</Badge>}
                        {canCancel && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Cancel booking ${b.purpose}`}
                            onClick={() =>
                              cancelBooking.mutate(b.id, {
                                onSuccess: () => toast.success("Booking cancelled"),
                                onError: (e) => toast.error(e.message),
                              })
                            }
                          >
                            <XIcon />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </StaggerItem>
            ))}
          </Stagger>
        </CardContent>
      </Card>

      <Sheet open={requesting} onOpenChange={setRequesting}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Book {r.name}</SheetTitle>
            <SheetDescription>
              {can("rooms.manage") ? "Your booking is confirmed right away." : "A room manager will approve or decline it."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {requesting && (
              <BookingForm
                rooms={[r]}
                defaultRoomId={r.id}
                onDone={(b) => {
                  setRequesting(false);
                  if (b) toast.success(b.status === "APPROVED" ? "Room booked" : "Request sent for approval");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit {r.name}</SheetTitle>
            <SheetDescription>Only changed fields are saved and logged.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {editing && (
              <RoomForm
                room={r}
                branches={branches.data ?? [r.branch]}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  toast.success("Room updated");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={archiving} onOpenChange={setArchiving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {r.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Pending requests are cancelled. Rooms with upcoming approved bookings cannot be archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                archive.mutate(r.id, {
                  onSuccess: () => {
                    toast.success("Room archived");
                    router.push("/rooms");
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
