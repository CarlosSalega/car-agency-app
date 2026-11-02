/**
 * How a car actually gets bought here.
 *
 * The brief for this section is the menu of ways to pay, so it is built as a
 * ledger: the route's name on the left, what it means on the right, one hairline
 * per row. The previous version was a four column grid — the same skeleton as the
 * "why us" cards, two sections apart, and that repetition is what made both feel
 * interchangeable.
 *
 * The facts about +Autos con BNA are the bank's, checked at bna.com.ar: a personal
 * loan (not a prendario), in pesos, requested at an adhered dealership, no need to
 * be a customer. The disclaimer is not decoration — every one of these is subject
 * to a credit decision the dealership does not make.
 */

const ROUTES = [
  {
    k: "Parte de pago",
    title: "Entregás tu vehículo",
    body: "Auto, moto, camioneta o utilitario. Lo tasamos y ese valor se descuenta del precio de la unidad que te llevás.",
  },
  {
    k: "Banco Nación",
    title: "+Autos con BNA",
    body: "Préstamo personal para comprar el auto: hasta $100.000.000, de 12 a 60 cuotas, sin prenda y sin ser cliente del banco. Te acompañamos con el trámite.",
  },
  {
    k: "Prendario",
    title: "Crédito con el auto en garantía",
    body: "Tasa fija en pesos y hasta 60 meses, sobre el saldo que queda después de la parte de pago.",
  },
  {
    k: "Llave por llave",
    title: "Si tu usado cubre el valor",
    body: "Entregás y te llevás sin financiación. Coordinamos las dos transferencias y las verificaciones.",
  },
] as const;

export function PaymentRoutes() {
  return (
    <section id="pago" className="bg-background border-border border-b py-20">
      <div className="mx-auto grid w-full max-w-[1320px] gap-10 px-7 lg:grid-cols-[minmax(0,300px)_1fr] lg:gap-16">
        {/* El título vive en una columna propia y acompaña el scroll de la lista. */}
        <div className="self-start lg:sticky lg:top-24">
          <p className="text-muted-foreground mb-2 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <s aria-hidden="true" className="bg-brand block h-px w-7" />
            Formas de pago
          </p>
          <h2 className="text-[clamp(26px,3vw,34px)] leading-[1.05] font-bold tracking-[-0.02em]">
            Decinos qué tenés y qué querés. Vemos cómo se paga.
          </h2>
          <p className="text-muted-foreground mt-4 font-mono text-[11px] leading-relaxed tracking-[0.14em] uppercase">
            Casi nadie paga la unidad entera.
          </p>
        </div>

        <div>
          <dl className="border-line-strong border-t">
            {ROUTES.map((route) => (
              <div
                key={route.k}
                className="border-border grid gap-2 border-b py-5 sm:grid-cols-[190px_1fr] sm:gap-8"
              >
                <dt className="text-brand font-mono text-[11px] tracking-[0.16em] uppercase">
                  {route.k}
                </dt>
                <dd className="m-0">
                  <p className="text-[17px] font-bold tracking-[-0.01em]">
                    {route.title}
                  </p>
                  <p className="text-subtle-foreground mt-1.5 max-w-[58ch] text-sm leading-relaxed">
                    {route.body}
                  </p>
                </dd>
              </div>
            ))}
          </dl>

          <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
            Sujeto a evaluación crediticia. Montos, plazos y tasas los define
            cada banco y te los confirmamos antes de avanzar.
          </p>
        </div>
      </div>
    </section>
  );
}
