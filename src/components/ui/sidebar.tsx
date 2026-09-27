"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeftIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * The shadcn `sidebar` block, adapted to this project.
 *
 * **Base UI has no sidebar primitive.** This is a composition over primitives
 * that do exist (`Button`, `Separator`, `Sheet`, `Tooltip`) plus a local context
 * and two CSS custom properties, which is why the block is large. Nothing here
 * is a primitive wrapper.
 *
 * **This is not a copy of the `dash` version.** `dash` is the `base-sera` style
 * with a `taupe` palette; this project keeps its own classes and consumes the
 * `--sidebar-*` tokens already defined in `globals.css`. The composition and the
 * state model follow the block; the styling does not.
 *
 * **Deliberately smaller than the upstream block.** The upstream file exports 25
 * symbols. The admin has six navigation items with no search field, no
 * submenus, no badges and no rail, so only the parts it actually uses are here:
 * provider, sidebar, inset, trigger, header, content, footer, separator, group,
 * group label, menu, menu item, menu button, and the `useSidebar` hook. The
 * omitted parts are `SidebarInput`, `SidebarRail`, `SidebarMenuAction`,
 * `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarMenuSub*`,
 * `SidebarGroupAction` and `SidebarGroupContent`. They can be added from the
 * upstream block when a real need appears.
 *
 * Note the `--radius` reset: this project's `--radius` is `0`, and the block
 * pins it locally so a future radius change does not leak into the sidebar.
 */
const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface SidebarContextValue {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }
  return context;
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);

  const open = openProp ?? internalOpen;

  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const next = typeof value === "function" ? value(open) : value;
      if (onOpenChangeProp) onOpenChangeProp(next);
      else setInternalOpen(next);

      // Persisted so the sidebar keeps its state across reloads.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${next}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [onOpenChangeProp, open],
  );

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile((value) => !value);
    else setOpen((value) => !value);
  }, [isMobile, setOpen]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const state = open ? "expanded" : "collapsed";

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn("group/sidebar-wrapper flex min-h-svh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

function Sidebar({
  side = "left",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right";
  collapsible?: "offcanvas" | "icon" | "none";
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  // On mobile the sidebar becomes a sheet, which is how the admin finally gets
  // navigation below the md breakpoint. The horizontal navigation it replaces
  // was `hidden md:flex`, so there was no mobile nav at all.
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          side={side}
          className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
          style={
            { "--sidebar-width": SIDEBAR_WIDTH_MOBILE } as React.CSSProperties
          }
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navegación del panel</SheetTitle>
            <SheetDescription>
              Muestra la navegación del panel en pantallas pequeñas.
            </SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-side={side}
      data-slot="sidebar"
    >
      {/* Reserves the sidebar's width in the flex row. */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          collapsible === "icon" &&
            "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          "data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]",
          "data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
          "data-[side=left]:border-r data-[side=right]:border-l",
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          // No `[--radius:0]` here. The radius scale resolves to
          // `calc(var(--radius) - Npx)`, so zeroing the variable on this wrapper
          // cascaded to every descendant and turned each `rounded-*` utility into
          // a negative, and therefore invalid, `border-radius` — which the browser
          // drops. The classes were present in the DOM the whole time and rendered
          // square. Any rounding inside the sidebar comes from this variable.
          className="bg-sidebar flex size-full flex-col"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "bg-background relative flex w-full flex-1 flex-col",
        className,
      )}
      {...props}
    />
  );
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">Mostrar u ocultar la navegación</span>
    </Button>
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  );
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("bg-sidebar-border mx-2 w-auto", className)}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn(
        // Horizontal padding is what makes the active item's rounded background
        // readable. A rounded pill flush against the sidebar edge has no visible
        // corners — the clip comes from the sidebar, not from the radius. The
        // shadcn `sidebar` block this layout is derived from insets the active
        // item by ~18px for exactly that reason.
        //
        // Collapsed, the rail is 3rem (48px) and the menu button is `size-8`
        // (32px), so the padding has to be (48 - 32) / 2 = 8px per side. That makes
        // the content box exactly the button width, which centers it. Keeping
        // `px-4` left a 16px box for a 32px button, so it overflowed right and got
        // clipped; dropping to `px-0` fixed that but left a 48px box for a 32px
        // button, so the button hugged the left edge with 16px of dead space on
        // the right. `px-2` is the value that makes the box and the button equal.
        "relative flex w-full min-w-0 flex-col px-4 py-2 group-data-[collapsible=icon]:px-2",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroupLabel({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    render,
    props: mergeProps<"div">(
      {
        className: cn(
          "flex h-8 shrink-0 items-center px-3 text-xs font-semibold tracking-wider text-sidebar-foreground/70 uppercase ring-sidebar-ring outline-hidden transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 focus-visible:ring-2",
          className,
        ),
      } as React.ComponentProps<"div">,
      props,
    ),
  });
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  );
}

const sidebarMenuButtonVariants = cva(
  // The collapsed rail is 3rem (48px): the group insets 8px per side, the button
  // is `size-8` (32px) and its `p-2` leaves a 16px content box, which is exactly
  // the `size-4` icon. `gap-0` collapsed is what makes those two numbers equal.
  // The label span needs no `hidden`: `truncate` gives it `overflow: hidden`, so
  // its automatic minimum size resolves to 0 and it compresses to nothing on its
  // own. The `gap-2` is the part that does NOT compress, and with `justify-center`
  // it pushed the icon (16 - 24) / 2 = 4px left of the rail's center.
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md px-3 py-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      },
      size: {
        default: "h-9 text-sm",
        sm: "h-8 text-xs",
        lg: "h-14 px-3 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function SidebarMenuButton({
  render,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: useRender.ComponentProps<"button"> & {
  isActive?: boolean;
  tooltip?: string | React.ComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const { isMobile, state } = useSidebar();

  const button = useRender({
    defaultTagName: "button",
    render: !tooltip ? render : <TooltipTrigger render={render} />,
    props: mergeProps<"button">(
      {
        className: cn(sidebarMenuButtonVariants({ variant, size }), className),
      } as React.ComponentProps<"button">,
      props,
    ),
    state: { slot: "sidebar-menu-button", active: isActive },
  });

  if (!tooltip) return button;

  const tooltipProps =
    typeof tooltip === "string" ? { children: tooltip } : tooltip;

  return (
    <Tooltip>
      {button}
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltipProps}
      />
    </Tooltip>
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
