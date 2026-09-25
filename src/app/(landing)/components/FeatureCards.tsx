"use client";

import Link from "next/link";
import { useScrollAnimation } from "../hooks/useScrollAnimation";

const cards = [
  {
    title: "Comprá",
    desc: "Encontrá el auto que estabas buscando con revisión mecánica garantizada.",
    icon: "ph-shopping-cart",
    bg: "/compra.webp",
    href: "/autos",
  },
  {
    title: "Vendé",
    desc: "Tasación inmediata y transferencia segura en menos de 48 horas hábiles.",
    icon: "ph-tag",
    bg: "/venta.webp",
    href: "/ventas",
  },
];

export default function FeatureCards() {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.2 });

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-background relative z-20 -mt-20 w-full px-4 py-24 md:px-8"
    >
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
        {cards.map((card, i) => (
          <Link
            key={card.title}
            href={card.href}
            className={`group relative overflow-hidden rounded-lg transition-all duration-700 ${
              isVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-12 opacity-0"
            }`}
            style={{ transitionDelay: `${i * 150}ms` }}
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url(${card.bg})` }}
            />

            <div className="absolute inset-0 bg-zinc-950/50 transition-colors duration-300 group-hover:bg-zinc-950/40" />

            <div
              className="pointer-events-none absolute inset-0"
              style={{
                boxShadow: "inset 0 0 40px 10px rgb(9 9 11 / 0.7)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0 hidden md:block"
              style={{
                boxShadow: "inset 0 0 120px 30px rgb(9 9 11 / 0.45)",
              }}
            />

            <div className="relative z-10 p-12 text-white">
              <i
                aria-hidden="true"
                className={`${card.icon} mb-6 block text-4xl transition-transform duration-300 group-hover:scale-110`}
              />
              <h2 className="mb-4 text-3xl font-black uppercase italic">
                {card.title}
              </h2>
              <p className="leading-relaxed text-zinc-300">{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
