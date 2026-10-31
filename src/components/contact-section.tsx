"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { renderLinkTreeIcon } from "@/data/contact";
import { track } from "@/lib/meta-pixel";

import { SocialGrid } from "./social-grid";

type LinkItem = {
  id: string;
  label: string;
  href: string;
  iconKey?: string | null;
};

interface ContactSectionProps {
  contactLinks?: LinkItem[];
  socialLinks?: LinkItem[];
}

function deriveContactMethod(href: string) {
  if (href.startsWith("tel:")) return "phone" as const;
  if (href.startsWith("mailto:")) return "email" as const;
  if (href.includes("wa.me")) return "whatsapp" as const;
  if (href.includes("maps") || href.includes("google.com/maps"))
    return "maps" as const;
  return null;
}

function LinksList({ links }: { links: LinkItem[] }) {
  return (
    <div className="grid gap-3">
      {links.map((link) => {
        const icon = renderLinkTreeIcon(link.iconKey);
        const method = deriveContactMethod(link.href);
        const handleClick = method
          ? () => track("Contact", { method })
          : undefined;
        const isPrimary =
          link.iconKey === "whatsapp" ||
          link.href.includes("wa.me") ||
          link.href.includes("api.whatsapp.com");

        return (
          <Link
            key={link.id}
            href={link.href}
            target={link.href.startsWith("http") ? "_blank" : undefined}
            rel={
              link.href.startsWith("http") ? "noopener noreferrer" : undefined
            }
            aria-label={link.label}
            onClick={handleClick}
          >
            <Button
              className={
                isPrimary
                  ? "bg-card text-foreground hover:bg-card hover:text-foreground hover:border-primary motion-safe:animate-attention-glow h-16 w-full justify-start rounded-lg border py-4 pl-6 text-center text-base font-medium transition-transform duration-150 hover:scale-105 hover:shadow-md sm:pl-24 md:pl-30"
                  : "bg-card text-foreground hover:bg-card hover:text-foreground hover:border-primary h-16 w-full justify-start rounded-lg border py-4 pl-6 text-center text-base font-medium transition-transform duration-150 hover:scale-105 hover:shadow-md sm:pl-24 md:pl-30"
              }
              variant="outline"
            >
              {icon ? (
                <span className="text-primary mr-3 flex items-center">
                  {icon}
                </span>
              ) : null}
              {link.label}
            </Button>
          </Link>
        );
      })}
    </div>
  );
}

export default function ContactSection({
  contactLinks = [],
  socialLinks = [],
}: ContactSectionProps) {
  const hasLinks = contactLinks.length > 0 || socialLinks.length > 0;

  return (
    <section className="mx-auto w-full max-w-120 px-4 py-32">
      {!hasLinks ? (
        <p className="text-muted-foreground text-sm">
          No hay enlaces configurados.
        </p>
      ) : (
        <div className="space-y-8">
          {contactLinks.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-center text-lg font-semibold">Contacto</h3>
              <LinksList links={contactLinks} />
            </div>
          ) : null}

          {socialLinks.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-center text-lg font-semibold">
                Redes sociales
              </h3>
              <SocialGrid links={socialLinks} />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
