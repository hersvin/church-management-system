"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StatusGlyph } from "@/components/status-glyph";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/datetime";

interface JoinRequest {
  id: string;
  note: string | null;
  createdAt: string;
  member: { id: string; firstName: string; lastName: string };
}

/** People who asked to join this ministry from the church app, for its leaders to approve or decline. */
export function JoinRequestsPanel({ ministryId }: { ministryId: string }) {
  const queryClient = useQueryClient();
  const requests = useQuery({
    queryKey: ["ministries", ministryId, "join-requests"],
    queryFn: () => apiFetch<JoinRequest[]>(`/ministries/${ministryId}/join-requests`),
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "APPROVED" | "DECLINED" }) =>
      apiFetch(`/ministry-requests/${id}/decision`, { method: "POST", json: { decision } }),
    onSuccess: (_, { decision }) => {
      toast.success(decision === "APPROVED" ? "Added to the roster" : "Request declined");
      return queryClient.invalidateQueries({ queryKey: ["ministries", ministryId] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Requests to join</CardTitle>
        <CardDescription>Members who asked to join from the church app. Approving adds them to the roster.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {requests.isPending && <Skeleton className="h-12 w-full" />}
        {requests.data?.length === 0 && <p className="text-muted-foreground text-sm">No requests waiting.</p>}
        {requests.data?.map((r) => {
          const name = `${r.member.firstName} ${r.member.lastName}`;
          return (
            <div key={r.id} className="border-border flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
              <StatusGlyph state="waiting" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{name}</div>
                {r.note && <p className="text-muted-foreground">{r.note}</p>}
                <div className="font-data text-muted-foreground text-xs">{formatDateTime(r.createdAt)}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" aria-label={`Approve ${name}`} disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: "APPROVED" })}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" aria-label={`Decline ${name}`} disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, decision: "DECLINED" })}>
                  Decline
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
