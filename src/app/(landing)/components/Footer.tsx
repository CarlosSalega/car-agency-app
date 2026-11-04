import Link from "next/link";

import { AdminDropdown } from "@/components/admin";
import { activeSite } from "@/site/active";

/**
 * The footer.
 *
 * It carries the last few things a visitor might still want — the other pages, the
 * address, the phone — and nothing else. The previous version animated a three
 * column grid with icons; this one is a hairline and four small columns, which is
 * the same system as the rest of the page: no radius, no shadow, one border.
 *
 * The "Acceso" link is deliberate and stays: it is the only way into `/admin`
 * from the public site, and the header dropped its user menu on purpose.
 */
const SITE_LINKS = [
  { label: "Catálogo", href: "/catalogo" },
  { label: "Últimos ingresos", href: "/#ingresos" },
  { label: "Por qué elegirnos", href: "/#porque" },
  { label: "Formas de pago", href: "/#pago" },
] as const;

/** Lo mínimo que el dropdown necesita; se resuelve en la página, en el servidor. */
export interface FooterSession {
  name: string | null;
  email: string;
  role: "ADMIN" | "COLLABORATOR";
}

/**
 * La sesión llega como prop y no se lee acá: este componente también se renderiza
 * desde `PublicQueryError`, que es cliente, y un `getSession()` acá adentro lo
 * volvería un componente de servidor y rompería ese árbol.
 */
export default function Footer({
  session = null,
}: {
  session?: FooterSession | null;
}) {
  const { identity, whatsapp } = activeSite;

  return (
    <footer className="py-12">
      <div className="mx-auto w-full max-w-[1320px] px-7">
        <div className="border-border grid gap-8 border-b pb-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="flex items-center gap-2.5 text-base font-black tracking-[0.3em] uppercase">
              {identity.name}
            </p>
            <p className="text-muted-foreground mt-3 max-w-[42ch] text-xs leading-relaxed">
              {identity.dealerDescription} en {identity.address.locality}. Parte
              de pago, financiación y transferencia en el mismo lugar.
            </p>
          </div>

          <nav aria-label="Sitio">
            <h2 className="text-muted-foreground mb-3 font-mono text-[10px] tracking-[0.2em] uppercase">
              Sitio
            </h2>
            <ul className="text-subtle-foreground grid gap-2 text-sm">
              {SITE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-muted-foreground mb-3 font-mono text-[10px] tracking-[0.2em] uppercase">
              Contacto
            </h2>
            <ul className="text-subtle-foreground grid gap-2 text-sm">
              <li>{identity.address.display}</li>
              <li>
                <a
                  href={whatsapp.telHref}
                  className="hover:text-foreground font-mono"
                >
                  {identity.contact.phoneDisplay}
                </a>
              </li>
              {identity.social.instagram ? (
                <li>
                  <a
                    href={identity.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground"
                  >
                    Instagram
                  </a>
                </li>
              ) : null}
              {identity.hoursDisplay.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 pt-5 font-mono text-[10px] tracking-[0.14em] uppercase">
          {/* Con sesión, el acceso se vuelve el menú de la cuenta; sin sesión
              sigue siendo el link al login. */}
          {session ? (
            <AdminDropdown user={session} variant="text" />
          ) : (
            <Link
              href="/admin"
              className="hover:text-foreground transition-colors"
            >
              Acceso
            </Link>
          )}
          <p className="m-0 text-right">
            © {new Date().getFullYear()} {identity.copyrightHolder}
            <br />
            Derechos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}
