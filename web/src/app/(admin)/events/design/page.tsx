import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { CalendarImageEditor } from "@/features/events/calendar-image/calendar-image-editor";

// Client-rendered admin screen: opt out of instant-navigation validation.
export const instant = false;

export default function Page() {
  return (
    <>
      <PageHeader
        title="Calendar image"
        description="Design a month calendar to share: pick a style, colors, and fonts, then download it as a PNG."
        actions={
          <Link href="/events" className={buttonVariants({ variant: "outline" })}>
            Back to events
          </Link>
        }
      />
      <CalendarImageEditor />
    </>
  );
}
