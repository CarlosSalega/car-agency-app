import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Migrated from `@radix-ui/react-separator`.
 *
 * Base UI's separator is a callable primitive with no `.Root`, so this wrapper
 * wraps the part directly instead of `SeparatorPrimitive.Root`.
 *
 * Radix's `decorative` prop is dropped, and it is worth being explicit about
 * why that is not just a rename. Radix rendered a `<div role="none">` when
 * `decorative` was set and an `<hr>`/separator role otherwise. Base UI always
 * renders a `<div role="separator" aria-orientation="...">` and exposes no way
 * to opt out, so a decorative separator is no longer expressible. The
 * orientation data attribute is unchanged: it is still `data-orientation`.
 *
 * The colors stay on the plain `border` token rather than a sidebar token. This
 * is a generic primitive that the sidebar places, not one that belongs to the
 * sidebar, so a sidebar separator overrides it with `className="bg-sidebar-border"`
 * instead of every other consumer inheriting sidebar grays.
 */
function Separator({
  className,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive>) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
