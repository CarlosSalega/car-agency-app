/**
 * The page loader: a square that fills from the bottom with the brand colour.
 *
 * Square because the whole public surface is: no radius anywhere, one hairline
 * border. The fill is **not** the brand colour on purpose: red is the action colour
 * and the error colour here, and a red block growing on screen reads as a warning
 * rather than as "wait a moment". It fills with the foreground instead — neutral,
 * legible and impossible to mistake for a status. It also
 * replaced something louder — a 64px spinning circle with a `ping` ring behind a
 * blurred full-screen overlay — for a navigation that usually lasts a few hundred
 * milliseconds.
 *
 * The text is for screen readers only unless `showLabel` is set: a page loading is
 * something to announce, not something to read twice.
 */
export function SquareLoader({
  label = "Cargando…",
  showLabel = false,
  size = "md",
}: {
  label?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}) {
  const box = size === "md" ? "size-14" : "size-9";

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-4"
    >
      <div
        aria-hidden="true"
        className={`border-line-strong relative overflow-hidden border ${box}`}
      >
        <span className="square-loader__fill bg-foreground absolute inset-x-0 bottom-0 block" />
      </div>

      {showLabel ? (
        <p className="text-muted-foreground m-0 text-sm font-medium">{label}</p>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}
