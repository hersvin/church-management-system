"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/features/members/format";
import { cn } from "@/lib/utils";
import { useMemberMinistries } from "./api";
import { CATEGORY_META, POSITION_LABELS } from "./format";

export function MemberMinistriesCard({ memberId }: { memberId: string }) {
  const ministries = useMemberMinistries(memberId);
  const current = ministries.data?.filter((m) => !m.leftAt) ?? [];
  const past = ministries.data?.filter((m) => m.leftAt) ?? [];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Ministries</CardTitle>
        <CardDescription>
          {ministries.data ? `Serving in ${current.length} ${current.length === 1 ? "ministry" : "ministries"}` : "Loading"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {ministries.isPending && <Skeleton className="h-10 w-full" />}
        {ministries.data && ministries.data.length === 0 && (
          <p className="text-muted-foreground text-sm">Not serving in any ministry yet.</p>
        )}
        {[...current, ...past].map((entry) => {
          const meta = CATEGORY_META[entry.ministry.category];
          return (
            <Link
              key={entry.id}
              href={`/ministries/${entry.ministry.id}`}
              className={cn("hover:bg-muted flex items-center gap-3 rounded-md p-2 transition-colors", entry.leftAt && "opacity-60")}
            >
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md text-white", meta.accent)}>
                <meta.icon className="size-4" />
              </span>
              <span className="flex-1 text-sm">
                <span className="font-medium">{entry.ministry.name}</span>
                <span className="text-muted-foreground block text-xs">
                  {entry.ministryRole?.name ? `${entry.ministryRole.name} · ` : ""}
                  {entry.leftAt
                    ? `${formatDate(entry.joinedAt)} to ${formatDate(entry.leftAt)}`
                    : `Since ${formatDate(entry.joinedAt)}`}
                </span>
              </span>
              <Badge variant={entry.leftAt ? "outline" : entry.position === "MEMBER" ? "secondary" : "default"}>
                {entry.leftAt ? "Past" : POSITION_LABELS[entry.position]}
              </Badge>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
