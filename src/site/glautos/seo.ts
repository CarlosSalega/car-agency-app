import type { SiteSeo } from "../contract";

/**
 * The words on the pages that do not take their text from the database.
 *
 * These strings used to live in each page's `metadata` block, repeated three
 * times (metadata, `openGraph`, `twitter`) and carrying the client's name and
 * city. A page's copy is a per-client decision, not a routing one: the route at
 * `/autos` stays, what it is called is GL Autos' answer.
 *
 * Note the asymmetry that is easy to miss: `title` and `description` are copy,
 * but the *shape* of a title ("Catálogo de … | Marca") is product. When client #2
 * arrives with a shorter name, the shared helper in `contract.ts` is where that
 * has to be solved — not in twelve pages.
 */
export const seo: SiteSeo = {
  locale: "es_AR",
  pages: {
    home: {
      title: "Autos usados y 0km en Santa Fe | GL Autos",
      description:
        "Comprá o vendé tu auto en Santa Fe con GL Autos: atención personalizada, financiación a medida y unidades usadas y 0km seleccionadas. ¡Visitános hoy!",
    },
    catalog: {
      title: "Catálogo de autos usados y 0km en Santa Fe | GL Autos",
      description:
        "Explorá el catálogo de GL Autos: autos usados y 0km en Santa Fe con revisión mecánica garantizada y financiación a medida. ¡Encontrá el tuyo hoy!",
    },
    contact: {
      title: "Contacto en Santa Fe: escribinos | GL Autos",
      description:
        "Contactá a GL Autos en General López 3543, Santa Fe: WhatsApp, teléfono e Instagram. Atención personalizada para comprar o vender tu auto.",
    },
    sell: {
      title: "Vendé tu auto en 48 horas en Santa Fe | GL Autos",
      description:
        "Vendé tu auto en Santa Fe con GL Autos: tasación inmediata, transferencia segura en 48 horas hábiles y pago rápido. ¡Envianos tus datos por WhatsApp!",
    },
  },
};
