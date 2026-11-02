import type { Metadata } from "next";

import { activeSite } from "@/site/active";
import { buildPageMetadata } from "@/site/contract";

import ContactSection from "@/components/contact-section";
import { DEFAULT_LINKTREE_LINKS } from "@/data/contact";
import { prisma } from "@/lib/db";

import { NavbarServer } from "../(landing)/components/NavbarServer";
import Footer from "../(landing)/components/Footer";

export const metadata: Metadata = buildPageMetadata(
  activeSite,
  "contact",
  "/contacto",
);
export default async function ContactPage() {
  const links = await prisma.linkTreeLink.findMany({
    where: { isActive: true },
    select: {
      id: true,
      category: true,
      label: true,
      href: true,
      iconKey: true,
      sortOrder: true,
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const source = links.length
    ? links
    : DEFAULT_LINKTREE_LINKS.filter((l) => l.isActive !== false);

  const toLinkItem = (l: {
    id: string;
    label: string;
    href: string;
    iconKey?: string | null;
  }) => ({
    id: l.id,
    label: l.label,
    href: l.href,
    iconKey: l.iconKey ?? null,
  });

  const contactLinks = [
    ...source.filter(
      (l) => l.category === "CONTACT" && l.iconKey !== "location",
    ),
    ...source.filter((l) => l.iconKey === "location"),
  ].map(toLinkItem);

  const socialLinks = source
    .filter((l) => l.category === "SOCIAL" && l.iconKey !== "location")
    .map(toLinkItem);

  return (
    <>
      <NavbarServer />

      <ContactSection contactLinks={contactLinks} socialLinks={socialLinks} />

      <Footer />
    </>
  );
}
