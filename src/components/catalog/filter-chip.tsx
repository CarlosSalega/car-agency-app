import Link from "next/link";

import { toggleFacet } from "@/lib/catalog/filter-url";

/**
 * A filter chip.
 *
 * It is a `<Link>`, not a button: the URL is the state, so the same markup works
 * without JavaScript, can be opened in a new tab and survives the back button.
 * The active state is `aria-current`, which is what a screen reader needs and also
 * what the styles hook into.
 *
 * Square, 1px border, and the active chip is filled with the brand colour — the
 * only filled element in the bar, which is what makes "what is applied" legible at
 * a glance.
 */

interface FilterChipProps {
  label: string;
  /** The facet this chip belongs to, e.g. `type`. */
  facet: string;
  /** The value; empty means "todos". */
  value: string;
  active?: boolean;
  params: URLSearchParams;
}

export function FilterChip({
  label,
  facet,
  value,
  active = false,
  params,
}: FilterChipProps) {
  return (
    <Link
      href={toggleFacet(params, facet, value)}
      aria-current={active ? "true" : undefined}
      className={`border px-2.5 py-1.5 font-mono text-[11px] tracking-[0.04em] whitespace-nowrap transition-colors ${
        active
          ? "border-brand bg-brand text-foreground font-bold"
          : "border-line-strong text-subtle-foreground hover:border-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

/** A group: a small label and its chips, wrapping on wide screens. */
export function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex shrink-0 snap-start items-center gap-3 md:shrink">
      <span className="text-muted-foreground shrink-0 font-mono text-[10px] tracking-[0.16em] uppercase">
        {label}
      </span>
      <div className="flex gap-1.5">{children}</div>
    </div>
  );
}
