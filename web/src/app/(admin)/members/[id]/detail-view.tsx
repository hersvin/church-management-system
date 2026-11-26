"use client";

import { ArchiveIcon, ArrowLeftIcon, PencilIcon } from "@/components/icons";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EASE_OUT, FadeIn, Stagger, StaggerItem } from "@/components/motion";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranches } from "@/features/admin/queries";
import { useArchiveMember, useMember } from "@/features/members/api";
import { ageFrom, formatDate, fullName, initials, STATUS_LABELS, statusTone } from "@/features/members/format";
import { MemberForm } from "@/features/members/member-form";
import { MemberMinistriesCard } from "@/features/ministries/member-ministries-card";
import { MemberSchoolCard } from "@/features/school/member-school-card";
import { MemberAttendanceCard } from "@/features/attendance/member-attendance-card";
import { useSessionStore } from "@/stores/session-store";

const title = (v: string | null | undefined) =>
  v ? v.charAt(0) + v.slice(1).toLowerCase().replaceAll("_", " ") : "Not set";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm">{children || "Not set"}</dd>
    </div>
  );
}

export function MemberDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const can = useSessionStore((s) => s.can);
  const canMinistries = useSessionStore((s) => s.can("ministries.read"));
  const canSchool = useSessionStore((s) => s.can("school.read"));
  const me = useSessionStore((s) => s.user);
  const member = useMember(id);
  const branches = useBranches(can("branches.read"));
  const archive = useArchiveMember();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (member.isError) {
    return (
      <FadeIn className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">{member.error.message}</p>
        <Link href="/members" className={buttonVariants({ variant: "outline" })}>
          Back to members
        </Link>
      </FadeIn>
    );
  }
  if (!member.data) return <Skeleton className="h-40 w-full" />;

  const m = member.data;
  const age = ageFrom(m.birthDate);
  const branchOptions = branches.data ?? [{ id: m.branchId, name: m.branch.name, code: m.branch.code }];

  return (
    <>
      <Link href="/members" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" />
        Members
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
          <Avatar className="size-16">
            <AvatarFallback className="text-lg">{initials(m)}</AvatarFallback>
          </Avatar>
        </motion.div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{fullName(m)}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={statusTone(m.status)}>{STATUS_LABELS[m.status]}</Badge>
            <span className="text-muted-foreground">
              {m.branch.name}
              {age !== null && ` · ${age} years old`}
            </span>
          </div>
        </div>
        {can("members.manage") && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit
            </Button>
            <Button variant="outline" onClick={() => setConfirming(true)}>
              <ArchiveIcon />
              Archive
            </Button>
          </div>
        )}
      </div>

      <Stagger className="grid gap-4 lg:grid-cols-3">
        <StaggerItem className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Gender">{title(m.gender)}</Detail>
                <Detail label="Civil status">{title(m.civilStatus)}</Detail>
                <Detail label="Birth date">{formatDate(m.birthDate)}</Detail>
                <Detail label="Occupation">{m.occupation}</Detail>
                <Detail label="Email">{m.email && <a className="underline-offset-4 hover:underline" href={`mailto:${m.email}`}>{m.email}</a>}</Detail>
                <Detail label="Phone">{m.phone && <a className="underline-offset-4 hover:underline" href={`tel:${m.phone}`}>{m.phone}</a>}</Detail>
                <Detail label="Address">{m.address}</Detail>
                <Detail label="Membership date">{formatDate(m.membershipDate)}</Detail>
                <Detail label="Baptism date">{formatDate(m.baptismDate)}</Detail>
                <Detail label="Household">
                  {m.household && (
                    <Link className="underline-offset-4 hover:underline" href={`/households/${m.household.id}`}>
                      {m.household.name}
                      {m.householdRole && ` (${title(m.householdRole)})`}
                    </Link>
                  )}
                </Detail>
              </dl>
              {m.notes && (
                <div className="bg-muted/50 mt-4 rounded-md p-3 text-sm whitespace-pre-wrap">{m.notes}</div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Status history</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative flex flex-col gap-4 border-l pl-4">
                {m.statusHistory.map((h, i) => (
                  <motion.li
                    key={h.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.2 + i * 0.08 }}
                    className="relative"
                  >
                    <span className="bg-primary absolute top-1.5 -left-[21px] size-2.5 rounded-full ring-4 ring-background" />
                    <p className="text-sm font-medium">
                      {h.fromStatus ? `${STATUS_LABELS[h.fromStatus]} to ${STATUS_LABELS[h.toStatus]}` : `Added as ${STATUS_LABELS[h.toStatus]}`}
                    </p>
                    <p className="text-muted-foreground text-xs">{new Date(h.changedAt).toLocaleString()}</p>
                    {h.note && <p className="mt-1 text-sm">{h.note}</p>}
                  </motion.li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </StaggerItem>

        {canMinistries && (
          <StaggerItem className={canSchool ? "lg:col-span-2" : "lg:col-span-3"}>
            <MemberMinistriesCard memberId={m.id} />
          </StaggerItem>
        )}
        {canSchool && (
          <StaggerItem className={canMinistries ? "" : "lg:col-span-3"}>
            <MemberSchoolCard memberId={m.id} />
          </StaggerItem>
        )}
        {can("attendance.read") && (
          <StaggerItem className="lg:col-span-3">
            <MemberAttendanceCard memberId={m.id} />
          </StaggerItem>
        )}
      </Stagger>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Edit {m.firstName}</SheetTitle>
            <SheetDescription>Only changed fields are saved and logged.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {editing && (
              <MemberForm
                member={m}
                branches={me?.branchId && !branches.data ? [{ id: m.branchId, name: m.branch.name, code: m.branch.code }] : branchOptions}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  toast.success("Member updated");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {fullName(m)}?</AlertDialogTitle>
            <AlertDialogDescription>
              The record is hidden from the directory but kept for history and the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                archive.mutate(m.id, {
                  onSuccess: () => {
                    toast.success("Member archived");
                    router.push("/members");
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
