import type { SiteAssets, SiteIdentity } from "../contract";

/**
 * The demo client, "Autos Demo".
 *
 * This package exists so the product builds and so a deployment has something to
 * copy. It is therefore **not** a real business: the name, the phone, the street,
 * the coordinates, the hours and the wording below are all invented, and none of
 * them belong to a dealership, a seller or a customer. If a value here could be
 * mistaken for somebody's details, it is the wrong value.
 *
 * The test for whether a value belongs in this file: **would the business correct
 * it by phone?** If the answer is "it changes on its own" — inventory, inquiries,
 * reviews, opening-hour exceptions — then it belongs in the database instead.
 */
export const identity: SiteIdentity = {
  name: "Autos Demo",
  description: "Catálogo de ejemplo para una concesionaria de autos usados.",
  dealerDescription:
    "Concesionaria multimarcas de autos usados y 0 km (sitio de ejemplo)",
  contact: {
    // Reserved-looking on purpose: every digit is a zero, so no call or message
    // can reach a real person. The shape is still a valid E.164 number, because
    // the `tel:` link and `wa.me` normalisation have to be exercised for real.
    phoneRaw: "+5490000000000",
    phoneDisplay: "+54 9 000 000 0000",
    whatsappMessage:
      "¡Hola! Vi el sitio de ejemplo y quiero hacer una consulta.",
    whatsappPrompt: "¿Querés consultar por un auto del catálogo de ejemplo?",
    // No `email` on purpose: any address would belong to a real mailbox, and the
    // contract makes it optional.
  },
  address: {
    street: "Calle de Ejemplo 123",
    locality: "Ciudad de Ejemplo",
    region: "Provincia de Ejemplo",
    country: "AR",
    display: "Calle de Ejemplo 123, Ciudad de Ejemplo",
  },
  // `0, 0` is the one coordinate pair that is not a place anybody works at.
  geo: { latitude: 0, longitude: 0 },
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=Calle+de+Ejemplo+123",
  // Structured hours and their human rendering are two views of one fact, kept
  // side by side so the footer and the JSON-LD cannot disagree.
  hours: [
    {
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
    { days: ["Saturday"], opens: "09:00", closes: "13:00" },
  ],
  hoursDisplay: ["Lun a Vie 9–18 hs", "Sáb 9–13 hs"],
  social: {
    // The demo has no account of its own. This is Instagram's own front page, not
    // a profile: every handle that resolves belongs to somebody real, so the one
    // honest link is the site root. It cannot be omitted, because the default
    // link-tree data publishes an Instagram entry and its href has to be a URL.
    instagram: "https://www.instagram.com/",
  },
  copyrightHolder: "Autos Demo",
};

/**
 * The asset paths are the **product's** contract, not the client's files: the UI
 * sizes them by the dimensions declared here.
 *
 * These paths currently resolve to the previous client's files. Replacing the
 * files behind them is a separate task; no name, logo or photograph of a real
 * dealership belongs in this repository.
 */
export const assets: SiteAssets = {
  wordmark: { src: "/logo-wordmark.png", width: 179, height: 19 },
  mark: { src: "/logo-mark.png", width: 42, height: 18 },
  hero: { src: "/hero.webp", width: 1440, height: 1920 },
  preview: { src: "/preview.webp", width: 1200, height: 630 },
  favicon: "/favicon.ico",
  appleIcon: "/apple-touch-icon.png",
};
