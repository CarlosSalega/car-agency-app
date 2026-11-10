import { LinkTreeCategory } from "@generated/prisma/client";
import type { SeedLinkTreeLink } from "./types";

/**
 * The demo link tree, matching `src/site/demo/identity.ts`.
 *
 * Every destination here is intentionally unreachable or generic: the phone
 * number is all zeros (the demo identity's own number), the WhatsApp link points
 * at that same number, Instagram is the site root because every real handle
 * belongs to somebody, and the map is a search for the invented demo address.
 * A seed that pointed at a real dealership's profiles would publish them from
 * every deployment of this product.
 */
export const seedLinkTreeLinks: SeedLinkTreeLink[] = [
  {
    id: "telefono",
    category: LinkTreeCategory.CONTACT,
    label: "Llamanos",
    href: "tel:+5490000000000",
    iconKey: "phone",
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "whatsapp",
    category: LinkTreeCategory.CONTACT,
    label: "Mensaje de WhatsApp",
    href: "https://api.whatsapp.com/send?phone=5490000000000&text=%C2%BFTe%20podemos%20ayudar%20a%20encontrar%20tu%20auto%3F",
    iconKey: "whatsapp",
    sortOrder: 20,
    isActive: true,
  },
  {
    id: "instagram",
    category: LinkTreeCategory.SOCIAL,
    label: "Seguinos en Instagram",
    href: "https://www.instagram.com/",
    iconKey: "instagram",
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "ubicacion",
    category: LinkTreeCategory.SOCIAL,
    label: "Ver nuestra ubicación",
    href: "https://www.google.com/maps/search/?api=1&query=Calle+de+Ejemplo+123",
    iconKey: "location",
    sortOrder: 20,
    isActive: true,
  },
];
