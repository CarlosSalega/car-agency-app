"use client";

import Link from "next/link";

import Footer from "@/app/(landing)/components/Footer";
import { SiteHeader } from "@/app/(landing)/components/SiteHeader";
import { Button } from "@/components/ui/button";

type PublicQueryErrorProps = {
  reset: () => void;
  showCatalogLink?: boolean;
};

export function PublicQueryError({
  reset,
  showCatalogLink = false,
}: PublicQueryErrorProps) {
  return (
    <div className="bg-background min-h-screen">
      <SiteHeader />

      <main className="flex min-h-svh items-center justify-center px-4 pt-24 pb-20 md:px-8">
        <section
          className="w-full max-w-3xl text-center"
          aria-labelledby="public-query-error-title"
          aria-describedby="public-query-error-description"
        >
          <h1
            id="public-query-error-title"
            className="text-foreground text-4xl font-black tracking-tight text-balance uppercase md:text-6xl"
          >
            No pudimos cargar los vehículos
          </h1>
          <p
            id="public-query-error-description"
            className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty md:text-lg"
          >
            No pudimos acceder a la información en este momento. Volvé a
            intentarlo; si el problema continúa, esperá unos minutos y probá
            nuevamente.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button type="button" size="lg" onClick={reset}>
              Volver a intentar
            </Button>
            {showCatalogLink ? (
              <Button
                variant="outline"
                size="lg"
                render={<Link href="/catalogo">Volver al catálogo</Link>}
              />
            ) : null}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
