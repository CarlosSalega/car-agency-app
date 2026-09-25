import { Search } from "lucide-react";
export const HERO_FEATURES = [
  {
    id: "garantia",
    label: "Garantía",
    icon: "✓",
    iconColor: "text-green-400",
  },
  {
    id: "historial",
    label: "Historial",
    icon: "✓",
    iconColor: "text-green-400",
  },
  {
    id: "financiacion",
    label: "Financiación",
    icon: "✓",
    iconColor: "text-green-400",
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
    href: "https://api.whatsapp.com/send?phone=5491234567890&text=%C2%BFBuscas%20vender%20o%20comprar%20tu%20auto%3F",
    icon: "/whatsapp.png",
  },
};
