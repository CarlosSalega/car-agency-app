"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Migrated from `@radix-ui/react-collapsible`.
 *
 * Part renames: `Root` and `Trigger` keep their names, `Content` becomes `Panel`.
 *
 * The class rewrite was bigger than the rename:
 * - `--radix-collapsible-content-height` becomes `--collapsible-panel-height`.
 *   That is not cosmetic: Base UI writes that exact custom property on the
 *   panel element (`CollapsiblePanelCssVars.collapsiblePanelHeight`), so the
 *   height has to be consumed on the Panel itself rather than on an inner div.
 * - The Radix keyframe pair `animate-collapsible-up` / `animate-collapsible-down`
 *   becomes a `transition-[height]` with `data-starting-style:h-0` and
 *   `data-ending-style:h-0`. Those project keyframes do not exist in this app's
 *   `globals.css`, so carrying them over would have left the panel snapping open
 *   and shut instead of animating.
 * - Presence attributes go from `data-[state=open]` / `data-[state=closed]` to
 *   `data-open` / `data-closed`, and the trigger's open marker is renamed to
 *   `data-panel-open`. `data-open` on the trigger would have been dead CSS.
 *
 * The Trigger is styled for this app's admin sidebar, where a collapsible is a
 * collapsible group header sitting directly on the sidebar surface, so it uses
 * the `--sidebar-*` tokens. Root and Panel stay uncolored on purpose: the panel
 * body is the sidebar menu, which owns its own colors and must not inherit a
 * background from the disclosure.
 */
function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(
        "focus-visible:ring-sidebar-ring text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center transition-colors outline-none focus-visible:ring-2 focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function CollapsiblePanel({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Panel>) {
  return (
    <CollapsiblePrimitive.Panel
      data-slot="collapsible-panel"
      className={cn(
        "h-(--collapsible-panel-height) overflow-hidden transition-[height] data-ending-style:h-0 data-starting-style:h-0",
        className,
      )}
      {...props}
    />
  );
}

export { Collapsible, CollapsiblePanel, CollapsibleTrigger };
