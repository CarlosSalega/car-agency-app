"use client";

import { useEffect, useRef } from "react";

/**
 * A dropdown built on `<details>`, with the two behaviours the native element does
 * not have.
 *
 * `<details>` gives us open/close, keyboard support and a `summary` that is a real
 * button — for free, and without JavaScript. What it does not give is closing when
 * the visitor clicks somewhere else, or on Escape. Those are the two things this
 * wrapper adds, and nothing else: the state stays in the DOM, so the menu still
 * works with the script blocked.
 *
 * The panel's width is the other half of the problem this solves. On a phone a
 * fixed `w-80` panel anchored to the right of its summary runs off the screen, so
 * here the panel spans its row on small screens and becomes a dropdown from `md`
 * up — which is why `FilterMenu` sets `md:relative` and the caller positions the
 * row.
 */
export function FilterMenu({
  summary,
  children,
  summaryClassName,
  panelClassName,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  summaryClassName?: string;
  panelClassName?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const close = () => {
      element.open = false;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!element.open) return;
      if (element.contains(event.target as Node)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!element.open || event.key !== "Escape") return;
      close();
      element.querySelector("summary")?.focus();
    };

    // Elegir una opción cierra el menú: en mobile el panel mide el ancho de la fila
    // y quedaría tapando los resultados.
    const onClick = (event: MouseEvent) => {
      if (!element.open) return;
      if (!(event.target as HTMLElement).closest("a")) return;
      close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    element.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      element.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <details ref={ref} className="md:relative">
      <summary
        className={
          summaryClassName ??
          "border-line-strong text-subtle-foreground hover:border-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 border px-2.5 py-1.5 font-mono text-[11px] tracking-[0.04em] transition-colors [&::-webkit-details-marker]:hidden"
        }
      >
        {summary}
      </summary>
      <div
        className={
          panelClassName ??
          "border-line-strong bg-card absolute inset-x-0 top-[calc(100%+6px)] z-30 border md:inset-x-auto md:right-0"
        }
      >
        {children}
      </div>
    </details>
  );
}
