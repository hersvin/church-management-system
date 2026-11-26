import { Suspense } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";

// Admin screens render on the client after the session loads, so there is no static shell to validate.
export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/">) {
  // The shell reads the pathname, which is dynamic on [id] routes, so it renders inside Suspense.
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8">
          <Skeleton className="h-8 w-48" />
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
