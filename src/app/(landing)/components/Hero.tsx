import Link from "next/link";

import { CarImage } from "@/components/cars/car-image";
import { formatKm, formatPrice } from "@/lib/utils";
import { activeSite } from "@/site/active";

/**
 * The only split on the page: the unit on the left, the offer on the right.
 *
 * Everything below the hero is a single column, and that asymmetry is the point —
 * this screen is the one that has to hold a photo and a decision at the same time.
 *
 * Three rules:
 *
 * 1. **The left half is a real photo of a real unit**, not a drawing. The artboard
 *    used a silhouette only because a design file cannot load images.
 * 2. **The caption sits on the photo, not beside it.** Name, year, kilometres and
 *    the published price: what a person standing at the lot would read on the
 *    sticker.
 * 3. **The numbers are read, not written.** The stock count comes from the
 *    database and the address from the site package, so a second dealership gets
 *    its own without touching this file.
 */

interface HeroProps {
  car: {
    id: string;
    title: string;
    slug: string;
    year: number;
    kilometers: number;
    price: number | string;
    currency: string;
    images: string[];
  } | null;
  totalCars: number;
}

export function Hero({ car, totalCars }: HeroProps) {
  const { identity, whatsapp } = activeSite;
  const firstImage = car?.images?.[0] ?? null;

  return (
    <section className="border-border grid border-b xl:grid-cols-2">
      {/* La unidad, a sangre */}
      <div className="bg-ground border-border relative min-h-[56svh] overflow-hidden border-b xl:min-h-[calc(100svh-62px)] xl:border-r xl:border-b-0">
        {car ? (
          <Link
            href={`/autos/${car.slug}`}
            className="absolute inset-0 block"
            aria-label={`Ver la ficha de ${car.title}`}
          >
            {/* `skipSkeleton`: el shimmer de la card tapaba el caption del hero, y
                acá la foto ES el fondo. La capa es absoluta porque el contenedor
                sólo declara min-height, así que un `h-full` interno mide 0. */}
            <CarImage
              imageKey={firstImage}
              alt={`${car.title}, ${car.year}`}
              variant="fullscreen"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              skipSkeleton
              className="absolute inset-0 h-full w-full object-cover"
            />
          </Link>
        ) : (
          <div className="bg-accent absolute inset-0" />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 from-45% to-transparent p-5">
          <div className="text-muted-foreground flex flex-wrap items-baseline justify-between gap-4 font-mono text-[11px] tracking-[0.16em] uppercase">
            {car ? (
              <>
                <span>
                  <b className="text-foreground font-medium">{car.title}</b>
                  {" · "}
                  {car.year}
                  {" · "}
                  {car.kilometers === 0
                    ? "0 km"
                    : `${formatKm(car.kilometers)} km`}
                </span>
                <span className="text-foreground text-sm">
                  {formatPrice(Number(car.price), car.currency)}
                </span>
              </>
            ) : (
              <span>Salón abierto · {identity.address.display}</span>
            )}
          </div>
        </div>

        {/* El rótulo no puede depender del brillo de la foto: va sobre su propio
            scrim, con blanco puro (21:1 sobre negro), como el caption de abajo. */}
        <div className="absolute top-5 left-5 z-20 flex items-center gap-2.5 bg-black/55 px-2.5 py-1.5 font-mono text-[11px] tracking-[0.16em] text-white uppercase backdrop-blur-sm">
          <i aria-hidden="true" className="bg-brand block size-2" />
          {identity.name}
        </div>
      </div>

      {/* La información */}
      <div className="flex flex-col justify-center px-7 py-12 xl:px-14">
        <p className="text-muted-foreground mb-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
          <s aria-hidden="true" className="bg-brand block h-px w-7" />
          {identity.address.locality} · {identity.address.street}
        </p>

        <h1 className="text-[clamp(34px,3.9vw,62px)] leading-[0.96] font-black tracking-[-0.035em] text-balance">
          Vos traés lo que tenés.{" "}
          <em className="text-brand not-italic">El negocio se arma acá.</em>
        </h1>

        <p className="text-subtle-foreground mt-6 max-w-[46ch] text-[17px] leading-relaxed">
          Entregás tu auto, moto o camioneta como parte de pago y financiamos la
          diferencia con banco o prendario. La verificación y la transferencia
          las resolvemos nosotros.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/catalogo"
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-11 items-center justify-center px-5 font-mono text-[11px] font-bold tracking-[0.16em] uppercase transition-colors"
          >
            Ver {totalCars === 1 ? "la unidad" : `las ${totalCars} unidades`}
          </Link>
          <a
            href="#contacto"
            className="border-line-strong hover:bg-accent flex h-11 items-center justify-center border px-5 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors"
          >
            Coordinar una visita
          </a>
        </div>

        <dl className="border-border mt-9 grid grid-cols-3 border-t">
          {[
            { k: String(totalCars), label: "Unidades" },
            { k: "24 h", label: "Entrega" },
            { k: "60", label: "Cuotas" },
          ].map((item, index) => (
            <div
              key={item.label}
              className={`pt-4 pr-4 ${index < 2 ? "border-border border-r" : ""} ${index > 0 ? "pl-4" : ""}`}
            >
              <dd className="font-mono text-2xl font-medium tracking-tight">
                {item.k}
              </dd>
              <dt className="text-muted-foreground mt-0.5 font-mono text-[10px] tracking-[0.16em] uppercase">
                {item.label}
              </dt>
            </div>
          ))}
        </dl>

        <a
          href={whatsapp.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground mt-7 font-mono text-[11px] tracking-[0.16em] uppercase underline-offset-4 transition-colors hover:underline"
        >
          o escribinos: {identity.contact.phoneDisplay} →
        </a>
      </div>
    </section>
  );
}
