"use client";

import { Menu } from "@base-ui/react/menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Migrated from `@radix-ui/react-dropdown-menu` to `@base-ui/react/menu`.
 *
 * The rename plus the restructure:
 * - `Content` becomes `Portal > Positioner > Popup`, and the positioning props
 *   (`side`, `sideOffset`, `align`, `alignOffset`, `collisionPadding`) live on
 *   the `Positioner`.
 * - `Label` becomes `GroupLabel`.
 * - `ItemIndicator` becomes `CheckboxItemIndicator` / `RadioItemIndicator`.
 * - `Sub` becomes `SubmenuRoot` and `SubTrigger` becomes `SubmenuTrigger`.
 * - `SubContent` is rebuilt from the same `Portal > Positioner > Popup` chain.
 *
 * The public export names are unchanged, so consumers keep importing the same
 * symbols.
 *
 * The two CSS custom properties are renamed per the skill:
 * `--radix-dropdown-menu-content-transform-origin` becomes `--transform-origin`
 * and `--radix-dropdown-menu-content-available-height` becomes
 * `--available-height`. Presence attributes go from `data-[state=open]` to
 * `data-open`, and the keyframe enter/exit utilities are restated as
 * `data-starting-style` / `data-ending-style` transitions.
 */
function DropdownMenu({ ...props }: React.ComponentProps<typeof Menu.Root>) {
  return <Menu.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof Menu.Portal>) {
  return <Menu.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof Menu.Trigger>) {
  return <Menu.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

/**
 * Positioning props live on Base UI's `Positioner`, not on the `Popup`. They are
 * declared here and explicitly destructured and forwarded below, per the skill's
 * "Pick means FORWARD" rule: without the explicit forward they would fall
 * through `...props` onto the Popup and positioning would break silently with no
 * type error.
 */
type MenuPositioningProps = Pick<
  React.ComponentProps<typeof Menu.Positioner>,
  "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
>;

function DropdownMenuContent({
  className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  collisionPadding = 8,
  ...props
}: React.ComponentProps<typeof Menu.Popup> & MenuPositioningProps) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 max-h-(--available-height) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md transition-[opacity,scale] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof Menu.Group>) {
  return <Menu.Group data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof Menu.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-primary focus:text-background data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:text-destructive! [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof Menu.CheckboxItem>) {
  return (
    <Menu.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <Menu.CheckboxItemIndicator>
          <CheckIcon className="size-4" />
        </Menu.CheckboxItemIndicator>
      </span>
      {children}
    </Menu.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof Menu.RadioGroup>) {
  return <Menu.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <Menu.RadioItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </Menu.RadioItemIndicator>
      </span>
      {children}
    </Menu.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof Menu.GroupLabel> & {
  inset?: boolean;
}) {
  return (
    <Menu.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-inset:pl-8",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Menu.Separator>) {
  return (
    <Menu.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof Menu.SubmenuRoot>) {
  return <Menu.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof Menu.SubmenuTrigger> & {
  inset?: boolean;
}) {
  return (
    <Menu.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-popup-open:bg-accent data-popup-open:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </Menu.SubmenuTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  side = "right",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  collisionPadding = 8,
  ...props
}: React.ComponentProps<typeof Menu.Popup> & MenuPositioningProps) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={collisionPadding}
        className="isolate z-50"
      >
        <Menu.Popup
          data-slot="dropdown-menu-sub-content"
          className={cn(
            "bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 min-w-32 origin-(--transform-origin) overflow-hidden rounded-md border p-1 shadow-lg transition-[opacity,scale] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
