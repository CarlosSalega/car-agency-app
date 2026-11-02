import Link from "next/link";

import { activeSite } from "@/site/active";

/**
 * The public header.
 *
 * Three decisions worth keeping:
 *
 * 1. **The search is always visible.** It is a plain `GET` form to `/catalogo`, so
 *    it works without JavaScript, it is shareable, and the browser's back button
 *    behaves. Its own row below the breakpoint, never hidden behind an icon.
 * 2. **No client identity in this file.** The name and the WhatsApp link come from
 *    `activeSite`; `src/site/__tests__/brand-leak.test.ts` fails if a literal
 *    appears here.
 * 3. **Square corners and one hairline.** No radius, no shadow: the header is
 *    separated from the page by a 1px border, which is the whole visual system of
 *    the redesign.
 *
 * The nav targets are anchors on the landing, not routes, because everything but
 * the catalog lives on one page now.
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
      <div className="mx-auto flex min-h-[62px] w-full max-w-[1320px] flex-wrap items-center gap-x-5 gap-y-2 px-7 py-2">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <i aria-hidden="true" className="bg-brand block size-2.5" />
          <span className="text-base font-black tracking-[0.3em] whitespace-nowrap uppercase">
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

        <form
          role="search"
          action="/catalogo"
          className="border-line-strong bg-ground focus-within:border-brand ml-auto flex min-w-[170px] flex-1 basis-[220px] items-center border transition-colors max-md:order-3 max-md:ml-0 max-md:flex-none max-md:basis-full lg:max-w-[400px]"
        >
          <input
            type="search"
            name="q"
            aria-label="Buscar en el catálogo"
            placeholder="Marca, modelo o versión"
            className="text-foreground placeholder:text-muted-foreground h-[38px] w-full min-w-0 flex-1 border-0 bg-transparent px-3 font-sans text-sm focus:outline-none"
          />
          <button
            type="submit"
            className="border-line-strong bg-secondary text-foreground hover:text-brand h-[38px] shrink-0 cursor-pointer border-0 border-l px-3.5 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors"
          >
            Buscar
          </button>
        </form>

        <a
          href={whatsapp.href}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-brand hover:bg-brand/90 flex h-11 shrink-0 items-center justify-center px-5 font-mono text-[11px] font-bold tracking-[0.16em] whitespace-nowrap text-black uppercase transition-colors"
        >
          WhatsApp
        </a>
      </div>
    </header>
  );
}
