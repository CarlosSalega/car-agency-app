import type { Metadata } from "next";

import { activeSite } from "@/site/active";
import { buildPageMetadata } from "@/site/contract";

import { NavbarServer } from "../(landing)/components/NavbarServer";
import Footer from "../(landing)/components/Footer";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";

export const metadata: Metadata = buildPageMetadata(
  activeSite,
  "sell",
  "/ventas",
);
export default function SellPage() {
  const phone = activeSite.whatsapp.digits;

  const messageTemplate = [
    "Hola! Quiero vender mi vehículo. Estos son los datos:",
    "",
    "MI INFORMACIÓN",
    "Nombre completo:*",
    "Datos de contacto:",
    "Desde donde nos contactas:*",
    "",
    "DATOS DEL VEHÍCULO",
    "Marca:*",
    "Modelo:*",
    "Año:*",
    "Kilometraje:*",
    "Versión / Motor / Caja:*",
    "",
  ].join("\n");

  const whatsappHref = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(messageTemplate)}`
    : "";

  return (
    <>
      <NavbarServer />

      <main className="bg-background min-h-screen py-32">
        <div className="mx-auto max-w-4xl px-4 md:px-10">
          <div className="mb-12 flex flex-col items-center gap-4 text-center">
            <span className="text-muted-foreground text-xs font-bold tracking-[0.3em] uppercase">
              COMPRAMOS TU AUTO
            </span>

            <h1 className="text-foreground text-4xl leading-none font-black tracking-tighter uppercase italic md:text-5xl">
              Vendé tu vehículo{" "}
              <span className="text-muted-foreground">con Nosotros</span>
            </h1>
          </div>

          <div className="text-subtle-foreground space-y-10 text-lg leading-relaxed md:text-xl">
            <p className="text-center">
              Al enviar el mensaje, la información llega directamente a nuestro{" "}
              <strong className="text-foreground">WhatsApp</strong> <br /> para
              una atención más rápida y personalizada.
            </p>
          </div>

          <div className="mx-auto mt-12 flex max-w-lg flex-col items-center gap-8">
            <section className="bg-card rounded-lg p-6 shadow-lg">
              <h2 className="text-foreground text-xl font-semibold">
                Qué necesitamos saber para poder cotizarte
              </h2>

              <div className="mt-5 space-y-6">
                <div>
                  <h3 className="text-foreground font-semibold">
                    Tu información
                  </h3>
                  <ul className="text-subtle-foreground mt-2 list-disc space-y-1 pl-5">
                    <li>Nombre completo *</li>
                    <li>Datos de contacto</li>
                    <li>Desde donde nos contactas *</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-foreground font-semibold">
                    Datos del vehículo
                  </h3>
                  <ul className="text-subtle-foreground mt-2 list-disc space-y-1 pl-5">
                    <li>Marca *</li>
                    <li>Modelo *</li>
                    <li>Año *</li>
                    <li>Kilometraje *</li>
                    <li>Versión / Motor / Caja *</li>
                  </ul>
                </div>

                <div className="text-subtle-foreground text-sm">
                  * Campos necesarios para poder cotizarte más rápido.
                </div>
              </div>
            </section>

            {whatsappHref ? (
              <div className="mt-6 flex justify-center lg:justify-start">
                <WhatsAppButton
                  href={whatsappHref}
                  label="Enviar datos por WhatsApp"
                  className="hover:bg-primary/90"
                />
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
