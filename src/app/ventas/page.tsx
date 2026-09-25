import type { Metadata } from "next";

import { NavbarServer } from "../(landing)/components/NavbarServer";
import Footer from "../(landing)/components/Footer";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";

export const metadata: Metadata = {
  title: "Vendé tu auto en 48 horas en Santa Fe | Car Agency App",
  description:
    "Vendé tu auto en Santa Fe con Car Agency App: tasación inmediata, transferencia segura en 48 horas hábiles y pago rápido. ¡Envianos tus datos por WhatsApp!",
  alternates: {
    canonical: "/ventas",
  },
};

export default function SellPage() {
  const phoneRaw = process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? "+5493425281841";
  const phone = phoneRaw.replace(/\D/g, "");

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
            <span className="text-xs font-bold tracking-[0.3em] text-zinc-500 uppercase">
              COMPRAMOS TU AUTO
            </span>

            <h1 className="text-4xl leading-none font-black tracking-tighter text-zinc-900 uppercase italic md:text-5xl">
              Vendé tu vehículo{" "}
              <span className="text-muted-foreground">con Nosotros</span>
            </h1>
          </div>

          <div className="space-y-10 text-lg leading-relaxed text-zinc-600 md:text-xl">
            <p className="text-center">
              Al enviar el mensaje, la información llega directamente a nuestro{" "}
              <strong className="text-zinc-900">WhatsApp</strong> <br /> para
              una atención más rápida y personalizada.
            </p>
          </div>

          <div className="mx-auto mt-12 flex max-w-lg flex-col items-center gap-8">
            <section className="bg-card rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-semibold text-zinc-900">
                Qué necesitamos saber para poder cotizarte
              </h2>

              <div className="mt-5 space-y-6">
                <div>
                  <h3 className="font-semibold text-zinc-900">
                    Tu información
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
                    <li>Nombre completo *</li>
                    <li>Datos de contacto</li>
                    <li>Desde donde nos contactas *</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900">
                    Datos del vehículo
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
                    <li>Marca *</li>
                    <li>Modelo *</li>
                    <li>Año *</li>
                    <li>Kilometraje *</li>
                    <li>Versión / Motor / Caja *</li>
                  </ul>
                </div>

                <div className="text-sm text-zinc-600">
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
