import type { SeedReview } from "./types";

/**
 * The testimonials that used to be hardcoded in `Reviews.tsx`, moved here so
 * publishing a new one stops requiring a deploy.
 *
 * Two rules this data has to respect:
 *
 * 1. **The text is the customer's, verbatim** — emoji, spacing and line breaks
 *    included. The one edit is the brand: `Car Agency App` becomes `GL Autos`,
 *    because that is the same business after the rename and the dead name must
 *    not ship inside a customer's quote.
 * 2. **`reviewedAt` is an approximation** and is documented as such. The source
 *    only ever said "hace 3 meses", so the date is that label resolved against
 *    2026-11-01. When the real dates are known they replace these values; the
 *    label the visitor reads is derived from the date and nothing else.
 *
 * `photoPath` points at the images already in `public/reviews/`. A review
 * without one is valid: `photoPath` is nullable and the card simply omits it.
 */
export const seedReviews: SeedReview[] = [
  {
    authorName: "Juli Ballester Diaz",
    rating: 5,
    reviewedAt: new Date("2026-08-01T12:00:00.000Z"),
    photoPath: "/reviews/juli-ballester.webp",
    sortOrder: 1,
    isPublished: true,
    text: `Excelente experiencia con GL Autos! 💯
Facu nos atendió de diez, fuimos con la idea de comprar un usado y nos terminamos llevando un 0km! 🥳
Los chicos siempre dispuestos a asesorarnos y a buscar las mejores opciones.
Rápido y sencillo a la hora de pagar y retirar. 💪🏼👏🏻😎
Gracias facussss!`,
  },
  {
    authorName: "Norma Soñez",
    rating: 5,
    reviewedAt: new Date("2026-07-01T12:00:00.000Z"),
    photoPath: "/reviews/norma-sonez.webp",
    sortOrder: 2,
    isPublished: true,
    text: "Gracias Facundo por la amabilidad y atención a los detalles que hizo fuese una hermosa experiencia. Gracias al equipo de la concesionaria por el respeto y la sonrisas ,No es común por eso quiero destacarlos! Gracias,y hasta el próximo auto que nos vuelva a reunir!",
  },
  {
    authorName: "Dario Ledesma",
    rating: 5,
    reviewedAt: new Date("2026-07-01T12:00:00.000Z"),
    photoPath: "/reviews/dario-ledesma.webp",
    sortOrder: 3,
    isPublished: true,
    text: `Excelente atención desde el primer momento! Buen asesoramiento y acompañamiento.
Hoy disfruto de mi 0km! Muchas gracias`,
  },
  {
    authorName: "Diego Pucheta",
    rating: 5,
    reviewedAt: new Date("2026-10-11T12:00:00.000Z"),
    photoPath: "/reviews/diego-pucheta.webp",
    sortOrder: 4,
    isPublished: true,
    text: "Excelente la atención, el asesoramiento de Lionel que me dio mucha confianza en todo, y los detalles 🎁.. un montón 👏 👏 👏 volvería a comprar",
  },
  {
    authorName: "Marisa Moreno",
    rating: 5,
    reviewedAt: new Date("2026-10-01T12:00:00.000Z"),
    photoPath: "/reviews/marisa-moreno.webp",
    sortOrder: 5,
    isPublished: true,
    text: "Excelente atención desde el día 1, muy predisuestos los chicos para asesorarnos y aconsejarnos. Muy agradecidos por su agilidad para la entrega de nuestro 0km !!!!",
  },
  {
    authorName: "Elena Cristaldi",
    rating: 5,
    reviewedAt: new Date("2026-08-01T12:00:00.000Z"),
    photoPath: "/reviews/elena-cristaldi.webp",
    sortOrder: 6,
    isPublished: true,
    text: "Excelente los chicos de GL Autos. No solo en la atención, si no en el asesoramiento, la rapidez y facilitar la papelería y la entrega!! Un millón de gracias… muy recomendable…",
  },
];
