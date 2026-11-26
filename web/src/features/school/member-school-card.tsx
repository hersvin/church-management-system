"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMemberSchool } from "./api";
import { AUDIENCE_META, RATE_CLASSES, rateTone } from "./format";

export function MemberSchoolCard({ memberId }: { memberId: string }) {
  const school = useMemberSchool(memberId);
  const data = school.data;
  const empty = data && data.enrollments.length === 0 && data.teaching.length === 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>School</CardTitle>
        <CardDescription>Classes taken and taught.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {school.isPending && <Skeleton className="h-10 w-full" />}
        {empty && <p className="text-muted-foreground text-sm">No classes yet.</p>}
        {data?.teaching.map((t) => (
          <Link key={t.id} href={`/school/classes/${t.class.id}`} className="hover:bg-muted flex items-center gap-3 rounded-md p-2 text-sm transition-colors">
            <span className={cn("size-2 shrink-0 rounded-full", AUDIENCE_META[t.class.audience].accent)} />
            <span className="flex-1">
              <span className="font-medium">{t.class.name}</span>
              <span className="text-muted-foreground block text-xs">{t.class.term.name}</span>
            </span>
            <Badge>{t.role === "LEAD" ? "Teaches" : "Assists"}</Badge>
          </Link>
        ))}
        {data?.enrollments.map((e) => (
          <Link
            key={e.id}
            href={`/school/classes/${e.class.id}`}
            className={cn("hover:bg-muted flex items-center gap-3 rounded-md p-2 text-sm transition-colors", e.status === "DROPPED" && "opacity-60")}
          >
            <span className={cn("size-2 shrink-0 rounded-full", AUDIENCE_META[e.class.audience].accent)} />
            <span className="flex-1">
              <span className="font-medium">{e.class.name}</span>
              <span className="text-muted-foreground block text-xs">
                {e.class.term.name}
                {e.attendanceRate !== null && (
                  <>
                    {" · "}
                    <span className={RATE_CLASSES[rateTone(e.attendanceRate)].text}>{e.attendanceRate}% attendance</span>
                  </>
                )}
              </span>
            </span>
            <Badge variant={e.status === "ENROLLED" ? "secondary" : e.status === "COMPLETED" ? "default" : "outline"}>
              {e.status === "ENROLLED" ? "Student" : e.status === "COMPLETED" ? `Completed${e.grade ? ` · ${e.grade}` : ""}` : "Dropped"}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
