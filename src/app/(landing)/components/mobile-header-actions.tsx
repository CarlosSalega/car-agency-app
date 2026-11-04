"use client";

import { Menu, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { activeSite } from "@/site/active";

import { useSectionNavigation } from "./site-nav";

/**
 * The mobile header actions: the search and the menu.
 *
 * Both are the same disclosure: a button in the row, a panel under it, and the
 * same ways out — a click anywhere else, or Escape, which also returns focus to
 * the button that opened it. They share one piece of state on purpose: with two
 * independent toggles, opening the menu while the search is open leaves two panels
 * stacked, and that is not a state anyone can want.
 *
 * The press feedback is deliberately small (this control is used occasionally, not
 * hundreds of times a day): the button sinks under the finger, its border takes the
 * brand colour while open, and the icon rotates into an X. `motion-reduce:` turns it
 * all off.
 */

type Panel = "search" | "menu";

export function MobileHeaderActions({
  sections,
}: {
  sections: readonly { label: string; href: string }[];
}) {
  const [open, setOpen] = useState<Panel | null>(null);
  const onNavigate = useSectionNavigation();
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (searchButtonRef.current?.contains(target)) return;
      if (menuButtonRef.current?.contains(target)) return;
      setOpen(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const opener = open === "search" ? searchButtonRef : menuButtonRef;
      setOpen(null);
      opener.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open === "search") inputRef.current?.focus();
  }, [open]);

  const toggle = (panel: Panel) =>
    setOpen((current) => (current === panel ? null : panel));

  const buttonClass = (active: boolean) =>
    `flex size-10 shrink-0 cursor-pointer items-center justify-center border transition-[transform,background-color,border-color] duration-150 ease-out active:scale-95 motion-reduce:transition-none ${
      active
        ? "border-brand bg-accent text-foreground"
        : "border-line-strong text-foreground hover:bg-accent"
    }`;

  return (
    <>
      <div className="ml-auto flex items-center gap-2 xl:hidden">
        <button
          ref={searchButtonRef}
          type="button"
          onClick={() => toggle("search")}
          aria-expanded={open === "search"}
          aria-controls="mobile-panel"
          aria-label={open === "search" ? "Cerrar el buscador" : "Buscar"}
          className={`${buttonClass(open === "search")} md:hidden`}
        >
          <Search
            aria-hidden="true"
            strokeWidth={2}
            className={`absolute size-4 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
              open === "search" ? "scale-75 opacity-0" : "scale-100 opacity-100"
            }`}
          />
          <X
            aria-hidden="true"
            strokeWidth={2}
            className={`size-4 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
              open === "search" ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
          />
        </button>

        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => toggle("menu")}
          aria-expanded={open === "menu"}
          aria-controls="mobile-panel"
          aria-label={open === "menu" ? "Cerrar el menú" : "Abrir el menú"}
          className={buttonClass(open === "menu")}
        >
          <Menu
            aria-hidden="true"
            strokeWidth={2}
            className={`absolute size-4 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
              open === "menu" ? "scale-75 opacity-0" : "scale-100 opacity-100"
            }`}
          />
          <X
            aria-hidden="true"
            strokeWidth={2}
            className={`size-4 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
              open === "menu" ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
          />
        </button>
      </div>

      {open ? (
        <div
          ref={panelRef}
          id="mobile-panel"
          className="border-border bg-background absolute inset-x-0 top-full z-50 border-b xl:hidden"
        >
          {open === "search" ? (
            <div className="p-4">
              <SearchForm id="mobile-search-field" inputRef={inputRef} />
            </div>
          ) : (
            <nav aria-label="Secciones" className="px-4 py-2">
              {sections.map((section) => (
                <a
                  key={section.href}
                  href={`/${section.href}`}
                  onClick={(event) => {
                    setOpen(null);
                    onNavigate(event, section.href.slice(1));
                  }}
                  className="border-border text-subtle-foreground hover:text-foreground flex items-center justify-between border-b py-3.5 font-mono text-[12px] tracking-[0.16em] uppercase transition-colors last:border-b-0"
                >
                  {section.label}
                  <span aria-hidden="true" className="text-brand">
                    →
                  </span>
                </a>
              ))}
            </nav>
          )}
        </div>
      ) : null}
    </>
  );
}

/** The form both headers use, so the behaviour cannot drift between them. */
export function SearchForm({
  id,
  inputRef,
}: {
  id: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <form
      role="search"
      action="/catalogo"
      className="border-line-strong bg-ground focus-within:border-brand flex w-full items-center border transition-colors duration-150 ease-out"
    >
      <label htmlFor={id} className="sr-only">
        Buscar en el catálogo
      </label>
      <input
        ref={inputRef}
        id={id}
        type="search"
        name="q"
        placeholder="Marca, modelo o versión"
        className="text-foreground placeholder:text-muted-foreground h-[38px] w-full min-w-0 flex-1 border-0 bg-transparent px-3 font-sans text-sm focus:outline-none"
      />
      <button
        type="submit"
        className="border-line-strong bg-secondary text-foreground hover:text-brand h-[38px] shrink-0 cursor-pointer border-0 border-l px-3.5 font-mono text-[10px] tracking-[0.16em] uppercase transition-[color,background-color] duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none"
      >
        Buscar
      </button>
    </form>
  );
}
