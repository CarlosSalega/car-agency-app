/**
 * Why us, as three claims with a proof each.
 *
 * The previous landing had a card grid of icon + adjective ("calidad",
 * "confianza"). Adjectives are not checkable, so this section states the three
 * things a buyer can verify at the counter: the paperwork is current, the balance
 * can be financed, and the trade-in is valued the same day.
 *
 * No icons. The number is the marker, the same way it works on the spec sheet.
 */

const CLAIMS = [
  {
    n: "01",
    title: "Verificación y mecánica al día",
    body: "Verificación del automotor, informe de dominio y revisión mecánica en cada usado. Lo que no pasa se corrige o no entra al salón.",
  },
  {
    n: "02",
    title: "El saldo se financia",
    body: "Descontamos lo que vale tu vehículo y el resto va a crédito: +Autos con BNA, prendario o una combinación. Los gastos se explican antes de firmar.",
  },
  {
    n: "03",
    title: "Tasación el mismo día",
    body: "Traés el vehículo, lo revisamos y te damos el valor de toma ahí mismo. Si preferís venderlo y no entregarlo, también lo compramos.",
  },
] as const;

export function WhyUs() {
  return (
    <section id="porque" className="border-border border-b py-20">
      <div className="mx-auto w-full max-w-[1320px] px-7">
        <p className="text-muted-foreground mb-2 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
          <s aria-hidden="true" className="bg-brand block h-px w-7" />
          Por qué elegirnos
        </p>
        <h2 className="mb-8 text-[clamp(26px,3vw,38px)] leading-[1.05] font-bold tracking-[-0.02em]">
          Tres cosas que hacemos distinto
        </h2>

        <div className="border-border grid border-t md:grid-cols-3">
          {CLAIMS.map((claim, index) => (
            <article
              key={claim.n}
              className={`border-border py-6 md:py-7 ${
                index < CLAIMS.length - 1
                  ? "border-b md:border-r md:border-b-0"
                  : ""
              } ${index > 0 ? "md:pl-7" : ""} ${index < CLAIMS.length - 1 ? "md:pr-7" : ""}`}
            >
              <span className="text-brand font-mono text-[11px] tracking-[0.1em]">
                {claim.n}
              </span>
              <h3 className="mt-2.5 mb-2 text-lg font-bold tracking-[-0.01em]">
                {claim.title}
              </h3>
              <p className="text-subtle-foreground text-[15px] leading-relaxed">
                {claim.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
