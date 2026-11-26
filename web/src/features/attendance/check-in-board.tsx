"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { type AppIcon, InfoIcon, LockIcon, LogOutIcon, PrinterIcon, SearchIcon, ShieldCheckIcon, SparklesIcon, UsersIcon, XIcon } from "@/components/icons";
import { AnimatedNumber, EASE_OUT, MotionRow, MotionTableBody, Stagger, StaggerItem } from "@/components/motion";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTime } from "@/lib/datetime";
import { StatusGlyph } from "@/components/status-glyph";
import { cn } from "@/lib/utils";
import { useCheckIns, useUndoCheckIn, type CheckInRow, type CheckInTarget } from "./api";
import { CheckInForm } from "./check-in-form";
import { CheckOutForm } from "./checkout-form";
import { CHECK_IN_FILTERS, checkInName, filterCheckIns, formatPickupCode, type CheckInFilter } from "./format";
import { printTag } from "./print-tag";

export interface CheckInBoardProps {
  target: CheckInTarget;
  branchId: string;
  /** Name printed on pickup tags, for example the service name. */
  gathering: string;
  canManage: boolean;
  canOverride: boolean;
}

function Tile({ label, value, icon: Icon, tone }: { label: string; value: number | undefined; icon: AppIcon; tone?: string }) {
  return (
    <StaggerItem>
      <Card size="sm" className="h-full">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <Icon className={cn("size-4", tone)} />
            {label}
          </CardDescription>
          <CardTitle className="text-2xl">{value === undefined ? <Skeleton className="h-7 w-10" /> : <AnimatedNumber value={value} />}</CardTitle>
        </CardHeader>
      </Card>
    </StaggerItem>
  );
}

