"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Replaces `@radix-ui/react-breadcrumb`.
 *
 * There is a deviation from the usual migration story here, and it is not a
 * style choice: **Base UI 1.8.0 ships no breadcrumb primitive at all.** There
 * is no `breadcrumb` subpath and no mention of "breadcrumb" anywhere in the
 * package. So the wrapper is built on the same native elements Radix's
 * breadcrumb rendered underneath (`nav`, `ol`, `li`, `a`, `span`), which
 * removes the Radix dependency without inventing an abstraction.
 *
 * `BreadcrumbLink` is the one part that genuinely needed Base UI. Radix's
 * version used `Slot.Root` + `asChild` so a caller could swap the `<a>` for a
 * framework router link. Base UI's equivalent for a non-button polymorphic
 * component is `useRender` + `mergeProps` with a `render` prop, per the
 * migration skill. `render` replaces `asChild` outright; keeping `asChild` as
 * an alias would let un-migrated call sites keep compiling and would hide the
 * migration from the type checker.
 *
 * Note the cast on the object literal passed to `mergeProps`. `data-*` keys are
 * only special-cased in JSX, so an object literal containing them fails excess
 * property checking against `mergeProps`' parameter type without the cast.
 *
 * Colors are the plain foreground/muted tokens: a breadcrumb is page chrome, so
 * no part here sits on the sidebar surface.
 */
function Breadcrumb({ ...props }: React.ComponentProps<"nav">) {
  return <nav data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5",
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  );
}

/**
 * The polymorphic part. `render` accepts an element or a function, so a router
 * link composes by passing `render={<NextLink href="..." />}` instead of the old
 * `asChild` wrapping a child.
 */
function BreadcrumbLink({
  className,
  render,
  ...props
}: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    render,
    props: mergeProps<"a">(
      {
        "data-slot": "breadcrumb-link",
        className: cn("hover:text-foreground transition-colors", className),
      } as React.ComponentProps<"a">,
      props,
    ),
  });
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      // The current page is the one crumb that must not read as a link, so it
      // breaks out of the muted ancestor color. Not a link, so no `aria-current`
      // is needed here; the `li` owner marks the current page.
      className={cn("text-foreground font-normal", className)}
      {...props}
    />
  );
}

function BreadcrumbItemSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <ChevronRightIcon />}
    </li>
  );
}

function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn("flex items-center", className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">Más</span>
    </span>
  );
}

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbItemSeparator,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
};
