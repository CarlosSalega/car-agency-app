"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The mobile search: the lupa button and the panel it unfolds.
 *
 * It is a component instead of a `<details>` because the behaviour asked for is
 * exactly what a native disclosure does not give: closing when the visitor clicks
 * anywhere else, Escape, and focus returning to the button. Those need state.
 *
 * The micro-interaction is deliberately small, because this control is used
 * occasionally, not hundreds of times a day: the button sinks a little under the
 * finger (`scale(0.95)` on press, 120ms, ease-out), and the icon rotates into an X
 * while the border takes the brand colour. No animation on the panel itself — it
 * appears with the interaction, which is the feedback.
 *
 * `motion-reduce:` turns every transition off for whoever asks the system for it.
 */

export function MobileSearchToggle() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cerrar al hacer click en cualquier lado que no sea el botón o el panel: el
  // espacio en blanco del header, el resto de la página, lo que sea.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Al abrir, el cursor va al campo: abrir y después tener que tocar el input es
  // un paso de más.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="site-search-mobile"
        aria-label={open ? "Cerrar el buscador" : "Buscar en el catálogo"}
        className={`ml-auto flex size-10 shrink-0 cursor-pointer items-center justify-center border transition-[transform,background-color,border-color] duration-150 ease-out active:scale-95 motion-reduce:transition-none md:hidden ${
          open
            ? "border-brand bg-accent text-foreground"
            : "border-line-strong text-foreground hover:bg-accent"
        }`}
      >
        <Search
          aria-hidden="true"
          strokeWidth={2}
          className={`absolute size-4 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
            open ? "scale-75 opacity-0" : "scale-100 opacity-100"
          }`}
        />
        <X
          aria-hidden="true"
          strokeWidth={2}
          className={`size-4 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ${
            open ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        />
      </button>

      {open ? (
        <div
          ref={panelRef}
          id="site-search-mobile"
          className="border-border bg-background absolute inset-x-0 top-full z-50 border-b p-4 md:hidden"
        >
          <SearchForm id="site-search-mobile-field" inputRef={inputRef} />
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
