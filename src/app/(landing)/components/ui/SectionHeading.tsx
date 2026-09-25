"use client";

import type { ReactNode } from "react";

import { useScrollAnimation } from "../../hooks/useScrollAnimation";

interface SectionHeadingProps {
  eyebrow: string;
  titleStart: string;
  titleAccent: string;
  titleEnd?: string;
  accentClassName?: string;
  children?: ReactNode;
}

export function SectionHeading({
  eyebrow,
  titleStart,
  titleAccent,
  titleEnd,
  accentClassName = "text-secondary",
  children,
}: SectionHeadingProps) {
  const { ref, isVisible } = useScrollAnimation<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`mb-12 flex flex-col items-center gap-4 text-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
    >
      <span className="text-xs font-bold tracking-[0.3em] text-zinc-500 uppercase">
        {eyebrow}
      </span>
      <h2 className="text-4xl leading-none font-black tracking-tighter text-zinc-900 uppercase italic md:text-5xl">
        {titleStart} <span className={accentClassName}>{titleAccent}</span>
        {titleEnd ? ` ${titleEnd}` : null}
      </h2>
      {children}
    </div>
  );
}
