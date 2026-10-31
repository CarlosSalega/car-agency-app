"use client";

import Link from "next/link";
import { Clock, MapPin, PhoneIcon } from "lucide-react";
import { HEADER_CONTENT } from "@/data/header";
import { track } from "@/lib/meta-pixel";
import { useScrollAnimation } from "../hooks/useScrollAnimation";

export default function Footer() {
  const { logo } = HEADER_CONTENT;
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.1 });
  const instagramUrl =
    process.env.NEXT_PUBLIC_INSTAGRAM_URL ??
    "https://www.instagram.com/gl.autos.sf/";
  const mapsUrl =
    process.env.NEXT_PUBLIC_MAPS_URL ??
    "https://www.google.com/maps/place/GL+Autos/@-31.6552097,-60.7221098,17z/data=!3m1!4b1!4m6!3m5!1s0x95b5a98297abae09:0xbc2d98ddab36bb27!8m2!3d-31.6552097!4d-60.7221098!16s%2Fg%2F11ww7df7k8";
  const phoneDisplay = "+54 9 342 577 7646";
  const phoneHref = "tel:+5493425777646";

  return (
    <footer
      id="contacto"
      ref={ref as React.RefObject<HTMLElement>}
      className="bg-background text-foreground w-full px-8 py-24"
    >
      <div
        className={`mx-auto mb-20 grid max-w-7xl grid-cols-1 gap-16 transition-all duration-700 md:grid-cols-3 ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
        }`}
      >
        {/* Brand */}
        <div className="col-span-1">
          <Link href="/" aria-label="Ir al inicio">
            <img
              src={logo.src}
              alt={logo.alt}
              width={logo.width}
              height={logo.height}
              className="h-9 w-auto"
            />
          </Link>
          <p className="text-muted-foreground text-sm leading-relaxed tracking-tight uppercase">
            GL Autos
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed tracking-tight uppercase">
            Concesionario multimarcas de usados seleccionados y 0km
          </p>
        </div>

        {/* Nav */}
        <div
          className={`transition-all delay-100 duration-700 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          }`}
        >
          <h3 className="text-muted-foreground mb-8 text-xs font-bold tracking-widest uppercase underline">
            Navegación
          </h3>
          <ul className="text-muted-foreground space-y-4 text-xs font-bold uppercase">
            <li>
              <Link
                href="/autos"
                className="hover:text-foreground transition-colors"
              >
                Nuestro Stock
              </Link>
            </li>
            <li>
              <a
                href="/ventas"
                className="hover:text-foreground transition-colors"
              >
                Vende tu vehículo
              </a>
            </li>
            <li>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Seguinos en Instagram (se abre en una pestaña nueva)"
                className="hover:text-foreground transition-colors"
              >
                Seguínos en nuestras Redes
              </a>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <address
          className={`transition-all delay-200 duration-700 ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
          } not-italic`}
        >
          <h3 className="text-muted-foreground mb-8 text-xs font-bold tracking-widest uppercase underline">
            Contacto
          </h3>
          <ul className="text-muted-foreground space-y-4 text-xs font-bold uppercase">
            <li>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ver ubicación en Google Maps (se abre en una pestaña nueva)"
                className="hover:text-foreground flex min-w-0 items-center gap-2 break-words transition-colors"
              >
                <MapPin size={16} className="shrink-0" />
                General López 3543, Santa Fe
              </a>
            </li>
            <li>
              <a
                href={phoneHref}
                onClick={() => track("Contact", { method: "phone" })}
                className="hover:text-foreground flex items-center gap-2 transition-colors"
              >
                <PhoneIcon size={16} />
                {phoneDisplay}
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Clock size={16} className="mt-0.5 shrink-0" />
              <span>
                Lun a Vie 8:30&ndash;12:30 y 16&ndash;20 hs
                <br />
                S&aacute;b 9&ndash;12:30 hs
              </span>
            </li>
          </ul>
        </address>
      </div>

      <div className="border-border text-muted-foreground mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t pt-8 text-[10px] font-bold uppercase">
        <Link href="/admin" className="hover:text-foreground transition-colors">
          Acceso
        </Link>
        <p className="text-muted-foreground flex flex-col items-center">
          <span>&copy; {new Date().getFullYear()} GL Autos.</span>
          <span>Derechos reservados.</span>
        </p>
      </div>
    </footer>
  );
}
