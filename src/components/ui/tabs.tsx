"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Migrated from `@radix-ui/react-tabs`.
 *
 * Part renames: `Trigger` becomes `Tab` and `Content` becomes `Panel`.
 *
 * Two class rewrites were required, not just the part renames:
 * - `data-[state=active]:` becomes `data-active:`.
 * - Base UI surfaces the tab's disabled state through `aria-disabled` rather
 *   than the `disabled` attribute, so `disabled:opacity-50` would have been
 *   dead code and is now `aria-disabled:opacity-50`.
 */
const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-lg p-1",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Tab>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Tab>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Tab
    ref={ref}
    className={cn(
      "ring-offset-background focus-visible:ring-ring data-active:bg-primary data-active:text-background inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none aria-disabled:opacity-50 data-active:shadow",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Tab.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Panel>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Panel>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Panel
    ref={ref}
    className={cn(
      "ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Panel.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
