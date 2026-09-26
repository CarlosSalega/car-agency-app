"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderUser } from "@/components/header/header-user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { XRoundedIcon } from "@/components/ui/sheet";
import { isActiveRoute } from "@/lib/constants/navigation";
import type { AuthUser } from "@/types/auth";

interface NavbarClientProps {
  user: AuthUser | null;
}

const NAV_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Catálogo", href: "/autos" },
  { label: "Contacto", href: "/contacto" },
];

const CTA_LINK = { label: "Vendé tu auto", href: "/ventas" };

function MenuRoundedIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M10 6h10" />
      <path d="M4 12h16" />
      <path d="M7 12h13" />
      <path d="M4 18h10" />
    </svg>
  );
}

export default function NavbarClient({ user }: NavbarClientProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const ctaActive = isActiveRoute(pathname, CTA_LINK.href);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`bg-primary fixed top-0 z-50 flex h-24 w-full items-center justify-between px-4 backdrop-blur-md transition-all duration-500 md:px-8 ${
        scrolled ? "shadow-sm" : ""
      }`}
    >
      <a
        href="#main-content"
        className="absolute top-2 left-4 -translate-y-20 rounded-md bg-white px-3 py-2 text-sm font-semibold text-black transition-transform focus:translate-y-0 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-black/40"
      >
        Saltar al contenido
      </a>
      <div
        className={`transition-transform duration-500 ${scrolled ? "scale-95" : "scale-100"}`}
      >
        <Link href="/" aria-label="Ir al inicio">
          <img
            src="/logo-2.png"
            alt="Logo de Car Agency App"
            width={65}
            height={64}
            className="h-16"
          />
        </Link>
      </div>

      <div className="flex items-center gap-4 lg:gap-8">
        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-6 lg:flex"
        >
          {NAV_LINKS.map((link) => {
            const isActive = isActiveRoute(pathname, link.href);

            return (
              <Link
                key={link.label}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative text-sm font-medium tracking-tight uppercase transition-colors ${
                  isActive
                    ? "text-background"
                    : "hover:text-background text-zinc-400"
                }`}
              >
                {link.label}
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="bg-background absolute -bottom-1 left-0 h-0.5 w-full rounded-full"
                  />
                ) : null}
              </Link>
            );
          })}
          <Link
            href={CTA_LINK.href}
            aria-current={ctaActive ? "page" : undefined}
            className={
              ctaActive
                ? "text-background relative text-sm font-medium tracking-tight uppercase transition-colors"
                : "bg-secondary text-primary hover:text-background focus-visible:ring-background/60 rounded-md px-4 py-2 text-sm font-medium tracking-tight uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none"
            }
          >
            {CTA_LINK.label}
            {ctaActive ? (
              <span
                aria-hidden="true"
                className="bg-background absolute -bottom-1 left-0 h-0.5 w-full rounded-full"
              />
            ) : null}
          </Link>
        </nav>

        <HeaderUser user={user} />

        <DropdownMenu onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              className="hover:text-background focus-visible:ring-background/60 inline-flex size-11 items-center justify-center rounded-md text-zinc-200 transition-colors focus-visible:ring-2 focus-visible:outline-none lg:hidden"
            >
              {menuOpen ? (
                <XRoundedIcon className="size-7" />
              ) : (
                <MenuRoundedIcon className="size-7" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="flex w-64 flex-col gap-2 px-2 py-3"
          >
            {NAV_LINKS.map((link) => {
              const isActive = isActiveRoute(pathname, link.href);

              return (
                <DropdownMenuItem key={link.label} asChild>
                  <Link
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-center rounded-sm px-4 py-2 text-sm font-medium tracking-tight uppercase outline-none ${
                      isActive
                        ? "text-secondary data-highlighted:text-secondary data-highlighted:bg-transparent"
                        : "data-highlighted:bg-primary data-highlighted:text-background text-zinc-600"
                    }`}
                  >
                    <span
                      className={
                        isActive
                          ? "border-secondary -mb-1 border-b-2 pb-0.5"
                          : undefined
                      }
                    >
                      {link.label}
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuItem asChild>
              <Link
                href={CTA_LINK.href}
                aria-current={ctaActive ? "page" : undefined}
                className={
                  ctaActive
                    ? "text-secondary data-highlighted:text-secondary flex w-full items-center rounded-sm px-4 py-2 text-sm font-medium tracking-tight uppercase outline-none data-highlighted:bg-transparent"
                    : "bg-secondary text-primary data-highlighted:bg-secondary data-highlighted:text-background flex w-full items-center justify-start rounded-md border-0 px-4 py-2.5 text-sm font-medium tracking-tight uppercase shadow-none transition-colors outline-none"
                }
              >
                <span
                  className={
                    ctaActive
                      ? "border-secondary -mb-1 border-b-2 pb-0.5"
                      : undefined
                  }
                >
                  {CTA_LINK.label}
                </span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
