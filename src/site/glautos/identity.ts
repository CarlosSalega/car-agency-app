import type { SiteAssets, SiteIdentity } from "../contract";

/**
 * GL Autos, Santa Fe.
 *
 * Everything in this file is a fact about the business. The test for whether a
 * value belongs here: **would the dealership correct it by phone?** If the answer
 * is "it changes on its own" — inventory, inquiries, reviews, opening-hour
 * exceptions — then it belongs in the database and not in this file.
 *
 * The two prefilled WhatsApp messages are here on purpose. They are not
 * infrastructure: they are what the shop says to a customer, and the next client
 * will word it differently.
 */
export const identity: SiteIdentity = {
  name: "GL Autos",
  description: "Vení y encontrá el auto de tus sueños.",
  dealerDescription: "Concesionaria multimarcas de usados seleccionados y 0 km",
  contact: {
    phoneRaw: "+5493425777646",
    phoneDisplay: "+54 9 342 577 7646",
    whatsappMessage: "Hola! Vi tu página y quiero consultar por un auto 🚗",
    whatsappPrompt: "¿Buscas vender o comprar tu auto?",
  },
  address: {
    street: "General López 3543",
    locality: "Santa Fe",
    region: "Santa Fe",
    country: "AR",
    display: "General López 3543, Santa Fe",
  },
  geo: { latitude: -31.6552097, longitude: -60.7221098 },
  mapsUrl:
    "https://www.google.com/maps/place/GL+Autos/@-31.6552097,-60.7221098,17z/data=!3m1!4b1!4m6!3m5!1s0x95b5a98297abae09:0xbc2d98ddab36bb27!8m2!3d-31.6552097!4d-60.7221098!16s%2Fg%2F11ww7df7k8",
  // Structured hours and their human rendering are two views of one fact. They
  // are kept side by side so adding a holiday cannot leave the footer claiming a
  // window the JSON-LD does not publish.
  hours: [
    {
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:30",
      closes: "12:30",
    },
    {
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "16:00",
      closes: "20:00",
    },
    { days: ["Saturday"], opens: "09:00", closes: "12:30" },
  ],
  hoursDisplay: ["Lun a Vie 8:30–12:30 y 16–20 hs", "Sáb 9–12:30 hs"],
  social: {
    instagram: "https://www.instagram.com/gl.autos.sf/",
  },
  copyrightHolder: "GL Autos",
};

export const assets: SiteAssets = {
  wordmark: { src: "/logo-wordmark.png", width: 179, height: 19 },
  mark: { src: "/logo-mark.png", width: 42, height: 18 },
  hero: { src: "/hero.webp", width: 1440, height: 1920 },
  preview: { src: "/preview.webp", width: 1200, height: 630 },
  previewSquare: { src: "/preview.webp", width: 1200, height: 1200 },
  favicon: "/favicon.ico",
  appleIcon: "/apple-touch-icon.png",
};
