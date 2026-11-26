"use client";

import { ArrowLeftIcon, MapPinIcon, PhoneIcon } from "@/components/icons";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Stagger, StaggerItem } from "@/components/motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHousehold } from "@/features/members/api";
import { ageFrom, fullName, initials, STATUS_LABELS, statusTone } from "@/features/members/format";

const title = (v: string | null) => (v ? v.charAt(0) + v.slice(1).toLowerCase() : "Member");

export function HouseholdDetailView() {
  const { id } = useParams<{ id: string }>();
  const household = useHousehold(id);

  if (household.isError) return <p className="text-muted-foreground">{household.error.message}</p>;
  if (!household.data) return <Skeleton className="h-40 w-full" />;
  const h = household.data;

  return (
    <>
      <Link href="/households" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" />
        Households
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{h.name}</h1>
        <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>{h.branch.name}</span>
          {h.address && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="size-3.5" />
              {h.address}
            </span>
          )}
          {h.phone && (
            <span className="flex items-center gap-1">
              <PhoneIcon className="size-3.5" />
              {h.phone}
            </span>
          )}
        </div>
      </div>

      {h.members.length === 0 && (
        <p className="text-muted-foreground text-sm">No one is in this household yet. Assign people from their member profile.</p>
      )}

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {h.members.map((m) => {
          const age = ageFrom(m.birthDate);
          return (
            <StaggerItem key={m.id} whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
              <Link href={`/members/${m.id}`} className="block h-full rounded-xl focus-visible:outline-2">
                <Card className="h-full transition-[box-shadow] hover:ring-foreground/35">
                  <CardHeader className="flex flex-row items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback>{initials(m)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-base">{fullName(m)}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        <span>{title(m.householdRole)}</span>
                        {age !== null && <span>{age} yrs</span>}
                        <Badge variant={statusTone(m.status)}>{STATUS_LABELS[m.status]}</Badge>
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>
    </>
  );
}
