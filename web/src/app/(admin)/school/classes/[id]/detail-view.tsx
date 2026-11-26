"use client";

import type { TeacherRole } from "@cms/shared";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/conflict-alert";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  CalendarIcon,
  ClipboardListIcon,
  ClockIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  UserPlusIcon,
  XIcon,
} from "@/components/icons";
import { MemberPicker, type PickedPerson } from "@/components/member-picker";
import { FadeIn, MotionRow, MotionTableBody, Stagger, StaggerItem } from "@/components/motion";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dayKey } from "@/lib/datetime";
import { formatDate, fullName } from "@/features/members/format";
import {
  useAddTeacher,
  useArchiveClass,
  useClass,
  useCreateSession,
  useEnroll,
  useRemoveTeacher,
  useSession,
  useSessions,
  useUpdateEnrollment,
  type ClassDetail,
} from "@/features/school/api";
import { AttendanceSheet } from "@/features/school/attendance-sheet";
import { ClassForm } from "@/features/school/class-form";
import { AUDIENCE_META, RATE_CLASSES, rateTone, scheduleLine, termState } from "@/features/school/format";
import { RateBar } from "@/features/school/rate-bar";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

type Enrollment = ClassDetail["enrollments"][number];

function PersonSheet({
  title,
  description,
  branchId,
  excludeIds,
  withRole,
  onSubmit,
  pending,
  error,
}: {
  title: string;
  description: string;
  branchId: string;
  excludeIds: string[];
  withRole: boolean;
  onSubmit: (person: PickedPerson, role: TeacherRole) => void;
  pending: boolean;
  error: Error | null;
}) {
  const [selected, setSelected] = useState<PickedPerson | null>(null);
  const [role, setRole] = useState<TeacherRole>("LEAD");
  return (
    <>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4 pb-6">
        <MemberPicker branchId={branchId} excludeIds={excludeIds} selected={selected} onSelect={setSelected} />
        {withRole && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="teacher-role">Role</Label>
            <NativeSelect id="teacher-role" value={role} onChange={(e) => setRole(e.target.value as TeacherRole)}>
              <option value="LEAD">Lead teacher</option>
              <option value="ASSISTANT">Assistant</option>
            </NativeSelect>
          </div>
        )}
        <ErrorAlert error={error} />
        <Button disabled={!selected || pending} onClick={() => selected && onSubmit(selected, role)} className="self-start">
          {withRole ? "Add teacher" : "Enroll"}
        </Button>
      </div>
    </>
  );
}

