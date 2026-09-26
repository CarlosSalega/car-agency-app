import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Replaces `@radix-ui/react-skeleton`, which wrapped a single `<div>` and had no
 * behavior of its own. Base UI ships no skeleton primitive either, so the
 * native element is the direct equivalent and the dependency disappears.
 *
 * The fill uses this project's `muted` token rather than shadcn's `accent`,
 * which keeps a loading placeholder consistent with `ImageSkeleton` and with
 * the muted surfaces it sits on.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-sm", className)}
      {...props}
    />
  );
}

export { Skeleton };
