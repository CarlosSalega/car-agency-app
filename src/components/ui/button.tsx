import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",

        success:
          "bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success/30",

        info: "bg-info text-info-foreground hover:bg-info/90 focus-visible:ring-info/30",

        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning/30",

        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30",

        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",

        outline:
          "border border-border bg-background text-foreground hover:bg-transparent hover:text-accent-foreground hover:shadow-md",

        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-md",

        link: "text-primary underline-offset-4 hover:underline",
      },

      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Migrated from the Radix `Slot` / `asChild` idiom to `@base-ui/react/button`.
 *
 * Base UI's Button accepts a `render` prop natively, so no `useRender` wrapper
 * is needed. The `asChild` prop is intentionally gone rather than kept as an
 * alias: keeping it would let un-migrated call sites keep compiling, which hides
 * the migration from the type checker.
 *
 * **`nativeButton` is derived from `render`.** Base UI's Button defaults
 * `nativeButton` to `true` and logs a console error when the rendered element is
 * not a real `<button>`, because claiming button semantics on an anchor breaks
 * form submission and assistive technology. Every call site that renders a
 * `next/link` through `render` hit that warning.
 *
 * Deriving it here rather than passing `nativeButton={false}` at each call site
 * fixes all of them at once and keeps future `render` call sites correct by
 * default. An explicit `nativeButton` still wins.
 */
function Button({
  className,
  variant,
  size,
  render,
  nativeButton,
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> &
  VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={nativeButton ?? !render}
      render={render}
      {...props}
    />
  );
}

export { Button, buttonVariants };
