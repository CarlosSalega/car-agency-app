"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Migrated from `@radix-ui/react-dialog`, which is what the Radix sheet was
 * built on.
 *
 * `Overlay` becomes `Backdrop` and `Content` becomes `Popup`. The sheet stays
 * CSS-anchored rather than moving to a `Positioner`, because the existing
 * implementation positions with `fixed` plus explicit dimensions
 * (`w-3/4 sm:max-w-sm`) and switching to anchor-based sizing would change the
 * rendered width.
 *
 * The slide animations were restated as `data-starting-style` /
 * `data-ending-style` transitions with an explicit translate per side, which is
 * how Base UI expresses enter and exit. The `slide-in-from-*` /
 * `slide-out-to-*` keyframe utilities are not translated one to one on purpose.
 */
function XRoundedIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Backdrop>) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Popup> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "bg-background fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-ending-style:duration-300 data-starting-style:duration-500",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-ending-style:translate-x-full data-starting-style:translate-x-full sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-ending-style:-translate-x-full data-starting-style:-translate-x-full sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-ending-style:-translate-y-full data-starting-style:-translate-y-full",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-ending-style:translate-y-full data-starting-style:translate-y-full",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-open:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XRoundedIcon className="size-4" />
          <span className="sr-only">Cerrar</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  XRoundedIcon,
};
