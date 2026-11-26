import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportsView } from "./view";

// Client-rendered admin screen: opt out of instant-navigation validation.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ReportsView />
    </Suspense>
  );
}
