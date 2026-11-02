"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { CarCard } from "@/components/cars/car-card";
import type { getPublicLatestCars } from "@/lib/queries/cars";
import Link from "next/link";

type Car = Awaited<ReturnType<typeof getPublicLatestCars>>[number];

interface LatestCarsSliderProps {
  cars: Car[];
}

export function LatestCarsSlider({ cars }: LatestCarsSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const keyboardHelpId = "latest-cars-slider-help";
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Drag state
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  const scrollByDirection = useCallback((direction: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    const cardEl = el.querySelector<HTMLElement>("[data-car-slide]");
    const cardWidth = cardEl ? cardEl.offsetWidth + 24 : 340;
    el.scrollBy({
      left: direction === "left" ? -cardWidth : cardWidth,
      behavior: "smooth",
    });
  }, []);

  // ── Keyboard navigation ───────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only capture when section is focused/hovered or no other input is active
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!isFocused) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollByDirection("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollByDirection("right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFocused, scrollByDirection]);

  // ── Drag to scroll ────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    const el = trackRef.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    trackRef.current.scrollLeft = scrollLeftRef.current - (x - startX.current);
  };

  const stopDrag = () => {
    isDragging.current = false;
  };

  return (
    <section
      ref={sectionRef}
      id="stock"
      className="bg-background relative w-full overflow-hidden py-20 pb-32"
      tabIndex={0}
      aria-label="Últimos ingresos"
      aria-describedby={keyboardHelpId}
      onMouseEnter={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <p id={keyboardHelpId} className="sr-only">
        Usá las flechas izquierda y derecha para desplazarte por los autos.
      </p>
      {/* Subtle top border accent */}
      <div className="absolute inset-x-0 top-0 h-px bg-white/10" />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className={`mb-10 flex items-end justify-between px-4 transition-all duration-700 md:px-10 ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-bold tracking-[0.3em] uppercase">
            Recién llegados
          </span>
          <h2 className="text-foreground text-4xl leading-none font-black tracking-tighter uppercase italic md:text-5xl">
            Últimos <span className="text-brand">Ingresos</span>
          </h2>
        </div>

        {/* Arrow buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => scrollByDirection("left")}
            disabled={!canScrollLeft}
            aria-label="Anterior"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20 active:scale-95 disabled:cursor-default disabled:opacity-25 disabled:hover:scale-100 disabled:hover:bg-white/10"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scrollByDirection("right")}
            disabled={!canScrollRight}
            aria-label="Siguiente"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20 active:scale-95 disabled:cursor-default disabled:opacity-25 disabled:hover:scale-100 disabled:hover:bg-white/10"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* ── Viewport ───────────────────────────────────────────── */}
      <div className="relative">
        {/* Left fade */}
        <div
          className={`from-background pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-linear-to-r to-transparent transition-opacity duration-300 md:w-20 ${
            canScrollLeft ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Right fade */}
        <div
          className={`from-background pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-linear-to-l to-transparent transition-opacity duration-300 md:w-20 ${
            canScrollRight ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Track */}
        <div
          ref={trackRef}
          className="flex [scroll-snap-type:x_mandatory] gap-6 overflow-x-auto px-4 pb-4 [scrollbar-width:none] md:px-10 [&::-webkit-scrollbar]:hidden"
          style={{ cursor: isDragging.current ? "grabbing" : "grab" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
        >
          {cars.map((car, i) => (
            <div
              key={car.id}
              data-car-slide
              className={`[scroll-snap-start] w-[clamp(260px,78vw,320px)] shrink-0 transition-all duration-700 sm:w-[clamp(280px,40vw,320px)] lg:w-[clamp(280px,22vw,320px)] ${
                mounted
                  ? "translate-y-0 opacity-100"
                  : "translate-y-6 opacity-0"
              }`}
              style={{ transitionDelay: mounted ? `${i * 60}ms` : "0ms" }}
            >
              <CarCard car={car} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer CTA ─────────────────────────────────────────── */}
      <div
        className={`mt-12 flex flex-col items-center gap-4 px-4 transition-all delay-500 duration-700 ${
          mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <p className="text-muted-foreground text-base">
          Hay más autos esperándote
        </p>
        <Link
          href="/catalogo"
          className="group bg-primary text-primary-foreground hover:bg-primary/90 flex h-14 w-full max-w-xs items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-bold tracking-widest whitespace-nowrap uppercase transition-all hover:scale-105 active:scale-95 sm:px-8"
        >
          Ver todos los autos
          <ArrowRight
            size={16}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </Link>
      </div>

      {/* Bottom border accent */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
    </section>
  );
}
