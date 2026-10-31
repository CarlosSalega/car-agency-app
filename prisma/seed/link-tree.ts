import { LinkTreeCategory } from "@generated/prisma/client";
import type { SeedLinkTreeLink } from "./types";

export const seedLinkTreeLinks: SeedLinkTreeLink[] = [
  {
    id: "telefono",
    category: LinkTreeCategory.CONTACT,
    label: "Llamanos",
    href: "tel:+5493425777646",
    iconKey: "phone",
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "whatsapp",
    category: LinkTreeCategory.CONTACT,
    label: "Mensaje de WhatsApp",
    href: "https://api.whatsapp.com/send?phone=5493425777646&text=%C2%BFBuscas%20vender%20o%20comprar%20tu%20auto%3F",
    iconKey: "whatsapp",
    sortOrder: 20,
    isActive: true,
  },
  {
    id: "instagram",
    category: LinkTreeCategory.SOCIAL,
    label: "Seguinos en Instagram",
    href: "https://www.instagram.com/gl.autos.sf/",
    iconKey: "instagram",
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "ubicacion",
    category: LinkTreeCategory.SOCIAL,
    label: "Ver nuestra ubicación",
    href: "https://www.google.com/maps/place/GL+Autos/@-31.6552097,-60.7221098,17z/data=!3m1!4b1!4m6!3m5!1s0x95b5a98297abae09:0xbc2d98ddab36bb27!8m2!3d-31.6552097!4d-60.7221098!16s%2Fg%2F11ww7df7k8",
    iconKey: "location",
    sortOrder: 20,
    isActive: true,
  },
];
