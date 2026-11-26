"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/conflict-alert";
import { CheckIcon, ClockIcon, XIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDayLong, formatTimeRange } from "@/lib/datetime";
import { useDecideBooking, usePendingBookings } from "./api";

/** Queue of room requests waiting for a decision. Only room managers can approve or reject. */
export function PendingRequests({ canDecide }: { canDecide: boolean }) {
  const pending = usePendingBookings();
  const decide = useDecideBooking();
  const [failedId, setFailedId] = useState<string | null>(null);

  if (!pending.data || pending.data.length === 0) return null;

  return (
    <Card className="border-foreground/40 border border-dashed ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClockIcon className="size-4" />
          Pending room requests
          <Badge variant="secondary">{pending.data.length}</Badge>
        </CardTitle>
        <CardDescription>
          {canDecide ? "Approve or decline requests. Approval re-checks for clashes." : "Waiting for a room manager."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {pending.data.map((b) => (
            <motion.div
              key={b.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="flex flex-col gap-2 rounded-md border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <p className="font-medium">{b.event?.title ?? b.purpose}</p>
                  <p className="text-muted-foreground text-xs">
                    {b.room.name} · {formatDayLong(b.startsAt)} · {formatTimeRange(b.startsAt, b.endsAt)}
                  </p>
                </div>
                {canDecide && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate(
                          { id: b.id, decision: "approve" },
                          {
                            onSuccess: () => {
                              setFailedId(null);
                              toast.success("Booking approved");
                            },
                            onError: () => setFailedId(b.id),
                          },
                        )
                      }
                    >
                      <CheckIcon />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({ id: b.id, decision: "reject" }, { onSuccess: () => toast.success("Request declined") })
                      }
                    >
                      <XIcon />
                      Decline
                    </Button>
                  </div>
                )}
              </div>
              {failedId === b.id && <ErrorAlert error={decide.error} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
