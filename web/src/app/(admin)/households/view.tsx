"use client";

import { householdCreateSchema } from "@cms/shared";
import { HouseIcon, MapPinIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/icons";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-header";
import { Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useBranches } from "@/features/admin/queries";
import { useCreateHousehold, useHouseholds } from "@/features/members/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSessionStore } from "@/stores/session-store";

function NewHouseholdForm({ onDone }: { onDone: () => void }) {
  const branches = useBranches();
  const me = useSessionStore((s) => s.user);
  const create = useCreateHousehold();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = householdCreateSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return setError(parsed.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join("; "));
    setError(null);
    create.mutate(parsed.data, {
      onSuccess: (h) => {
        toast.success(`${h.name} created`);
        onDone();
      },
      onError: (e) => setError(e.message),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Household name</Label>
        <Input id="name" name="name" placeholder="Santos Family" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" type="tel" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="branchId">Branch</Label>
        <NativeSelect id="branchId" name="branchId" defaultValue={me?.branchId ?? branches.data?.[0]?.id}>
          {branches.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          Create household
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function HouseholdsView() {
  const can = useSessionStore((s) => s.can);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const debounced = useDebouncedValue(search);
  const households = useHouseholds(debounced, page, 24);
  const totalPages = households.data ? Math.max(1, Math.ceil(households.data.total / households.data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Households"
        description="Families and people who live together."
        actions={
          can("members.manage") && (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon />
              New household
            </Button>
          )
        }
      />
      <div className="relative sm:max-w-xs">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          aria-label="Search households"
          placeholder="Search households"
          className="pl-8"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {households.data?.items.length === 0 && (
        <p className="text-muted-foreground py-10 text-center text-sm">No households match your search.</p>
      )}

      <Stagger key={`${debounced}-${page}-${households.data ? "y" : "n"}`} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {households.data?.items.map((h) => (
          <StaggerItem key={h.id} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
            <Link href={`/households/${h.id}`} className="block h-full rounded-xl focus-visible:outline-2">
              <Card className="h-full transition-[box-shadow] hover:ring-foreground/35">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HouseIcon className="text-muted-foreground size-4" />
                    {h.name}
                  </CardTitle>
                  <CardDescription className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5">
                      <UsersIcon className="size-3.5" />
                      {h._count?.members ?? 0} people · {h.branch.name}
                    </span>
                    {h.address && (
                      <span className="flex items-center gap-1.5">
                        <MapPinIcon className="size-3.5" />
                        {h.address}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      {totalPages > 1 && (
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
      )}

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New household</SheetTitle>
            <SheetDescription>Add members to it from their profile.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{creating && <NewHouseholdForm onDone={() => setCreating(false)} />}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
