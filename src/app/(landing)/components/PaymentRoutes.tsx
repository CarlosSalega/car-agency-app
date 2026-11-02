/**
 * How a car actually gets bought here.
 *
 * This section exists because the landing used to promise "the price you see is
 * the price", which describes a market that no longer exists: the buyer arrives
 * with a vehicle to trade, a personal loan, a prendario or a combination, and the
 * agency builds the deal around that. Four routes, in the order they are usually
 * tried at the counter.
 *
 * The facts about +Autos con BNA are the bank's, checked at bna.com.ar: a
 * personal loan (not a prendario), in pesos, requested at an adhered dealership,
 * no need to be a customer. The disclaimer is not decoration — every one of these
 * is subject to a credit decision the dealership does not make.
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
    <section id="pago" className="border-border border-b py-20">
      <div className="mx-auto w-full max-w-[1320px] px-7">
        <div className="mb-8 grid items-end gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-muted-foreground mb-2 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
              <s aria-hidden="true" className="bg-brand block h-px w-7" />
              Formas de pago
            </p>
            <h2 className="text-[clamp(26px,3vw,38px)] leading-[1.05] font-bold tracking-[-0.02em]">
              Decinos qué tenés y qué querés. Vemos cómo se paga.
            </h2>
          </div>
          <p className="text-muted-foreground max-w-[26ch] font-mono text-[11px] leading-relaxed tracking-[0.14em] uppercase md:text-right">
            Casi nadie paga la unidad entera.
          </p>
        </div>

        <div className="border-border grid border-t sm:grid-cols-2 lg:grid-cols-4">
          {ROUTES.map((route, index) => (
            <article
              key={route.k}
              className={`border-border py-6 ${
                index < ROUTES.length - 1
                  ? "border-b lg:border-r lg:border-b-0"
                  : ""
              } ${index > 0 ? "lg:pl-6" : ""} ${index < ROUTES.length - 1 ? "lg:pr-6" : ""} ${index % 2 === 0 ? "sm:pr-6" : "sm:pl-6"} `}
            >
              <span className="text-brand font-mono text-[10px] tracking-[0.16em] uppercase">
                {route.k}
              </span>
              <h3 className="mt-2 mb-1.5 text-[17px] font-bold tracking-[-0.01em]">
                {route.title}
              </h3>
              <p className="text-subtle-foreground text-sm leading-relaxed">
                {route.body}
              </p>
            </article>
          ))}
        </div>

        <p className="border-border text-muted-foreground mt-4 border-t pt-4 text-xs leading-relaxed">
          Sujeto a evaluación crediticia. Montos, plazos y tasas los define cada
          banco y te los confirmamos antes de avanzar.
        </p>
      </div>
    </section>
  );
}
