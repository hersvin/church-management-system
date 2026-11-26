"use client";

import { ROLE_KEYS, userCreateSchema } from "@cms/shared";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MotionRow, MotionTableBody } from "@/components/motion";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LinkMemberForm } from "@/features/admin/link-member-form";
import { useBranches, useCreateUser, useUpdateUser, useUsers, type UserRow } from "@/features/admin/queries";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSessionStore } from "@/stores/session-store";

const selectClass =
  "border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function CreateUserForm({ onDone }: { onDone: () => void }) {
  const branches = useBranches();
  const createUser = useCreateUser();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const branchId = String(form.get("branchId") ?? "");
    const parsed = userCreateSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      roleKey: form.get("roleKey"),
      branchId: branchId === "" ? null : branchId,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return;
    }
    setError(null);
    createUser.mutate(parsed.data, {
      onSuccess: () => {
        toast.success("User created");
        onDone();
      },
      onError: (e) => setError(e.message),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New user</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["firstName", "First name", "text"],
              ["lastName", "Last name", "text"],
              ["email", "Email", "email"],
              ["password", "Temporary password", "password"],
            ] as const
          ).map(([name, label, type]) => (
            <div key={name} className="flex flex-col gap-2">
              <Label htmlFor={name}>{label}</Label>
              <Input id={name} name={name} type={type} autoComplete="off" />
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <Label htmlFor="roleKey">Role</Label>
            <select id="roleKey" name="roleKey" className={selectClass} defaultValue="STAFF">
              {ROLE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="branchId">Branch</Label>
            <select id="branchId" name="branchId" className={selectClass} defaultValue="">
              <option value="">All branches (church-wide)</option>
              {branches.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={createUser.isPending}>
              Create user
            </Button>
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function UsersView() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const users = useUsers(page);
  const branches = useBranches();
  const updateUser = useUpdateUser();
  const [linking, setLinking] = useState<UserRow | null>(null);
  const can = useSessionStore((s) => s.can);
  const me = useSessionStore((s) => s.user);
  const branchName = new Map(branches.data?.map((b) => [b.id, b.name]));
  const totalPages = users.data ? Math.max(1, Math.ceil(users.data.total / users.data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Users"
        description="Staff and member accounts with their roles and branches."
        actions={
          can("users.manage") && !creating ? <Button onClick={() => setCreating(true)}>New user</Button> : null
        }
      />
      {creating && <CreateUserForm onDone={() => setCreating(false)} />}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Status</TableHead>
              {can("users.manage") && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <MotionTableBody>
            {users.isPending && (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  Loading users...
                </TableCell>
              </TableRow>
            )}
            {users.data?.items.map((u) => (
              <MotionRow key={u.id}>
                <TableCell className="font-medium">
                  {u.firstName} {u.lastName}
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.role.name}</TableCell>
                <TableCell>{u.branchId ? (branchName.get(u.branchId) ?? "Unknown") : "All branches"}</TableCell>
                <TableCell className="text-sm">
                  {u.member ? (
                    `${u.member.firstName} ${u.member.lastName}`
                  ) : (
                    <span className="text-muted-foreground">Not linked</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? "secondary" : "outline"}>{u.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                {can("users.manage") && (
                  <TableCell className="space-x-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => setLinking(u)}>
                      {u.member ? "Change member" : "Link member"}
                    </Button>
                    {u.id !== me?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updateUser.isPending}
                        onClick={() =>
                          updateUser.mutate(
                            { id: u.id, input: { isActive: !u.isActive } },
                            {
                              onSuccess: () => toast.success(u.isActive ? "User deactivated" : "User activated"),
                              onError: (e) => toast.error(e.message),
                            },
                          )
                        }
                      >
                        {u.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                  </TableCell>
                )}
              </MotionRow>
            ))}
          </MotionTableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
      <Sheet open={linking !== null} onOpenChange={(open) => !open && setLinking(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              Link {linking?.firstName} {linking?.lastName} to a member
            </SheetTitle>
            <SheetDescription>Lets the person use the church app as themselves: QR card, self check-in, ministries, and events.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">{linking && <LinkMemberForm user={linking} onDone={() => setLinking(null)} />}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
