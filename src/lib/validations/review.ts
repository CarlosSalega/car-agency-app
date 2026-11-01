import { z } from "zod";

/**
 * Validation for the staff-side testimonial write, and for the edit.
 *
 * Messages are Spanish because the panel shows them to the person typing; the
 * code around them stays English.
 *
 * Three rules carry real weight:
 *
 * 1. **`reviewedAt` cannot be in the future.** The card derives "hace 3 meses"
 *    from this date, so a date typed in 2030 would render "hoy" forever.
 * 2. **`rating` is a whole star from 1 to 5.** 4.5 is not a rating the star row
 *    can draw, and it would poison the average Google reads.
 * 3. **`photoPath` has to be a path we serve.** An external URL would render an
 *    image the `public-assets` sweep cannot verify, and a relative one 404s.
 */

const MIN_NAME = 2;
const MAX_NAME = 80;
const MIN_TEXT = 10;
const MAX_TEXT = 2000;
const MAX_SORT_ORDER = 100_000;

const IMAGE_EXTENSION = /\.(png|jpe?g|svg|webp|avif|gif|ico)$/i;
const SERVED_PATH = /^\/[A-Za-z0-9._@/-]+$/;

const trimmed = (value: unknown) =>
  typeof value === "string" ? value.trim() : value;

/**
 * An empty string is what a cleared input sends, and it means "no photo" — not
 * "invalid path". The same preprocess turns it into `null`, which is the column
 * value that clears it on an edit.
 */
const photoPathSchema = z.preprocess((value) => {
  const clean = trimmed(value);

  return clean === "" ? null : clean;
}, z.string().max(300, "La ruta de la foto es demasiado larga").regex(SERVED_PATH, "La foto tiene que ser una ruta de la web, por ejemplo /reviews/cliente.webp").regex(IMAGE_EXTENSION, "La foto tiene que ser una imagen (webp, jpg, png, avif, svg o gif)").nullable().optional());

const futureDateMessage = "La fecha de la reseña no puede ser futura";

const fields = {
  authorName: z.preprocess(
    trimmed,
    z
      .string()
      .min(MIN_NAME, `El nombre tiene que tener al menos ${MIN_NAME} letras`)
      .max(MAX_NAME, `El nombre no puede superar los ${MAX_NAME} caracteres`),
  ),
  rating: z.coerce
    .number()
    .int("La calificación tiene que ser un número entero de estrellas")
    .min(1, "La calificación mínima es 1 estrella")
    .max(5, "La calificación máxima es 5 estrellas"),
  text: z.preprocess(
    trimmed,
    z
      .string()
      .min(
        MIN_TEXT,
        `La reseña tiene que tener al menos ${MIN_TEXT} caracteres`,
      )
      .max(MAX_TEXT, `La reseña no puede superar los ${MAX_TEXT} caracteres`),
  ),
  reviewedAt: z.coerce
    .date({ message: "La fecha de la reseña no es válida" })
    .refine((value) => value.getTime() <= Date.now(), futureDateMessage),
  photoPath: photoPathSchema,
  sortOrder: z.coerce
    .number()
    .int("El orden tiene que ser un número entero")
    .min(0, "El orden no puede ser negativo")
    .max(MAX_SORT_ORDER, "El orden es demasiado grande")
    .optional(),
  isPublished: z.boolean().optional(),
} as const;

export const reviewCreateSchema = z.object(fields);

/**
 * The edit. Every field is optional, but an empty body is rejected: a PATCH that
 * changes nothing is a bug in the panel, not a no-op worth a 200.
 */
export const reviewUpdateSchema = z
  .object(fields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "No hay nada para actualizar",
  );

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;
