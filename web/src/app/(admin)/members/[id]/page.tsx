import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberDetailView } from "./detail-view";

// Client-rendered admin screen: opt out of instant-navigation validation.
export const instant = false;

// useParams() reads the dynamic segment on the client, so it needs a Suspense boundary.
export default function MemberDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <MemberDetailView />
    </Suspense>
  );
}
