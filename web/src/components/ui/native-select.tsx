import * as React from "react";
import { cn } from "@/lib/utils";

/** Native select styled to match shadcn inputs. Keeps forms simple and fully accessible. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive h-8 w-full min-w-0 rounded-lg border px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
