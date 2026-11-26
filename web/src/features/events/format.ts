import type { BookingStatus, EventCategory } from "@cms/shared";

/**
 * Categories are told apart by ink tone, not hue: services print solid, the rest step down in
 * tone or show as rings. Labels always travel with the mark.
 */
export const EVENT_CATEGORY_META: Record<EventCategory, { label: string; dot: string; chip: string }> = {
  SERVICE: { label: "Service", dot: "bg-foreground", chip: "bg-foreground text-background" },
  MEETING: { label: "Meeting", dot: "bg-foreground/75", chip: "border border-border bg-background text-foreground" },
  CLASS: { label: "Class", dot: "bg-foreground/55", chip: "border border-border bg-background text-foreground" },
  OUTREACH: { label: "Outreach", dot: "bg-transparent ring-1 ring-inset ring-foreground", chip: "border border-border bg-background text-foreground" },
  FELLOWSHIP: { label: "Fellowship", dot: "bg-foreground/35", chip: "border border-border bg-background text-foreground" },
  CONFERENCE: { label: "Conference", dot: "bg-transparent ring-2 ring-inset ring-foreground/60", chip: "border border-border bg-background text-foreground" },
  OTHER: { label: "Other", dot: "bg-transparent border border-dashed border-foreground/70", chip: "border border-dashed border-border bg-background text-muted-foreground" },
};

export const BOOKING_STATUS_META: Record<BookingStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  APPROVED: { label: "Room confirmed", variant: "default" },
  PENDING: { label: "Room pending approval", variant: "secondary" },
  REJECTED: { label: "Room request declined", variant: "destructive" },
  CANCELLED: { label: "Room released", variant: "outline" },
};

export const REPEAT_LABELS = { WEEKLY: "Every week", BIWEEKLY: "Every 2 weeks", MONTHLY: "Every month" } as const;
