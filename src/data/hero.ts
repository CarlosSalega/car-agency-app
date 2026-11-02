import { Search } from "lucide-react";

import { activeSite } from "@/site/active";
export const HERO_FEATURES = [
  {
    id: "garantia",
    label: "Garantía",
    icon: "✓",
    iconColor: "text-success",
  },
  {
    id: "historial",
    label: "Historial",
    icon: "✓",
    iconColor: "text-success",
  },
  {
    id: "financiacion",
    label: "Financiación",
    icon: "✓",
    iconColor: "text-success",
  },
];

export const HERO_CONTENT = {
  title: {
    main: "Tu auto ideal",
    highlight: " Tu Agencia",
  },
  description: [
    "Descubrí nuestra selección de vehículos usados y 0km.",
    "Calidad y confianza garantizada, financiación disponible.",
  ],
  search: {
    placeholder: "Buscá tu próximo auto ...",
    buttonText: "Buscar Autos",
    buttonIcon: Search,
  },
  contact: {
    id: "whatsapp",
    label: "¿Necesitás asesoramiento?",
    actionText: "Contactanos",
    href: activeSite.whatsapp.href,
    icon: "/whatsapp.svg",
  },
};
