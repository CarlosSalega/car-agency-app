import type { ReactNode } from "react";

import { Facebook, Instagram, Mail, MapPin, PhoneCall } from "lucide-react";

import { TikTokIcon } from "@/components/ui/tiktok";
import { WhatsAppIcon } from "@/components/ui/whatsapp";

export type LinkTreeCategory = "CONTACT" | "SOCIAL";

export type LinkTreeLinkInput = {
  id: string;
  category: LinkTreeCategory;
  label: string;
  href: string;
  iconKey?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

export const LINKTREE_ICON_KEYS = [
  "phone",
  "whatsapp",
  "email",
  "instagram",
  "facebook",
  "tiktok",
  "location",
] as const;

export type LinkTreeIconKey = (typeof LINKTREE_ICON_KEYS)[number];

export const LINKTREE_ICON_LABELS: Record<string, string> = {
  phone: "Teléfono",
  whatsapp: "WhatsApp",
  email: "Email",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  location: "Ubicación",
};

export function renderLinkTreeIcon(
  iconKey: string | null | undefined,
): ReactNode {
  switch (iconKey) {
    case "phone":
      return <PhoneCall className="size-7" />;
    case "whatsapp":
      return <WhatsAppIcon className="size-7" />;
    case "email":
      return <Mail className="size-7" />;
    case "instagram":
      return <Instagram className="size-7" />;
    case "facebook":
      return <Facebook className="size-7" />;
    case "tiktok":
      return <TikTokIcon className="size-7" />;
    case "location":
      return <MapPin className="size-7" />;
    default:
      return null;
  }
}

export const DEFAULT_LINKTREE_LINKS: LinkTreeLinkInput[] = [
  {
    id: "telefono",
    category: "CONTACT",
    label: "Llamanos",
    href: "tel:+54 9 123 456-7890",
    iconKey: "phone",
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "whatsapp",
    category: "CONTACT",
    label: "Mensaje de WhatsApp",
    href: "https://api.whatsapp.com/send?phone=5491234567890&text=%C2%BFBuscas%20vender%20o%20comprar%20tu%20auto%3F",
    iconKey: "whatsapp",
    sortOrder: 20,
    isActive: true,
  },
  {
    id: "email",
    category: "CONTACT",
    label: "Envianos un email",
    href: "mailto:contacto@tuagencia.com.ar",
    iconKey: "email",
    sortOrder: 30,
    isActive: true,
  },
  {
    id: "instagram",
    category: "SOCIAL",
    label: "Seguinos en Instagram",
    href: "https://www.instagram.com/",
    iconKey: "instagram",
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "facebook",
    category: "SOCIAL",
    label: "Seguinos en Facebook",
    href: "https://www.facebook.com/people/Car Agency App/100092627955265/",
    iconKey: "facebook",
    sortOrder: 20,
    isActive: true,
  },
  {
    id: "tiktok",
    category: "SOCIAL",
    label: "Seguinos en TikTok",
    href: "https://www.tiktok.com/@Car Agency Appautomotores",
    iconKey: "tiktok",
    sortOrder: 30,
    isActive: true,
  },
  {
    id: "ubicacion",
    category: "SOCIAL",
    label: "Ver nuestra ubicación",
    href: "https://www.google.com/maps/",
    iconKey: "location",
    sortOrder: 20,
    isActive: true,
  },
];