/** Live check-in station for a service or an event: check people in, release children, and see who is here. */
export function CheckInBoard({ target, branchId, gathering, canManage, canOverride }: CheckInBoardProps) {
  const list = useCheckIns(target);
  const undo = useUndoCheckIn();
  const [filter, setFilter] = useState<CheckInFilter>("all");
  const [search, setSearch] = useState("");
  const [issued, setIssued] = useState<{ child: string; code: string; careNote: string | null } | null>(null);
  const [releasing, setReleasing] = useState<CheckInRow | null>(null);
  const [removing, setRemoving] = useState<CheckInRow | null>(null);

  const summary = list.data?.summary;
  const items = filterCheckIns(list.data?.items ?? [], filter, search);
  const checkedInIds = (list.data?.items ?? []).flatMap((i) => (i.memberId ? [i.memberId] : []));

  return (
    <div className="flex flex-col gap-4">
      <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label="Checked in" value={summary?.total} icon={UsersIcon} />
        <Tile label="Members" value={summary?.members} icon={UsersIcon} />
        <Tile label="Guests" value={summary?.guests} icon={SparklesIcon} />
        <Tile label="Kids" value={summary?.children} icon={ShieldCheckIcon} />
        <Tile label="Kids in care" value={summary?.childrenInCare} icon={ShieldCheckIcon} />
        {list.data?.registered !== null && list.data?.registered !== undefined && (
          <Tile label="Registered" value={list.data.registered} icon={InfoIcon} />
        )}
      </Stagger>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,24rem)_1fr]">
        {canManage && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Check in</CardTitle>
              <CardDescription>Members, first-time guests, and kids with a guardian.</CardDescription>
            </CardHeader>
            <CardContent>
              <CheckInForm
                target={target}
                branchId={branchId}
                excludeIds={checkedInIds}
                onCheckedIn={(result) => {
                  const name = checkInName(result);
                  if (result.kind === "CHILD" && result.pickupCode) {
                    setIssued({ child: name, code: result.pickupCode, careNote: result.careNote });
                  } else {
                    toast.success(`${name} checked in`);
                  }
                }}
              />
            </CardContent>
          </Card>
        )}

        <Card className={cn(!canManage && "xl:col-span-2")}>
          <CardHeader className="gap-3">
            <CardTitle>Who is here</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-1">
                {CHECK_IN_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      filter === f.value ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="relative sm:ml-auto sm:w-56">
                <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input aria-label="Search check-ins" className="pl-8" placeholder="Search names" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {list.isPending && <Skeleton className="mx-4 h-24" />}
            {list.data && items.length === 0 && (
              <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                {list.data.items.length === 0 ? "No one has checked in yet." : "No one matches."}
              </p>
            )}
            {items.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Name</TableHead>
                      <TableHead>Arrived</TableHead>
                      <TableHead>Status</TableHead>
                      {canManage && <TableHead className="pr-4 text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <MotionTableBody>
                    {items.map((c) => (
                      <MotionRow key={c.id}>
                        <TableCell className="pl-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{checkInName(c)}</span>
                            {c.kind === "CHILD" && <Badge variant="secondary">Kid</Badge>}
                            {c.kind === "ATTENDEE" && !c.member && <Badge variant="outline">Guest</Badge>}
                            {c.registered === true && <Badge variant="outline">Registered</Badge>}
                            {c.registered === false && <Badge variant="outline">Walk-in</Badge>}
                          </div>
                          {c.careNote && (
                            <span className="flex items-center gap-1 text-xs font-medium">
                              <InfoIcon className="size-3" />
                              {c.careNote}
                            </span>
                          )}
                          {c.kind === "CHILD" && (
                            <span className="text-muted-foreground block text-xs">
                              Guardian: {c.guardianMember ? `${c.guardianMember.firstName} ${c.guardianMember.lastName}` : c.guardianName}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatTime(c.checkedInAt)}</TableCell>
                        <TableCell className="text-sm">
                          <ChildStatus row={c} />
                        </TableCell>
                        {canManage && (
                          <TableCell className="pr-4 text-right">
                            <div className="flex justify-end gap-1">
                              {c.kind === "CHILD" && !c.checkedOutAt && (
                                <Button size="sm" variant="outline" onClick={() => setReleasing(c)}>
                                  <LogOutIcon />
                                  Check out
                                </Button>
                              )}
                              {!(c.kind === "CHILD" && c.checkedOutAt) && (
                                <Button size="icon-sm" variant="ghost" aria-label={`Remove check-in for ${checkInName(c)}`} onClick={() => setRemoving(c)}>
                                  <XIcon />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </MotionRow>
                    ))}
                  </MotionTableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(issued)} onOpenChange={(open) => !open && setIssued(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{issued?.child} is checked in</AlertDialogTitle>
            <AlertDialogDescription>
              Give the guardian this pickup code. It is shown only once; the child is released only with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AnimatePresence>
            {issued && (
              <motion.p
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
                aria-label={`Pickup code ${issued.code.split("").join(" ")}`}
                className="bg-muted rounded-xl py-4 text-center font-mono text-4xl font-semibold tracking-[0.3em]"
              >
                {formatPickupCode(issued.code)}
              </motion.p>
            )}
          </AnimatePresence>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => issued && printTag({ ...issued, gathering })}>
              <PrinterIcon />
              Print tags
            </Button>
            <AlertDialogAction onClick={() => setIssued(null)}>Done</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={Boolean(releasing)} onOpenChange={(open) => !open && setReleasing(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Check out {releasing ? checkInName(releasing) : ""}</SheetTitle>
            <SheetDescription>Match the code on the guardian stub and confirm who is collecting.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {releasing && (
              <CheckOutForm
                checkIn={releasing}
                canOverride={canOverride}
                onDone={() => {
                  toast.success(`${checkInName(releasing)} has been collected`);
                  setReleasing(null);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this check-in?</AlertDialogTitle>
            <AlertDialogDescription>
              Use this only for a mistake. {removing ? checkInName(removing) : ""} will no longer count as present.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                removing &&
                undo.mutate(removing.id, {
                  onSuccess: () => {
                    toast.success("Check-in removed");
                    setRemoving(null);
                  },
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChildStatus({ row }: { row: CheckInRow }) {
  if (row.kind !== "CHILD") return <span className="text-muted-foreground">Present</span>;
  if (row.checkedOutAt) {
    const by = row.pickedUpByMember ? `${row.pickedUpByMember.firstName} ${row.pickedUpByMember.lastName}` : row.pickedUpByName;
    return (
      <span className="text-muted-foreground">
        Collected {formatTime(row.checkedOutAt)}
        {by ? ` by ${by}` : ""}
        {row.overrideReason && (
          <Badge variant="outline" className="ml-1">
            Override
          </Badge>
        )}
      </span>
    );
  }
  if (row.locked) {
    return (
      <span className="text-destructive flex items-center gap-1">
        <LockIcon className="size-3.5" />
        Locked
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 font-medium">
      <StatusGlyph state="active" />
      In care
    </span>
  );
}