export function ClassDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canManage = useSessionStore((s) => s.can("school.manage"));
  const klass = useClass(id);
  const sessions = useSessions(id);
  const addTeacher = useAddTeacher(id);
  const removeTeacher = useRemoveTeacher(id);
  const enroll = useEnroll(id);
  const updateEnrollment = useUpdateEnrollment();
  const createSession = useCreateSession(id);
  const archive = useArchiveClass();

  const [panel, setPanel] = useState<"teacher" | "student" | "edit" | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const session = useSession(openSessionId);
  const [newSession, setNewSession] = useState(false);
  const [sessionDate, setSessionDate] = useState(() => dayKey(new Date()));
  const [sessionTopic, setSessionTopic] = useState("");
  const [closing, setClosing] = useState<{ enrollment: Enrollment; status: "COMPLETED" | "DROPPED" } | null>(null);
  const [grade, setGrade] = useState("");
  const [archiving, setArchiving] = useState(false);

  if (klass.isError) {
    return (
      <FadeIn className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">{klass.error.message}</p>
        <Link href="/school" className={buttonVariants({ variant: "outline" })}>
          Back to school
        </Link>
      </FadeIn>
    );
  }
  if (!klass.data) return <Skeleton className="h-40 w-full" />;

  const c = klass.data;
  const meta = AUDIENCE_META[c.audience];
  const branchId = c.term.branchId;
  const active = c.enrollments.filter((e) => e.status === "ENROLLED");
  const past = c.enrollments.filter((e) => e.status !== "ENROLLED");
  const termOpen = termState(c.term.startsOn, c.term.endsOn) !== "ended";
  const onError = (e: Error) => toast.error(e.message);

  return (
    <>
      <Link href="/school" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" />
        School
      </Link>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", meta.chip)}>
            {meta.label}
            {c.ageRange ? ` · ${c.ageRange}` : ""}
          </span>
          <h1 className="mt-2 text-2xl font-semibold">{c.name}</h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{c.term.name}</span>
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              {scheduleLine(c.meetingDay, c.startTime, c.endTime)}
            </span>
            {c.room && (
              <span className="flex items-center gap-1">
                <MapPinIcon className="size-3.5" />
                {c.room.name}
              </span>
            )}
          </div>
          {c.description && <p className="text-muted-foreground mt-2 max-w-3xl text-sm">{c.description}</p>}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPanel("edit")}>
              <PencilIcon />
              Edit
            </Button>
            <Button variant="outline" onClick={() => setArchiving(true)}>
              <ArchiveIcon />
              Archive
            </Button>
          </div>
        )}
      </div>

      <Stagger className="grid gap-4 sm:grid-cols-3">
        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <CardDescription>Students</CardDescription>
              <CardTitle className="text-3xl font-data">
                {active.length}
                {c.capacity && <span className="text-muted-foreground text-base font-normal"> / {c.capacity}</span>}
              </CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="h-full">
            <CardHeader>
              <CardDescription>Sessions held</CardDescription>
              <CardTitle className="text-3xl font-data">{sessions.data?.length ?? "-"}</CardTitle>
            </CardHeader>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col justify-center pt-6">
              <RateBar rate={c.attendanceRate} label="Class attendance" />
            </CardContent>
          </Card>
        </StaggerItem>
      </Stagger>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>Attendance counts present and late; excused sessions are left out.</CardDescription>
            </div>
            {canManage && termOpen && (
              <Button size="sm" onClick={() => setPanel("student")}>
                <UserPlusIcon />
                Enroll
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-0">
            {c.enrollments.length === 0 ? (
              <p className="text-muted-foreground px-6 text-sm">No one is enrolled yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Student</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="pr-6 text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <MotionTableBody>
                  {[...active, ...past].map((e) => (
                    <MotionRow key={e.id} layout className={cn(e.status !== "ENROLLED" && "opacity-60")}>
                      <TableCell className="pl-6 font-medium">
                        <Link href={`/members/${e.member.id}`} className="hover:underline">
                          {fullName(e.member)}
                        </Link>
                      </TableCell>
                      <TableCell className={cn("font-data", RATE_CLASSES[rateTone(e.attendanceRate)].text)}>
                        {e.attendanceRate === null ? "No records" : `${e.attendanceRate}%`}
                      </TableCell>
                      <TableCell>
                        {e.status === "ENROLLED" && <Badge variant="secondary">Enrolled</Badge>}
                        {e.status === "COMPLETED" && <Badge>Completed{e.grade ? ` · ${e.grade}` : ""}</Badge>}
                        {e.status === "DROPPED" && <Badge variant="outline">Dropped</Badge>}
                      </TableCell>
                      {canManage && (
                        <TableCell className="pr-6 text-right">
                          {e.status === "ENROLLED" && (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setClosing({ enrollment: e, status: "COMPLETED" })}>
                                Complete
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setClosing({ enrollment: e, status: "DROPPED" })}>
                                Drop
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </MotionRow>
                  ))}
                </MotionTableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <CardTitle>Teachers</CardTitle>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setPanel("teacher")}>
                  <PlusIcon />
                  Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {c.teachers.length === 0 && <p className="text-muted-foreground text-sm">No teachers yet.</p>}
              {c.teachers.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <Link href={`/members/${t.member.id}`} className="flex-1 font-medium hover:underline">
                    {fullName(t.member)}
                  </Link>
                  <Badge variant={t.role === "LEAD" ? "default" : "secondary"}>{t.role === "LEAD" ? "Lead" : "Assistant"}</Badge>
                  {canManage && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${fullName(t.member)}`}
                      onClick={() => removeTeacher.mutate(t.member.id, { onSuccess: () => toast.success("Teacher removed"), onError })}
                    >
                      <XIcon />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <div>
                <CardTitle>Sessions</CardTitle>
                <CardDescription>Open one to take attendance.</CardDescription>
              </div>
              {canManage && (
                <Button size="sm" onClick={() => setNewSession(true)}>
                  <ClipboardListIcon />
                  New session
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {sessions.data?.length === 0 && <p className="text-muted-foreground text-sm">No sessions yet.</p>}
              {sessions.data?.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setOpenSessionId(s.id)}
                  className="hover:bg-muted flex items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
                >
                  <CalendarIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="flex-1">
                    <span className="font-medium">{formatDate(s.date)}</span>
                    {s.topic && <span className="text-muted-foreground block text-xs">{s.topic}</span>}
                  </span>
                  <span className={cn("text-xs font-data", RATE_CLASSES[rateTone(s.attendanceRate)].text)}>
                    {s.recorded === 0 ? "Not taken" : `${s.attendanceRate ?? 0}%`}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {panel === "teacher" && (
            <PersonSheet
              title="Add a teacher"
              description="Teachers come from this branch's members."
              branchId={branchId}
              excludeIds={[...c.teachers.map((t) => t.member.id), ...active.map((e) => e.member.id)]}
              withRole
              pending={addTeacher.isPending}
              error={addTeacher.error}
              onSubmit={(p, role) =>
                addTeacher.mutate({ memberId: p.id, role }, { onSuccess: () => (setPanel(null), toast.success("Teacher added")) })
              }
            />
          )}
          {panel === "student" && (
            <PersonSheet
              title={`Enroll in ${c.name}`}
              description="Students come from this branch's members."
              branchId={branchId}
              excludeIds={[...c.teachers.map((t) => t.member.id), ...active.map((e) => e.member.id)]}
              withRole={false}
              pending={enroll.isPending}
              error={enroll.error}
              onSubmit={(p) => enroll.mutate(p.id, { onSuccess: () => (setPanel(null), toast.success(`${fullName(p)} enrolled`)) })}
            />
          )}
          {panel === "edit" && (
            <>
              <SheetHeader>
                <SheetTitle>Edit {c.name}</SheetTitle>
                <SheetDescription>Only changed fields are saved and logged.</SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <ClassForm
                  termId={c.termId}
                  branchId={branchId}
                  klass={c}
                  onCancel={() => setPanel(null)}
                  onSaved={() => (setPanel(null), toast.success("Class updated"))}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={openSessionId !== null} onOpenChange={(open) => !open && setOpenSessionId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{session.data ? `Attendance, ${formatDate(session.data.session.date)}` : "Attendance"}</SheetTitle>
            <SheetDescription>{session.data?.session.topic ?? c.name}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {session.isPending && <Skeleton className="h-40 w-full" />}
            {session.data && (
              <AttendanceSheet
                key={session.data.session.id}
                sessionId={session.data.session.id}
                register={session.data.register}
                canEdit={canManage}
                onSaved={() => {
                  setOpenSessionId(null);
                  toast.success("Attendance saved");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={newSession} onOpenChange={setNewSession}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New session</AlertDialogTitle>
            <AlertDialogDescription>
              Pick a date within {c.term.name} ({formatDate(c.term.startsOn)} to {formatDate(c.term.endsOn)}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-date">Date</Label>
              <Input id="session-date" type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="session-topic">Topic (optional)</Label>
              <Input id="session-topic" value={sessionTopic} onChange={(e) => setSessionTopic(e.target.value)} />
            </div>
            <ErrorAlert error={createSession.error} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              disabled={createSession.isPending || !sessionDate}
              onClick={() =>
                createSession.mutate(
                  { date: sessionDate, ...(sessionTopic.trim() ? { topic: sessionTopic } : {}) },
                  {
                    onSuccess: (s) => {
                      setNewSession(false);
                      setSessionTopic("");
                      setOpenSessionId(s.id);
                    },
                  },
                )
              }
            >
              Create and take attendance
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closing !== null} onOpenChange={(open) => !open && (setClosing(null), setGrade(""))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {closing?.status === "COMPLETED" ? "Mark as completed" : "Drop from class"}: {closing ? fullName(closing.enrollment.member) : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {closing?.status === "COMPLETED"
                ? "Their attendance stays on record. You can add a grade."
                : "They leave the register from today. Past attendance is kept."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {closing?.status === "COMPLETED" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="grade">Grade (optional)</Label>
              <Input id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Passed, A, 95" />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                closing &&
                updateEnrollment.mutate(
                  { id: closing.enrollment.id, status: closing.status, ...(grade.trim() ? { grade } : {}) },
                  {
                    onSuccess: () => {
                      toast.success(closing.status === "COMPLETED" ? "Marked as completed" : "Dropped from class");
                      setClosing(null);
                      setGrade("");
                    },
                    onError,
                  },
                )
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiving} onOpenChange={setArchiving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {c.name}?</AlertDialogTitle>
            <AlertDialogDescription>The class is hidden. Enrollments and attendance stay on record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                archive.mutate(c.id, {
                  onSuccess: () => {
                    toast.success("Class archived");
                    router.push("/school");
                  },
                  onError,
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
