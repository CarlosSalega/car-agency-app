"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Base UI has no Label primitive. Radix's `Label.Root` only forwards props to a
 * `<label>`, so the native element is the direct equivalent and drops the
 * primitive dependency entirely.
 *
 * The classes are unchanged, so the rendered result is identical.
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
