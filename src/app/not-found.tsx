"use client";

import { useEffect, useReducer } from "react";
import Link from "next/link";

const GLITCH_CHARS = "!@#$%&*404";
const LABEL = "PÁGINA NO ENCONTRADA";

type State = {
  mounted: boolean;
  scrollY: number;
  glitchText: string;
};

type Action =
  | { type: "MOUNT" }
  | { type: "SCROLL"; y: number }
  | { type: "GLITCH_TICK"; text: string }
  | { type: "GLITCH_END" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "MOUNT":
      return { ...state, mounted: true };
    case "SCROLL":
      return { ...state, scrollY: action.y };
    case "GLITCH_TICK":
      return { ...state, glitchText: action.text };
    case "GLITCH_END":
      return { ...state, glitchText: LABEL };
  }
}

const initialState: State = {
  mounted: false,
  scrollY: 0,
  glitchText: LABEL,
};

export default function NotFound() {
  const [{ mounted, scrollY, glitchText }, dispatch] = useReducer(
    reducer,
    initialState,
  );

  useEffect(() => {
    dispatch({ type: "MOUNT" });

    const handleScroll = () => dispatch({ type: "SCROLL", y: window.scrollY });
    window.addEventListener("scroll", handleScroll, { passive: true });

    function runGlitch() {
      let iterations = 0;
      const interval = setInterval(() => {
        const text = LABEL.split("")
          .map((char, i) =>
            i < iterations
              ? char
              : GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)],
          )
          .join("");
        dispatch({ type: "GLITCH_TICK", text });
        if (iterations >= LABEL.length) {
          clearInterval(interval);
          dispatch({ type: "GLITCH_END" });
          setTimeout(runGlitch, 3500 + Math.random() * 2000);
        }
        iterations += 0.4;
      }, 40);
      return interval;
    }

    const glitchTimeout = setTimeout(() => runGlitch(), 600);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(glitchTimeout);
    };
  }, []);

  return (
    <section className="bg-background relative flex min-h-svh w-full items-center justify-center overflow-hidden py-32">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        style={{
          transform: `translateY(${scrollY * 0.2}px)`,
          transition: "transform 0.1s linear",
        }}
      >
        <span
          className={`text-[28vw] leading-none font-black tracking-tighter text-white/3 uppercase italic transition-all duration-700 ${
            mounted ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          404
        </span>
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, hsl(var(--primary) / 0.08) 0%, transparent 70%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          boxShadow: "inset 0 0 240px 40px rgb(24 24 27 / 0.9)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10"
        style={{
          height: "320px",
          background:
            "linear-gradient(to bottom, rgb(0 0 0 / 0.9) 0%, rgb(0 0 0 / 0.4) 60%, transparent 100%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
        style={{
          height: "220px",
          background:
            "linear-gradient(to top, rgb(24 24 27) 0%, transparent 100%)",
        }}
      />

      <div className="relative z-20 px-4 text-center">
        <span
          className={`text-muted-foreground mb-4 block text-base font-bold tracking-[0.3em] uppercase transition-all duration-700 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          GL Autos
        </span>

        <h1
          className={`mb-3 text-8xl leading-none font-black tracking-tighter text-white uppercase italic transition-all delay-100 duration-700 md:text-[10rem] ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          4<span className="text-brand">0</span>4
        </h1>

        <p
          className={`text-muted-foreground mb-3 text-sm font-bold tracking-[0.25em] uppercase transition-all delay-200 duration-700 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
          style={{ minHeight: "1.5em" }}
        >
          {glitchText}
        </p>

        <p
          className={`text-subtle-foreground mx-auto mb-10 max-w-md text-lg transition-all delay-300 duration-700 ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          La página que buscás no existe o fue removida. Volvé al inicio y
          encontrá tu próximo auto.
        </p>

        <div
          className={`mx-auto flex min-w-70 flex-col justify-center gap-4 px-4 transition-all delay-500 duration-700 md:w-full md:flex-row ${
            mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <Link
            href="/"
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-10 py-4 text-sm font-bold tracking-widest uppercase transition-all hover:scale-105 active:scale-95 md:w-auto"
          >
            Volver al inicio
          </Link>
          <Link
            href="/vehiculos"
            className="w-full rounded-lg border border-white/20 bg-white/10 px-10 py-4 text-sm font-bold tracking-widest text-white uppercase backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20 active:scale-95 md:w-auto"
          >
            Ver vehículos
          </Link>
        </div>
      </div>
    </section>
  );
}
