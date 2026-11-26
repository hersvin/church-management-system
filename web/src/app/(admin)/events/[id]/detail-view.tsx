"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  CircleXIcon,
  ClockIcon,
  HeartIcon,
  MapPinIcon,
  PencilIcon,
  RepeatIcon,
  UserPlusIcon,
  XIcon,
} from "@/components/icons";
import { EASE_OUT, FadeIn, MotionRow, MotionTableBody } from "@/components/motion";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/features/admin/queries";
import { CheckInBoard } from "@/features/attendance/check-in-board";
import { useCancelEvent, useCancelRegistration, useEvent, useRegistrations } from "@/features/events/api";
import { EventForm } from "@/features/events/event-form";
import { BOOKING_STATUS_META, EVENT_CATEGORY_META } from "@/features/events/format";
import { RegistrationForm } from "@/features/events/registration-form";
import { fullName } from "@/features/members/format";
import { formatDayLong, formatDateTime, formatTimeRange } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

export function EventDetailView() {
  const { id } = useParams<{ id: string }>();
  const can = useSessionStore((s) => s.can);
  const canManage = can("events.manage");
  const event = useEvent(id);
  const registrations = useRegistrations(id, Boolean(event.data?.registrationRequired));
  const branches = useBranches(can("branches.read"));
  const cancel = useCancelEvent(id);
  const cancelRegistration = useCancelRegistration(id);
  const [editing, setEditing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [scope, setScope] = useState<"THIS" | "FOLLOWING">("THIS");
  const [reason, setReason] = useState("");

  if (event.isError) {
    return (
      <FadeIn className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">{event.error.message}</p>
        <Link href="/events" className={buttonVariants({ variant: "outline" })}>
          Back to events
        </Link>
      </FadeIn>
    );
  }
  if (!event.data) return <Skeleton className="h-40 w-full" />;

  const e = event.data;
  const meta = EVENT_CATEGORY_META[e.category];
  const cancelled = e.status === "CANCELLED";
  const isPast = new Date(e.endsAt) < new Date();
  const registered = registrations.data?.length ?? e._count.registrations;
  const fill = e.capacity ? Math.min(100, (registered / e.capacity) * 100) : 0;
  const upcomingInSeries = e.series.filter((s) => new Date(s.startsAt) >= new Date(e.startsAt));
  const full = Boolean(e.capacity && registered >= e.capacity);

  return (
    <>
      <Link href="/events" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" />
        Events
      </Link>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", meta.chip)}>{meta.label}</span>
            {cancelled && <Badge variant="destructive">Cancelled</Badge>}
            {e.seriesId && (
              <Badge variant="outline" className="gap-1">
                <RepeatIcon className="size-3" />
                Series
              </Badge>
            )}
          </div>
          <h1 className={cn("mt-2 text-2xl font-semibold", cancelled && "text-muted-foreground line-through")}>{e.title}</h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              {formatDayLong(e.startsAt)}, {formatTimeRange(e.startsAt, e.endsAt)}
            </span>
            {e.room && (
              <Link href={`/rooms/${e.room.id}`} className="flex items-center gap-1 hover:underline">
                <MapPinIcon className="size-3.5" />
                {e.room.name}
              </Link>
            )}
            {e.ministry && (
              <Link href={`/ministries/${e.ministry.id}`} className="flex items-center gap-1 hover:underline">
                <HeartIcon className="size-3.5" />
                {e.ministry.name}
              </Link>
            )}
            <span>{e.branch.name}</span>
          </div>
          {e.booking && !cancelled && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-2">
              <Badge variant={BOOKING_STATUS_META[e.booking.status].variant}>{BOOKING_STATUS_META[e.booking.status].label}</Badge>
              {e.booking.decisionNote && <span className="text-muted-foreground ml-2 text-xs">{e.booking.decisionNote}</span>}
            </motion.div>
          )}
          {cancelled && e.cancelReason && <p className="text-muted-foreground mt-2 text-sm">Reason: {e.cancelReason}</p>}
        </div>
        {canManage && !cancelled && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit
            </Button>
            <Button variant="outline" onClick={() => setCancelling(true)}>
              <CircleXIcon />
              Cancel event
            </Button>
          </div>
        )}
      </div>

      {e.description && <p className="max-w-3xl text-sm whitespace-pre-wrap">{e.description}</p>}

      <div className="grid gap-4 xl:grid-cols-3">
        {e.registrationRequired && (
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div className="flex-1">
                <CardTitle>Registrations</CardTitle>
                <CardDescription>
                  {registered} registered{e.capacity ? ` of ${e.capacity}` : ""}
                  {full && " · Full"}
                </CardDescription>
                {e.capacity && (
                  <div className="bg-muted mt-2 h-2 max-w-sm overflow-hidden rounded-full">
                    <motion.div
                      className={cn("h-full rounded-full", full ? "bg-destructive" : "bg-primary")}
                      initial={{ width: 0 }}
                      animate={{ width: `${fill}%` }}
                      transition={{ duration: 0.8, ease: EASE_OUT }}
                    />
                  </div>
                )}
              </div>
              {canManage && !cancelled && !isPast && (
                <Button size="sm" disabled={full} onClick={() => setRegistering(true)}>
                  <UserPlusIcon />
                  Register someone
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-0">
              {registrations.data?.length === 0 ? (
                <p className="text-muted-foreground px-6 text-sm">No one has registered yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="hidden md:table-cell">Registered</TableHead>
                      {canManage && <TableHead className="pr-6 text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <MotionTableBody>
                    {registrations.data?.map((r) => (
                      <MotionRow key={r.id} layout>
                        <TableCell className="pl-6 font-medium">
                          {r.member ? (
                            <Link href={`/members/${r.member.id}`} className="hover:underline">
                              {fullName(r.member)}
                            </Link>
                          ) : (
                            <>
                              {r.guestName} <Badge variant="outline">Guest</Badge>
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.member?.email ?? r.member?.phone ?? r.guestEmail ?? r.guestPhone ?? "None"}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{formatDateTime(r.createdAt)}</TableCell>
                        {canManage && (
                          <TableCell className="pr-6 text-right">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Cancel registration for ${r.member ? fullName(r.member) : r.guestName}`}
                              onClick={() =>
                                cancelRegistration.mutate(r.id, {
                                  onSuccess: () => toast.success("Registration cancelled"),
                                  onError: (err) => toast.error(err.message),
                                })
                              }
                            >
                              <XIcon />
                            </Button>
                          </TableCell>
                        )}
                      </MotionRow>
                    ))}
                  </MotionTableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {e.seriesId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RepeatIcon className="size-4" />
                In this series
              </CardTitle>
              <CardDescription>{e.series.length} scheduled dates</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {upcomingInSeries.slice(0, 8).map((s) => (
                <Link
                  key={s.id}
                  href={`/events/${s.id}`}
                  className={cn("hover:bg-muted rounded-md px-2 py-1 text-sm transition-colors", s.id === e.id && "bg-muted font-medium")}
                >
                  {formatDayLong(s.startsAt)}
                </Link>
              ))}
              {upcomingInSeries.length > 8 && (
                <p className="text-muted-foreground px-2 text-xs">and {upcomingInSeries.length - 8} more</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {can("attendance.read") && !cancelled && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Check-in</h2>
            <p className="text-muted-foreground text-sm">
              {e.registrationRequired ? "Registered people are marked; walk-ins are welcome." : "Record who came, including kids with a guardian."}
            </p>
          </div>
          <CheckInBoard
            target={{ type: "event", id: e.id }}
            branchId={e.branchId}
            gathering={e.title}
            canManage={can("attendance.manage")}
            canOverride={can("attendance.override")}
          />
        </section>
      )}

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Edit {e.title}</SheetTitle>
            <SheetDescription>Changes apply to this date only. Moving the time or room re-checks the booking.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {editing && (
              <EventForm
                event={e}
                branches={branches.data ?? [e.branch]}
                canBookRooms={can("rooms.book")}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  toast.success("Event updated");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={registering} onOpenChange={setRegistering}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Register for {e.title}</SheetTitle>
            <SheetDescription>Add a member of {e.branch.name} or a guest.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {registering && (
              <RegistrationForm
                eventId={e.id}
                branchId={e.branchId}
                excludeMemberIds={(registrations.data ?? []).flatMap((r) => (r.memberId ? [r.memberId] : []))}
                onDone={(saved) => {
                  setRegistering(false);
                  if (saved) toast.success("Registered");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={cancelling} onOpenChange={setCancelling}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {e.title}?</AlertDialogTitle>
            <AlertDialogDescription>Its room booking is released. Registrations stay on record.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3">
            {e.seriesId && (
              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="sr-only">Which dates</legend>
                {(
                  [
                    ["THIS", "Only this date"],
                    ["FOLLOWING", `This and following dates (${upcomingInSeries.length})`],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2">
                    <input type="radio" name="scope" className="accent-primary" checked={scope === value} onChange={() => setScope(value)} />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input id="reason" value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Typhoon warning" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                cancel.mutate(
                  { scope, ...(reason.trim() ? { reason } : {}) },
                  {
                    onSuccess: (r) => {
                      setCancelling(false);
                      toast.success(r.cancelled > 1 ? `${r.cancelled} dates cancelled` : "Event cancelled");
                    },
                    onError: (err) => toast.error(err.message),
                  },
                )
              }
            >
              Cancel event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
