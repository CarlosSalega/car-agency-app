/**
 * The star row and the initials avatar, shared by the public section.
 *
 * No `"use client"` on purpose: both are pure markup, so the server-rendered
 * section and the client card can use the same component and the markup cannot
 * diverge between them.
 */

function PartialStar({ fill }: { fill: number }) {
  return (
    <span className="relative inline-block leading-none" aria-hidden="true">
      <span className="text-subtle-foreground">★</span>
      <span
        className="text-warning absolute inset-0 overflow-hidden"
        style={{ width: `${fill * 100}%` }}
      >
        ★
      </span>
    </span>
  );
}

export function Stars({
  rating,
  size = "sm",
  lastStarFill = 1,
  ariaLabel,
}: {
  rating: number;
  size?: "sm" | "lg";
  lastStarFill?: number;
  /**
   * Overrides the announcement. The Google badge draws five filled stars for a
   * 4.9 average, so the default label would tell a screen reader "5 de 5" next
   * to the number 4.9 — the number is displayed, so the label has to match it.
   */
  ariaLabel?: string;
}) {
  const sz = size === "lg" ? "text-2xl" : "text-sm";

  return (
    <div
      role="img"
      className={`flex gap-0.5 ${sz}`}
      aria-label={ariaLabel ?? `Calificación: ${rating} de 5`}
    >
      {[1, 2, 3, 4, 5].map((s) => {
        if (s < rating) {
          return (
            <span key={s} className="text-warning">
              ★
            </span>
          );
        }
        if (s === rating && lastStarFill < 1) {
          return <PartialStar key={s} fill={lastStarFill} />;
        }
        return (
          <span key={s} className="text-subtle-foreground">
            ★
          </span>
        );
      })}
    </div>
  );
}

/** The initials fallback, monochrome on purpose: six hues fought the brand. */
export function Avatar({ initials }: { initials: string }) {
  return (
    <div className="bg-accent text-foreground flex size-10 items-center justify-center rounded-full text-sm font-bold">
      {initials}
    </div>
  );
}

/**
 * Initials from a full name, taking the first letter of the first and last word.
 *
 * Derived instead of stored: a column for "DL" is a column that goes stale the
 * moment somebody fixes a typo in the name.
 */
export function initialsFor(authorName: string): string {
  const words = authorName.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}
