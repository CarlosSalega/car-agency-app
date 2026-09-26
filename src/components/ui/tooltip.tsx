"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Migrated from `@radix-ui/react-tooltip`.
 *
 * `Content` becomes `Portal > Positioner > Popup`, and the positioning props
 * move onto the `Positioner` (`side`, `sideOffset`, `align`, `alignOffset`,
 * `collisionPadding`). Radix's `Content` also had a `sideOffset` default of `0`;
 * this wrapper uses `4` so the popup clears the trigger, which is the Base UI
 * registry default.
 *
 * Provider props are renamed rather than removed: `delayDuration` becomes
 * `delay`, and Base UI adds `closeDelay` and `timeout` (how long after one
 * tooltip closes an adjacent one may still open instantly).
 *
 * The open marker goes from `data-[state=open]` to `data-open` on the popup,
 * and the enter/exit keyframes are restated as `data-starting-style` /
 * `data-ending-style` transitions.
 *
 * Every part is exported individually so callers can compose instead of going
 * through a fixed-shape `TooltipContent`: the sidebar's `SidebarMenuButton`
 * builds its own `Trigger > Content` pair and needs to keep control of both.
 * The `Arrow` is intentionally not rendered by `TooltipContent` — adding it
 * unconditionally would change the popup's padding for callers that never
 * wanted an arrow.
 *
 * Nothing here uses the `--sidebar-*` tokens: the trigger is transparent and
 * lets the button it wraps own the sidebar surface colors, and the popup is a
 * floating overlay, not sidebar surface.
 */
function TooltipProvider({
  delay = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />;
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props} />;
}

function TooltipTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

function TooltipPortal({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Portal>) {
  return <TooltipPrimitive.Portal {...props} />;
}

/**
 * Positioning props live on Base UI's `Positioner`, not on the `Popup`. They are
 * declared and explicitly forwarded below: without the explicit forward they
 * would fall through `...props` onto the Popup and positioning would break with
 * no type error to catch it.
 */
type TooltipPositioningProps = Pick<
  React.ComponentProps<typeof TooltipPrimitive.Positioner>,
  "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
>;

function TooltipContent({
  className,
  side = "top",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  collisionPadding = 8,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Popup> &
  TooltipPositioningProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "bg-popover text-popover-foreground z-50 max-w-xs origin-(--transform-origin) rounded-sm border px-3 py-1.5 text-xs shadow-md transition-[opacity,scale] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

/**
 * Positioned with explicit per-side offsets plus a translate, not with a
 * rotation, so the arrow keeps the popup's border radius and fill.
 */
function TooltipArrow({
  className,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Arrow>) {
  return (
    <TooltipPrimitive.Arrow
      data-slot="tooltip-arrow"
      className={cn(
        "fill-popover data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=left]:right-[-13px] data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:left-[-13px] data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5",
        className,
      )}
      {...props}
    />
  );
}

export {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
  type TooltipPositioningProps,
};
