"use client";

import { useEffect, useReducer, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { track } from "@/lib/meta-pixel";

const BG_IMAGES = [
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=2000",
  "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&q=80&w=2000",
];

const INTERVAL_MS = 6000;
const TRANSITION_MS = 1800;

type State = {
  current: number;
  activeDot: number;
  transitioning: boolean;
};

type Action =
  | { type: "START_TRANSITION"; next: number }
  | { type: "FINISH_TRANSITION"; next: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_TRANSITION":
      return { ...state, activeDot: action.next, transitioning: true };
    case "FINISH_TRANSITION":
      return {
        current: action.next,
        activeDot: action.next,
        transitioning: false,
      };
  }
}

const initialState: State = {
  current: 0,
  activeDot: 0,
  transitioning: false,
};

export default function Hero() {
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [{ current, activeDot, transitioning }, dispatch] = useReducer(
    reducer,
    initialState,
  );

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = (current + 1) % BG_IMAGES.length;
      dispatch({ type: "START_TRANSITION", next });
      setTimeout(
        () => dispatch({ type: "FINISH_TRANSITION", next }),
        TRANSITION_MS,
      );
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [current]);

  const next = (current + 1) % BG_IMAGES.length;

  function goTo(i: number) {
    if (transitioning) return;
    dispatch({ type: "START_TRANSITION", next: i });
    setTimeout(
      () => dispatch({ type: "FINISH_TRANSITION", next: i }),
      TRANSITION_MS,
    );
  }

  return (
    <section className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-zinc-900 py-32">
      {BG_IMAGES.map((src, i) => {
        const isActive = i === current;
        const isNext = i === next;
        return (
          <div
            key={src}
            className="absolute inset-0"
            style={{
              opacity: isActive
                ? transitioning
                  ? 0
                  : 1
                : isNext
                  ? transitioning
                    ? 1
                    : 0
                  : 0,
              transform: `translateY(${scrollY * 0.35}px) scale(${isActive && !transitioning ? 1.05 : 1})`,
              filter: transitioning && isActive ? "blur(6px)" : "blur(0px)",
              transition: `opacity ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1), filter ${TRANSITION_MS}ms ease, transform ${TRANSITION_MS}ms ease`,
              willChange: "opacity, transform, filter",
            }}
          >
            <Image
              src={src}
              alt=""
              aria-hidden="true"
              fill
              sizes="100vw"
              priority={i === 0}
              className="object-cover opacity-45"
            />
          </div>
        );
      })}

      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          boxShadow: "inset 0 0 240px 40px rgb(24 24 27 / 0.85)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10"
        style={{
          height: "420px",
          background:
            "linear-gradient(to bottom, rgb(0 0 0 / 0.95) 0%, rgb(0 0 0 / 0.5) 50%, transparent 100%)",
        }}
      />

      <div className="absolute inset-0 bg-linear-to-b from-zinc-900/20 via-transparent to-zinc-900/60" />

      <div className="absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 gap-2 p-8">
        {BG_IMAGES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Cambiar a imagen ${i + 1}`}
            aria-current={i === activeDot}
            className={`h-0.75 rounded-full transition-all duration-500 ${
              i === activeDot ? "bg-secondary w-8" : "w-3 bg-white/30"
            }`}
          />
        ))}
      </div>

      <div className="relative z-10 px-4 text-center">
        <span
          className={`mb-4 block text-base font-bold tracking-[0.3em] text-zinc-400 uppercase transition-all duration-700 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          F<span className="normal-case">y</span>F Automotores
        </span>

        <h1
          className={`mb-8 text-6xl leading-none font-black tracking-tighter text-white uppercase italic transition-all delay-150 duration-700 md:text-8xl ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          Tu próximo <br /> auto{" "}
          <span className="text-secondary">te espera acá</span>
        </h1>

        <p
          className={`mx-auto mb-10 max-w-xl text-lg text-zinc-300 transition-all delay-300 duration-700 lg:text-xl ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          Vehículos seleccionados, atención personalizada y un proceso simple
          para que compres sin vueltas.
        </p>

        <div
          className={`mx-auto flex w-full flex-col justify-center gap-4 px-4 transition-all delay-500 duration-700 md:w-auto md:flex-row ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <Link
            href="/autos"
            className="h-14 w-full rounded-lg bg-white px-10 py-4 text-sm font-bold tracking-widest text-black uppercase transition-all hover:scale-105 hover:bg-zinc-200 active:scale-95 md:w-auto"
          >
            Ver vehículos
          </Link>
          <Link
            href="/contacto"
            onClick={() => track("Contact", { method: "maps" })}
            className="h-14 w-full rounded-lg border border-white/20 bg-white/10 px-10 py-4 text-sm font-bold tracking-widest text-white uppercase backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20 active:scale-95 md:w-auto"
          >
            Contáctanos
          </Link>
        </div>
      </div>
    </section>
  );
}
