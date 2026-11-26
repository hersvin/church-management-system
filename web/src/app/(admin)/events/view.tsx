"use client";

import { EVENT_CATEGORIES, type EventCategory } from "@cms/shared";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, ImageIcon, MapPinIcon, PlusIcon } from "@/components/icons";
import { EASE_OUT } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBranches } from "@/features/admin/queries";
import { useEvents, type ChurchEvent } from "@/features/events/api";
import { EventForm } from "@/features/events/event-form";
import { EVENT_CATEGORY_META } from "@/features/events/format";
import { dayKey, formatDayLong, formatTime, formatTimeRange, groupByDay, monthGrid, toLocalInput } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3;

function EventChip({ event }: { event: ChurchEvent }) {
  const meta = EVENT_CATEGORY_META[event.category];
  return (
    <Link
      href={`/events/${event.id}`}
      onClick={(e) => e.stopPropagation()}
      className={cn("block truncate rounded px-1.5 py-0.5 text-[11px] leading-tight font-medium transition-opacity hover:opacity-80", meta.chip)}
      title={`${event.title}, ${formatTimeRange(event.startsAt, event.endsAt)}`}
    >
      <span className="font-data opacity-70">{formatTime(event.startsAt).replace(":00", "")}</span> {event.title}
    </Link>
  );
}

function EventRow({ event }: { event: ChurchEvent }) {
  const meta = EVENT_CATEGORY_META[event.category];
  return (
    <Link href={`/events/${event.id}`} className="hover:bg-muted flex items-start gap-3 rounded-md p-2 transition-colors">
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", meta.dot)} />
      <span className="flex-1 text-sm">
        <span className="font-medium">{event.title}</span>
        <span className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
          <span className="flex items-center gap-1">
            <ClockIcon className="size-3" />
            {formatTimeRange(event.startsAt, event.endsAt)}
          </span>
          {event.room && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="size-3" />
              {event.room.name}
            </span>
          )}
        </span>
      </span>
      {event.booking?.status === "PENDING" && <Badge variant="secondary">Room pending</Badge>}
    </Link>
  );
}

export function EventsView() {
  const router = useRouter();
  const can = useSessionStore((s) => s.can);
  const me = useSessionStore((s) => s.user);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [direction, setDirection] = useState(0);
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const [category, setCategory] = useState<EventCategory | undefined>();
  const [creating, setCreating] = useState(false);
  const branches = useBranches(can("branches.read"));

  const grid = useMemo(() => monthGrid(month), [month]);
  const range = { from: grid[0].date.toISOString(), to: new Date(grid[41].date.getTime() + 86400000).toISOString() };
  const events = useEvents({ ...range, category });
  const byDay = useMemo(() => groupByDay(events.data ?? []), [events.data]);
  const selectedEvents = byDay.get(selected) ?? [];

  const shift = (delta: number) => {
    setDirection(delta);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };
  const goToday = () => {
    const now = new Date();
    setDirection(0);
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(dayKey(now));
  };

  const selectedDate = new Date(`${selected}T09:00`);
  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <>
      <PageHeader
        title="Events"
        description="Services, meetings, classes, and gatherings."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/events/design" className={buttonVariants({ variant: "outline" })}>
              <ImageIcon />
              Design calendar image
            </Link>
            {can("events.manage") && (
              <Button onClick={() => setCreating(true)}>
                <PlusIcon />
                New event
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="outline" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button size="icon-sm" variant="outline" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRightIcon />
          </Button>
          <Button size="sm" variant="ghost" onClick={goToday}>
            Today
          </Button>
        </div>
        <h2 className="min-w-40 text-lg font-semibold" aria-live="polite">
          {monthLabel}
        </h2>
        <div className="ml-auto flex flex-wrap gap-1">
          {[undefined, ...EVENT_CATEGORIES].map((c) => {
            const active = c === category;
            return (
              <button
                key={c ?? "all"}
                onClick={() => setCategory(c)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  active ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c && <span className={cn("size-1.5 rounded-full", EVENT_CATEGORY_META[c].dot)} />}
                {c ? EVENT_CATEGORY_META[c].label : "All"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        {/* Month grid (tablet and up) */}
        <Card className="hidden overflow-hidden p-0 md:block">
          <div className="bg-muted/50 grid grid-cols-7 border-b text-xs font-medium">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-muted-foreground px-2 py-1.5">
                {d}
              </div>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={month.toISOString()}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className={cn("grid grid-cols-7 transition-opacity", events.isPlaceholderData && "opacity-60")}
            >
              {grid.map(({ date, inMonth, isToday }) => {
                const key = dayKey(date);
                const items = byDay.get(key) ?? [];
                const isSelected = key === selected;
                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    aria-label={`${formatDayLong(date)}, ${items.length} events`}
                    onClick={() => setSelected(key)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelected(key)}
                    className={cn(
                      "relative flex min-h-24 cursor-pointer flex-col gap-1 border-r border-b p-1.5 text-left transition-colors [&:nth-child(7n)]:border-r-0",
                      !inMonth && "bg-muted/30 text-muted-foreground",
                      "hover:bg-muted/50",
                    )}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="calendar-selected"
                        className="ring-primary pointer-events-none absolute inset-0.5 rounded-md ring-2"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-data",
                        isToday && "bg-primary text-primary-foreground font-semibold",
                      )}
                    >
                      {date.getDate()}
                    </span>
                    {items.slice(0, MAX_CHIPS).map((e) => (
                      <EventChip key={e.id} event={e} />
                    ))}
                    {items.length > MAX_CHIPS && (
                      <span className="text-muted-foreground px-1.5 text-[11px]">+{items.length - MAX_CHIPS} more</span>
                    )}
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </Card>

        {/* Selected day (desktop) and month agenda (mobile) */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">
              <span className="hidden md:inline">{formatDayLong(selectedDate)}</span>
              <span className="md:hidden">{monthLabel}</span>
            </CardTitle>
            <CardDescription className="hidden md:block">
              {selectedEvents.length === 0 ? "Nothing scheduled." : `${selectedEvents.length} scheduled`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <div className="hidden md:block">
              <AnimatePresence mode="popLayout" initial={false}>
                {selectedEvents.map((e, i) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                    exit={{ opacity: 0 }}
                  >
                    <EventRow event={e} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {can("events.manage") && (
                <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setCreating(true)}>
                  <PlusIcon />
                  Add on this day
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-3 md:hidden">
              {[...byDay.entries()]
                .filter(([key]) => key.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`))
                .map(([key, items]) => (
                  <div key={key}>
                    <p className="text-muted-foreground mb-1 text-xs font-semibold">{formatDayLong(items[0].startsAt)}</p>
                    {items.map((e) => (
                      <EventRow key={e.id} event={e} />
                    ))}
                  </div>
                ))}
              {events.data?.length === 0 && <p className="text-muted-foreground text-sm">Nothing scheduled this month.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>New event</SheetTitle>
            <SheetDescription>Pick a room to book it at the same time. Repeats create one entry per date.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {creating && (
              <EventForm
                branches={branches.data ?? (me?.branchId ? [{ id: me.branchId, name: "My branch", code: "" }] : [])}
                defaultBranchId={me?.branchId ?? undefined}
                canBookRooms={can("rooms.book")}
                defaultStart={toLocalInput(selectedDate)}
                defaultEnd={toLocalInput(new Date(selectedDate.getTime() + 60 * 60 * 1000))}
                onCancel={() => setCreating(false)}
                onSaved={({ id, count }) => {
                  setCreating(false);
                  toast.success(count > 1 ? `${count} dates created` : "Event created");
                  router.push(`/events/${id}`);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
