"use client";

import { JoinRequestsPanel } from "@/features/ministries/join-requests-panel";
import { MINISTRY_POSITIONS, type MinistryPosition } from "@cms/shared";
import { ArchiveIcon, ArrowLeftIcon, ClockIcon, PencilIcon, PlusIcon, UserMinusIcon, XIcon } from "@/components/icons";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FadeIn, MotionRow, MotionTableBody } from "@/components/motion";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/features/admin/queries";
import { formatDate, fullName, initials } from "@/features/members/format";
import { AddMemberForm } from "@/features/ministries/add-member-form";
import {
  useAddRole,
  useArchiveMinistry,
  useMinistry,
  useRemoveRole,
  useRemoveRosterMember,
  useUpdateMinistry,
  useUpdateRosterMember,
  type RosterEntry,
} from "@/features/ministries/api";
import { CATEGORY_META, POSITION_LABELS } from "@/features/ministries/format";
import { MinistryForm } from "@/features/ministries/ministry-form";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

export function MinistryDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const canManage = useSessionStore((s) => s.can("ministries.manage"));
  const canBranches = useSessionStore((s) => s.can("branches.read"));
  const ministry = useMinistry(id);
  const branches = useBranches(canBranches);
  const addRole = useAddRole(id);
  const removeRole = useRemoveRole(id);
  const updateEntry = useUpdateRosterMember(id);
  const removeEntry = useRemoveRosterMember(id);
  const updateMinistry = useUpdateMinistry(id);
  const archive = useArchiveMinistry();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [removing, setRemoving] = useState<RosterEntry | null>(null);
  const [roleName, setRoleName] = useState("");

  if (ministry.isError) {
    return (
      <FadeIn className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">{ministry.error.message}</p>
        <Link href="/ministries" className={buttonVariants({ variant: "outline" })}>
          Back to ministries
        </Link>
      </FadeIn>
    );
  }
  if (!ministry.data) return <Skeleton className="h-40 w-full" />;

  const m = ministry.data;
  const meta = CATEGORY_META[m.category];
  const onError = (e: Error) => toast.error(e.message);

  function submitRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = roleName.trim();
    if (!name) return;
    addRole.mutate(name, {
      onSuccess: () => {
        setRoleName("");
        toast.success(`Role "${name}" added`);
      },
      onError,
    });
  }

  return (
    <>
      <Link href="/ministries" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" />
        Ministries
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <motion.span
          initial={{ scale: 0.7, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className={cn("flex size-14 items-center justify-center rounded-xl text-white", meta.accent)}
        >
          <meta.icon className="size-7" />
        </motion.span>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{m.name}</h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Badge variant="secondary">{meta.label}</Badge>
            {!m.isActive && <Badge variant="outline">Inactive</Badge>}
            <span>{m.branch.name}</span>
            {m.meetingSchedule && (
              <span className="flex items-center gap-1">
                <ClockIcon className="size-3.5" />
                {m.meetingSchedule}
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={updateMinistry.isPending}
              onClick={() =>
                updateMinistry.mutate(
                  { isActive: !m.isActive },
                  { onSuccess: () => toast.success(m.isActive ? "Ministry paused" : "Ministry reactivated"), onError },
                )
              }
            >
              {m.isActive ? "Mark inactive" : "Reactivate"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(true)}>
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

      {m.description && <p className="text-muted-foreground max-w-3xl text-sm whitespace-pre-wrap">{m.description}</p>}

      {canManage && <JoinRequestsPanel ministryId={m.id} />}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Roster</CardTitle>
              <CardDescription>{m.members.length} serving</CardDescription>
            </div>
            {canManage && m.isActive && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <PlusIcon />
                Add person
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-0">
            {m.members.length === 0 ? (
              <p className="text-muted-foreground px-6 py-6 text-sm">No one is serving here yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Person</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden md:table-cell">Since</TableHead>
                      {canManage && <TableHead className="pr-6 text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <MotionTableBody>
                    {m.members.map((entry) => (
                      <MotionRow key={entry.id} layout>
                        <TableCell className="pl-6">
                          <Link href={`/members/${entry.member.id}`} className="flex items-center gap-2 hover:underline">
                            <Avatar className="size-7">
                              <AvatarFallback className="text-[10px]">{initials(entry.member)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{fullName(entry.member)}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          {canManage ? (
                            <NativeSelect
                              aria-label={`Position for ${fullName(entry.member)}`}
                              className="w-32"
                              value={entry.position}
                              onChange={(e) =>
                                updateEntry.mutate(
                                  { memberId: entry.member.id, input: { position: e.target.value as MinistryPosition } },
                                  { onSuccess: () => toast.success("Position updated"), onError },
                                )
                              }
                            >
                              {MINISTRY_POSITIONS.map((p) => (
                                <option key={p} value={p}>
                                  {POSITION_LABELS[p]}
                                </option>
                              ))}
                            </NativeSelect>
                          ) : (
                            <Badge variant={entry.position === "MEMBER" ? "outline" : "default"}>
                              {POSITION_LABELS[entry.position]}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {canManage ? (
                            <NativeSelect
                              aria-label={`Role for ${fullName(entry.member)}`}
                              className="w-36"
                              value={entry.ministryRole?.id ?? ""}
                              onChange={(e) =>
                                updateEntry.mutate(
                                  { memberId: entry.member.id, input: { ministryRoleId: e.target.value || null } },
                                  { onSuccess: () => toast.success("Role updated"), onError },
                                )
                              }
                            >
                              <option value="">None</option>
                              {m.roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </NativeSelect>
                          ) : (
                            (entry.ministryRole?.name ?? "None")
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{formatDate(entry.joinedAt)}</TableCell>
                        {canManage && (
                          <TableCell className="pr-6 text-right">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Remove ${fullName(entry.member)}`}
                              onClick={() => setRemoving(entry)}
                            >
                              <UserMinusIcon />
                            </Button>
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

        <Card>
          <CardHeader>
            <CardTitle>Volunteer roles</CardTitle>
            <CardDescription>Jobs people can take on in this ministry.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {m.roles.map((r) => (
                  <motion.li
                    key={r.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <Badge variant="secondary" className="gap-1 pr-1">
                      {r.name}
                      {canManage && (
                        <button
                          type="button"
                          aria-label={`Remove role ${r.name}`}
                          className="hover:bg-background/60 rounded-sm p-0.5"
                          onClick={() =>
                            removeRole.mutate(r.id, { onSuccess: () => toast.success(`Role "${r.name}" removed`), onError })
                          }
                        >
                          <XIcon className="size-3" />
                        </button>
                      )}
                    </Badge>
                  </motion.li>
                ))}
              </AnimatePresence>
              {m.roles.length === 0 && <li className="text-muted-foreground text-sm">No roles yet.</li>}
            </ul>
            {canManage && (
              <form onSubmit={submitRole} className="flex gap-2">
                <Input
                  aria-label="New role name"
                  placeholder="New role, for example Vocalist"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                />
                <Button type="submit" variant="outline" disabled={addRole.isPending || !roleName.trim()}>
                  Add
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add to {m.name}</SheetTitle>
            <SheetDescription>People from {m.branch.name} can join this ministry.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {adding && (
              <AddMemberForm
                ministryId={m.id}
                branchId={m.branchId}
                roles={m.roles}
                excludeMemberIds={m.members.map((e) => e.member.id)}
                onDone={(saved) => {
                  setAdding(false);
                  if (saved) toast.success("Added to roster");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit {m.name}</SheetTitle>
            <SheetDescription>Only changed fields are saved and logged.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {editing && (
              <MinistryForm
                ministry={{ ...m, members: undefined }}
                branches={branches.data ?? [m.branch]}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  toast.success("Ministry updated");
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing ? fullName(removing.member) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              They leave the roster today. Their past service stays on their profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                removing &&
                removeEntry.mutate(removing.member.id, {
                  onSuccess: () => {
                    toast.success("Removed from roster");
                    setRemoving(null);
                  },
                  onError,
                })
              }
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiving} onOpenChange={setArchiving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {m.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The ministry is hidden and everyone on the roster is marked as having left today. History is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                archive.mutate(m.id, {
                  onSuccess: () => {
                    toast.success("Ministry archived");
                    router.push("/ministries");
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
