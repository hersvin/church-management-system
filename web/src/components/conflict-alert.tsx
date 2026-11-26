import { TriangleAlertIcon } from "@/components/icons";
import { ApiError } from "@/lib/api-client";
import { formatDateTime, formatTimeRange } from "@/lib/datetime";

export interface BookingConflict {
  requestedStartsAt: string;
  requestedEndsAt: string;
  bookingId: string;
  startsAt: string;
  endsAt: string;
  purpose: string;
  eventTitle: string | null;
}

export function conflictsFrom(error: unknown): BookingConflict[] {
  if (!(error instanceof ApiError) || error.status !== 409) return [];
  const body = error.body as { conflicts?: BookingConflict[] } | undefined;
  return body?.conflicts ?? [];
}

/** Error box for a failed save. For room clashes it lists each requested time and what it collides with. */
export function ErrorAlert({ error }: { error: Error | string | null }) {
  if (!error) return null;
  const message = typeof error === "string" ? error : error.message;
  const conflicts = typeof error === "string" ? [] : conflictsFrom(error);
  return (
    <div role="alert" className="bg-destructive/10 text-destructive flex flex-col gap-2 rounded-md px-3 py-2 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlertIcon className="size-4 shrink-0" />
        {message}
      </p>
      {conflicts.length > 0 && (
        <ul className="flex flex-col gap-1 pl-6 text-xs">
          {conflicts.slice(0, 8).map((c) => (
            <li key={`${c.bookingId}-${c.requestedStartsAt}`}>
              {formatDateTime(c.requestedStartsAt)} clashes with <strong>{c.eventTitle ?? c.purpose}</strong> (
              {formatTimeRange(c.startsAt, c.endsAt)})
            </li>
          ))}
          {conflicts.length > 8 && <li>and {conflicts.length - 8} more</li>}
        </ul>
      )}
    </div>
  );
}
