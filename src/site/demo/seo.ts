import type { SiteSeo } from "../contract";

/**
 * The words on the pages that do not take their text from the database.
 *
 * A page's copy is a per-client decision, not a routing one: the route at
 * `/catalogo` stays, what it is called is the client's answer. These strings are
 * written to describe a demo on purpose — a deployment replaces this file with
 * its own copy.
 */
export const seo: SiteSeo = {
  locale: "es_AR",
  pages: {
    home: {
      title: "Autos usados de ejemplo | Autos Demo",
      description:
        "Sitio de ejemplo de una concesionaria: catálogo de autos usados y 0 km, financiación y asesoramiento. Todo el contenido es ficticio y sirve como demostración.",
    },
    catalog: {
      title: "Catálogo de autos de ejemplo | Autos Demo",
      description:
        "Explorá el catálogo de ejemplo: autos usados y 0 km con fotos, ficha técnica y precio de referencia. Los vehículos y los datos son ficticios.",
    },
  },
};
