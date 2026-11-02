import { activeSite } from "@/site/active";

/**
 * The salon: where it is, when it is open, and how to get there.
 *
 * One deliberate departure from the artboard: it drew a map, and this renders a
 * **sign** instead. An embedded Google map is a third-party iframe — it loads
 * their scripts, sets their cookies, and the privacy page that would justify it
 * is still pending (roadmap T0.5). Until that exists, the honest version is the
 * address, a large "how to get there" link, and the opening hours, which is what
 * a person actually needs and what the map was standing in for.
 */
export function Salon() {
  const { identity, whatsapp } = activeSite;

  return (
    <section id="contacto" className="border-border border-b py-20">
      <div className="mx-auto grid w-full max-w-[1320px] gap-10 px-7 md:grid-cols-2">
        <div>
          <p className="text-muted-foreground mb-2 flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <s aria-hidden="true" className="bg-brand block h-px w-7" />
            El salón
          </p>
          <h2 className="mb-6 text-[clamp(26px,3vw,42px)] leading-[1.05] font-bold tracking-[-0.02em]">
            Te esperamos con el salón abierto.
          </h2>

          <address className="text-subtle-foreground text-base leading-relaxed not-italic">
            <b className="text-foreground text-lg">{identity.address.street}</b>
            <br />
            {identity.address.locality}
            <br />
            <a
              href={`tel:${identity.contact.phoneRaw}`}
              className="text-brand mt-4 inline-block font-mono text-[13px] tracking-[0.08em] underline-offset-4 hover:underline"
            >
              {identity.contact.phoneDisplay}
            </a>
          </address>

          <ul className="border-border text-subtle-foreground mt-6 list-none border-t p-0 font-mono text-xs">
            {identity.hoursDisplay.map((line) => (
              <li
                key={line}
                className="border-border border-b py-2.5 tracking-[0.06em]"
              >
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={whatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brand hover:bg-brand/90 flex h-11 items-center justify-center px-5 font-mono text-[11px] font-bold tracking-[0.16em] text-black uppercase transition-colors"
            >
              WhatsApp
            </a>
            <a
              href={identity.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border-line-strong hover:bg-accent flex h-11 items-center justify-center border px-5 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors"
            >
              Cómo llegar
            </a>
          </div>
        </div>

        {/* Cartel, no mapa: ver el comentario del componente. */}
        <a
          href={identity.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="border-line-strong bg-ground hover:border-brand group relative flex min-h-[320px] flex-col justify-between border p-7 transition-colors"
        >
          <span className="text-muted-foreground font-mono text-[11px] tracking-[0.16em] uppercase">
            Santa Fe · Argentina
          </span>

          <span className="flex flex-col gap-3">
            <span aria-hidden="true" className="bg-accent h-px w-full" />
            <span className="text-foreground flex items-center gap-3 font-mono text-[13px] tracking-[0.1em] uppercase">
              <i className="bg-brand block size-2.5" />
              {identity.name} · aquí
            </span>
            <span className="text-subtle-foreground text-2xl leading-tight font-bold tracking-[-0.02em]">
              {identity.address.street}
              <br />
              {identity.address.locality}
            </span>
          </span>

          <span className="text-muted-foreground group-hover:text-foreground font-mono text-[11px] tracking-[0.16em] uppercase transition-colors">
            Abrir en Google Maps →
          </span>
        </a>
      </div>
    </section>
  );
}
