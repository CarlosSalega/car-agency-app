import { SquareLoader } from "@/components/ui/square-loader";
import { activeSite } from "@/site/active";
import Image from "next/image";

/**
 * The global loading state.
 *
 * It carries a **skeleton of the header** — the real logo, placeholder bars where
 * the nav, the search and the call to action go — for two reasons:
 *
 * 1. The header lives inside each page, not in a shared layout, so navigating
 *    unmounts it and mounts it again. A blank screen with a loader in the middle
 *    makes the brand blink; keeping the logo in place hides that.
 * 2. The placeholders are the real heights, so when the page arrives nothing moves.
 *
 * They are not the real controls: a nav link here would point at a section that
 * does not exist yet, and a search box would search a page that is still loading.
 * Grey blocks say "coming" without lying.
 *
 * It is a flow container, not a `fixed inset-0` overlay with `backdrop-blur`:
 * blocking and blurring the whole page for a navigation that lasts a few hundred
 * milliseconds makes the wait feel longer.
 */

export default function GlobalLoading() {
  const { assets, identity } = activeSite;

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border bg-background border-b">
        <div className="mx-auto flex min-h-[56px] w-full max-w-[1320px] items-center gap-2 px-4 py-2 md:min-h-[68px] md:gap-6 md:px-8 xl:gap-8">
          <Image
            src={assets.wordmark.src}
            alt={identity.name}
            width={assets.wordmark.width}
            height={assets.wordmark.height}
            className="h-4 w-auto opacity-70 md:h-5"
            preload
          />

          {/* Nav: cinco etiquetas, sólo en escritorio. */}
          <div aria-hidden="true" className="ml-4 hidden gap-6 xl:flex">
            {[68, 52, 40, 64, 56].map((width) => (
              <span
                key={width}
                className="bg-surface h-2.5"
                style={{ width }}
              />
            ))}
          </div>

          <div
            aria-hidden="true"
            className="ml-auto hidden items-center gap-4 md:flex"
          >
            <span className="border-line-strong h-[38px] w-full max-w-[340px] min-w-[200px] border" />
            <span className="bg-surface h-11 w-[107px]" />
          </div>

          {/* Acciones de mobile: dos cuadrados del tamaño de los botones. */}
          <div
            aria-hidden="true"
            className="ml-auto flex items-center gap-2 xl:hidden"
          >
            <span className="border-line-strong size-10 border md:hidden" />
            <span className="border-line-strong size-10 border" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center">
        <SquareLoader />
      </div>
    </div>
  );
}
