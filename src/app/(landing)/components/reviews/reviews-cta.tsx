"use client";

import { useScrollAnimation } from "../../hooks/useScrollAnimation";

import { GOOGLE_REVIEW_URL } from "./review-google";

import { GoogleLogo } from "../ui/GoogleLogo";

/**
 * The call to action under the grid.
 *
 * It survives with zero reviews because it is not about our reviews at all: it
 * asks a customer to leave one on Google. The grid is what disappears when there
 * is nothing published.
 */
export function ReviewsCta() {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>({
    rootMargin: "0px 0px -100px 0px",
  });

  return (
    <div
      ref={ref}
      className={`mt-12 flex flex-col items-center gap-3 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
      }`}
    >
      <p className="text-muted-foreground text-center text-base">
        ¿Ya compraste o vendiste con nosotros? <br /> Contanos tu experiencia
      </p>

      <a
        href={GOOGLE_REVIEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-14 w-full max-w-sm items-center justify-center gap-2.5 rounded-lg px-6 font-bold tracking-widest whitespace-nowrap uppercase transition-all hover:scale-105 active:scale-95"
      >
        <GoogleLogo className="size-4" />
        <span className="text-xs md:text-base">Dejá tu reseña en Google</span>
      </a>
    </div>
  );
}
