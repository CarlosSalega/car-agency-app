"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Section navigation without hashes.
 *
 * The header links used to be plain anchors (`#pago`). On `/` they worked; on
 * `/catalogo` —or any other route— they did nothing and left a `#pago` in the URL
 * that points at an element the page does not have. Both halves of that are wrong.
 *
 * So the click is intercepted: on the landing it scrolls, elsewhere it navigates
 * home first and scrolls once the landing is mounted, and **the hash never reaches
 * the address bar**. The target travels in a module variable, which is enough
 * because there is exactly one of these pending at a time.
 *
 * `block: "start"` plus `scroll-mt` on the sections keeps the sticky header from
 * covering the heading, and the smooth behaviour is skipped for whoever asked the
 * system for reduced motion.
 */

let pendingTarget: string | null = null;

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({
    behavior: reduced ? "auto" : "smooth",
    block: "start",
  });
}

export function useSectionNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  // Al volver a la landing desde otra ruta, scrollear al destino pendiente una vez
  // que el DOM existe. El `rAF` cubre el frame en el que react acaba de montar.
  useEffect(() => {
    if (!pendingTarget || pathname !== "/") return;

    const id = pendingTarget;
    pendingTarget = null;

    const frame = requestAnimationFrame(() => scrollToSection(id));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();

    if (pathname === "/") {
      scrollToSection(id);
      return;
    }

    pendingTarget = id;
    router.push("/");
  };
}

export function SiteNav({
  sections,
}: {
  sections: readonly { label: string; href: string }[];
}) {
  const onNavigate = useSectionNavigation();

  return (
    <nav aria-label="Secciones" className="hidden gap-6 xl:flex">
      {sections.map((section) => (
        <a
          key={section.href}
          href={`/${section.href}`}
          onClick={(event) => onNavigate(event, section.href.slice(1))}
          /* Subrayado de marca: crece desde la izquierda en 200ms. Es la única
             animación del nav, y respeta `motion-reduce`. */
          className="text-muted-foreground hover:text-foreground after:bg-brand relative py-2 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:transition-transform after:duration-200 after:ease-out hover:after:scale-x-100 motion-reduce:after:transition-none"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
