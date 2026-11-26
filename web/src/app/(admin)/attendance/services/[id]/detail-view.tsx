"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArchiveIcon, ArrowLeftIcon, ClockIcon, MapPinIcon, PencilIcon, QrCodeIcon, UsersIcon } from "@/components/icons";
import { FadeIn } from "@/components/motion";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useArchiveService, useService } from "@/features/attendance/api";
import { CheckInBoard } from "@/features/attendance/check-in-board";
import { serviceTiming } from "@/features/attendance/format";
import { ServiceForm } from "@/features/attendance/service-form";
import { formatDayLong, formatTime } from "@/lib/datetime";
import { useSessionStore } from "@/stores/session-store";

export function ServiceDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const can = useSessionStore((s) => s.can);
  const canManage = can("attendance.manage");
  const service = useService(id);
  const archive = useArchiveService();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  if (service.isError) {
    return (
      <FadeIn className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">{service.error.message}</p>
        <Link href="/attendance" className={buttonVariants({ variant: "outline" })}>
          Back to attendance
        </Link>
      </FadeIn>
    );
  }
  if (!service.data) return <Skeleton className="h-40 w-full" />;
  const s = service.data;
  const timing = serviceTiming(s.startsAt);

  return (
    <>
      <Link href="/attendance" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" />
        Attendance
      </Link>

      <FadeIn className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{s.name}</h1>
            {timing === "today" && <Badge>Today</Badge>}
            {timing === "upcoming" && <Badge variant="outline">Upcoming</Badge>}
          </div>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              {formatDayLong(s.startsAt)}, {formatTime(s.startsAt)}
            </span>
            <span className="flex items-center gap-1">
              <MapPinIcon className="size-3.5" />
              {s.branch.name}
            </span>
            <span className="flex items-center gap-1">
              <UsersIcon className="size-3.5" />
              {s.headcount !== null ? `Usher headcount ${s.headcount}` : "No headcount yet"}
            </span>
          </div>
          {s.notes && <p className="mt-2 max-w-3xl text-sm whitespace-pre-wrap">{s.notes}</p>}
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/attendance/services/${s.id}/qr`} className={buttonVariants({ variant: "outline" })}>
              <QrCodeIcon />
              Check-in QR
            </Link>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit or add headcount
            </Button>
            <Button variant="outline" onClick={() => setArchiving(true)}>
              <ArchiveIcon />
              Archive
            </Button>
          </div>
        )}
      </FadeIn>

      <CheckInBoard
        target={{ type: "service", id: s.id }}
        branchId={s.branchId}
        gathering={s.name}
        canManage={canManage}
        canOverride={can("attendance.override")}
      />

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit {s.name}</SheetTitle>
            <SheetDescription>The usher headcount is the reported attendance when it is higher than check-ins.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {editing && (
              <ServiceForm
                branches={[s.branch]}
                service={s}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  toast.success("Service updated");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={archiving} onOpenChange={setArchiving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {s.name}?</AlertDialogTitle>
            <AlertDialogDescription>It leaves the list and the totals. Its check-ins stay on record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                archive.mutate(s.id, {
                  onSuccess: () => {
                    toast.success("Service archived");
                    router.push("/attendance");
                  },
                  onError: (error) => toast.error(error.message),
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
