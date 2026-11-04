import { activeSite } from "@/site/active";

/**
 * The salon: where it is, when it is open, and how to get there.
 *
 * The map is the **key-less Google embed** (`output=embed`, no API key, no billing),
 * built from the coordinates in the site identity rather than from a hardcoded URL,
 * so a second dealership gets its own map from its own data.
 *
 * It is a third-party iframe: it loads Google's scripts and can set their cookies.
 * `loading="lazy"` keeps that from happening until the section is close to the
 * viewport, and the address and the "cómo llegar" link live in the left column, so
 * the section is complete even if the map never loads. The privacy text that should
 * mention it is still pending (roadmap T0.5).
 */
export function Salon() {
  const { identity, whatsapp } = activeSite;
  const { latitude, longitude } = identity.geo;
  // `output=embed` es el mapa clásico sin API key. El zoom 16 deja el salón y la
  // manzana; `hl=es` mantiene la interfaz en castellano.
  const mapSrc = `https://maps.google.com/maps?q=${latitude},${longitude}&z=16&hl=es&output=embed`;

  return (
    <section
      id="contacto"
      className="bg-card border-border scroll-mt-[88px] border-b py-20"
    >
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

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <a
              href={whatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brand hover:bg-brand/90 flex h-11 w-full items-center justify-center px-5 font-mono text-[11px] font-bold tracking-[0.16em] text-black uppercase transition-colors"
            >
              WhatsApp
            </a>
            <a
              href={identity.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border-line-strong hover:bg-accent flex h-11 w-full items-center justify-center border px-5 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors"
            >
              Cómo llegar
            </a>
          </div>
        </div>

        <div className="border-line-strong bg-ground border">
          <iframe
            src={mapSrc}
            title={`Ubicación de ${identity.name} en ${identity.address.locality}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block h-[320px] w-full lg:h-full lg:min-h-[380px]"
          />
          <a
            href={identity.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border text-muted-foreground hover:text-foreground flex items-center justify-between gap-4 border-t px-5 py-3 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors"
          >
            {identity.address.display}
            <span aria-hidden="true">Abrir en Maps →</span>
          </a>
        </div>
      </div>
    </section>
  );
}
