import { LinkTreeCategory } from "@generated/prisma/client";
import type { SeedLinkTreeLink } from "./types";

export const seedLinkTreeLinks: SeedLinkTreeLink[] = [
  {
    id: "telefono",
    category: LinkTreeCategory.CONTACT,
    label: "Llamanos",
    href: "tel:+5493425281841",
    iconKey: "phone",
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "whatsapp",
    category: LinkTreeCategory.CONTACT,
    label: "Mensaje de WhatsApp",
    href: "https://api.whatsapp.com/send?phone=5493425281841&text=%C2%BFBuscas%20vender%20o%20comprar%20tu%20auto%3F",
    iconKey: "whatsapp",
    sortOrder: 20,
    isActive: true,
  },
  {
    id: "email",
    category: LinkTreeCategory.CONTACT,
    label: "Envianos un email",
    href: "mailto:info@caragency.com",
    iconKey: "email",
    sortOrder: 30,
    isActive: true,
  },
  {
    id: "instagram",
    category: LinkTreeCategory.SOCIAL,
    label: "Seguinos en Instagram",
    href: "https://www.instagram.com/autos.usados.santafe/",
    iconKey: "instagram",
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "ubicacion",
    category: LinkTreeCategory.SOCIAL,
    label: "Ver nuestra ubicación",
    href: "https://maps.app.goo.gl/w1fV4jZCr8asRNq89",
    iconKey: "location",
    sortOrder: 20,
    isActive: true,
  },
];
