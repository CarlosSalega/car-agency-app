import { Badge } from "@/components/ui/badge";

import { SectionHeading } from "./ui/SectionHeading";

export default function ServicesSection() {
  return (
    <section id="servicios" className="bg-background py-20">
      <div className="mx-auto max-w-4xl px-4 md:px-10">
        {/* HEADER */}
        <SectionHeading
          eyebrow="Nuestros servicios"
          titleStart="Todas las formas de"
          titleAccent="llegar a tu próximo auto"
          accentClassName="text-muted-foreground"
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className="border-secondary text-primary">
              Autos usados
            </Badge>
            <Badge variant="outline" className="border-secondary text-primary">
              0km
            </Badge>
          </div>
        </SectionHeading>

        {/* CONTENT */}
        <div className="space-y-10 text-lg leading-relaxed text-zinc-600 md:text-xl">
          <p>
            Comprá, vendé o cambiá tu vehículo de forma simple, segura y sin
            vueltas. Te ofrecemos{" "}
            <strong className="text-zinc-900">
              compra directa, venta y consignación
            </strong>
            , adaptándonos a lo que necesitás en cada momento.
          </p>

          <p>
            Accedé a tu próximo auto con{" "}
            <strong className="text-zinc-900">
              créditos de rápida aprobación
            </strong>{" "}
            o entregando tu vehículo en parte de pago mediante{" "}
            <strong className="text-zinc-900">permuta</strong>, sin
            complicaciones.
          </p>

          <p>
            Todas nuestras unidades de usados cuentan con{" "}
            <strong className="text-zinc-900">
              garantía en motor, caja y embrague
            </strong>
            , para que tomes la decisión con total tranquilidad.
          </p>
        </div>
      </div>
    </section>
  );
}
