import Link from "next/link";

import { activeSite } from "@/site/active";

import { MobileSearchToggle, SearchForm } from "./site-search";

/**
 * The public header.
 *
 * Four decisions worth keeping:
 *
 * 1. **The search is always reachable, never a dead bar at 320px.** On desktop it
 *    is a plain `GET` form to `/catalogo`; on mobile the row is
 *    `logo — espacio — botón de lupa`, and the form unfolds underneath it. That
 *    keeps the header one line tall on a phone, which is the whole 320px budget.
 * 2. **The mobile toggle is the one client component here.** Closing on an outside
 *    click, on Escape, and focusing the field are state, not markup; the desktop
 *    bar stays a server-rendered form that works without JavaScript.
 * 3. **The WhatsApp button is desktop-only.** On a phone the floating button
 *    already covers it; a second red block in the header is noise that costs the
 *    width the search needs.
 * 4. **No client identity in this file.** The name and the links come from
 *    `activeSite`; `src/site/__tests__/brand-leak.test.ts` fails otherwise.
 */

const SECTIONS = [
  { label: "Ingresos", href: "#ingresos" },
  { label: "Por qué", href: "#porque" },
  { label: "Formas de pago", href: "#pago" },
  { label: "Reseñas", href: "#resenas" },
  { label: "Contacto", href: "#contacto" },
] as const;

export function SiteHeader() {
  const { identity, whatsapp } = activeSite;

  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="relative mx-auto flex min-h-[56px] w-full max-w-[1320px] items-center gap-2 px-4 py-2 md:min-h-[62px] md:gap-5 md:px-7">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80 md:gap-2.5"
        >
          <i aria-hidden="true" className="bg-brand block size-2 md:size-2.5" />
          <span className="text-[13px] font-black tracking-[0.24em] whitespace-nowrap uppercase md:text-base md:tracking-[0.3em]">
            {identity.name}
          </span>
        </Link>

        <nav aria-label="Secciones" className="hidden gap-5 lg:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="text-muted-foreground hover:text-foreground py-1 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors"
            >
              {section.label}
            </a>
          ))}
        </nav>

        {/* Desktop: la barra vive en la fila. */}
        <div className="ml-auto hidden w-full max-w-[400px] flex-1 basis-[220px] md:block">
          <SearchForm id="site-search" />
        </div>

        <a
          href={whatsapp.href}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-brand hover:bg-brand/90 hidden h-11 shrink-0 items-center justify-center px-5 font-mono text-[11px] font-bold tracking-[0.16em] whitespace-nowrap text-black uppercase transition-colors md:flex"
        >
          WhatsApp
        </a>

        {/* Mobile: logo — espacio — lupa. El panel y el cierre por click viven
            en el componente cliente. */}
        <MobileSearchToggle />
      </div>
    </header>
  );
}
