import Link from "next/link";

import { renderLinkTreeIcon } from "@/data/contact";

export type SocialLinkItem = {
  id: string;
  label: string;
  href: string;
  iconKey?: string | null;
};

export function SocialGrid({ links }: { links: SocialLinkItem[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {links.map((link) => {
        const icon = renderLinkTreeIcon(link.iconKey);

        return (
          <Link
            key={link.id}
            href={link.href}
            target={link.href.startsWith("http") ? "_blank" : undefined}
            rel={
              link.href.startsWith("http") ? "noopener noreferrer" : undefined
            }
            aria-label={link.label}
            title={link.label}
            className="bg-primary text-background hover:bg-primary/90 focus-visible:ring-ring flex size-16 items-center justify-center rounded-lg transition-transform duration-150 hover:scale-105 focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="flex items-center [&_svg]:size-6">
              {icon ?? (
                <span className="px-2 text-center text-xs">{link.label}</span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
