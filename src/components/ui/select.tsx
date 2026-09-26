"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Migrated from `@radix-ui/react-select`.
 *
 * Part renames: `Viewport` becomes `List`, `ScrollUpButton` /
 * `ScrollDownButton` become `ScrollUpArrow` / `ScrollDownArrow`, and `Label`
 * becomes `GroupLabel`. `Content` becomes `Portal > Positioner > Popup`, with
 * positioning props on the `Positioner`.
 *
 * `position` is kept in the public API and translated to Base UI's boolean
 * `alignItemWithTrigger`: `"popper"` becomes `true` and `"item-aligned"`
 * becomes `false`. The wrapper's classes branch on `position`, so dropping the
 * prop would change the rendered result for no benefit. No consumer in this
 * project passes it, so the default applies throughout.
 *
 * The CSS custom properties are renamed per the skill:
 * `--radix-select-content-transform-origin` becomes `--transform-origin`,
 * `--radix-select-content-available-height` becomes `--available-height`,
 * `--radix-select-trigger-width` becomes `--anchor-width` and
 * `--radix-select-trigger-height` becomes `--anchor-height`.
 */
/**
 * Base UI types `Select.Root` generically, so `onValueChange` receives
 * `SelectValueType<Value> | null` instead of Radix's inferred value. Making the
 * wrapper generic is what preserves the call-site typing the project had with
 * Radix; without it every `onValueChange` handler would receive `unknown`.
 */
function Select<Value, Multiple extends boolean | undefined = false>(
  props: React.ComponentProps<typeof SelectPrimitive.Root<Value, Multiple>>,
) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default";
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input data-placeholder:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-10 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={<ChevronDownIcon className="size-4 opacity-50" />}
      />
    </SelectPrimitive.Trigger>
  );
}

/** Positioning props live on the `Positioner`; declared, destructured and
 * forwarded explicitly so they cannot fall through onto the `Popup`. */
type SelectPositioningProps = Pick<
  React.ComponentProps<typeof SelectPrimitive.Positioner>,
  "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
>;

function SelectContent({
  className,
  children,
  position = "popper",
  align = "start",
  sideOffset = 0,
  collisionPadding = 8,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Popup> &
  SelectPositioningProps & {
    position?: "popper" | "item-aligned";
  }) {
  const alignItemWithTrigger = position === "popper";

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-h-(--available-height) max-w-[calc(100vw-1rem)] min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md transition-[opacity,scale] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            alignItemWithTrigger &&
              "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List
            className={cn(
              "p-1",
              alignItemWithTrigger &&
                "h-(--anchor-height) w-full min-w-(--anchor-width) scroll-my-1",
            )}
          >
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.GroupLabel>) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-primary focus:text-background [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="focus:text-background size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
