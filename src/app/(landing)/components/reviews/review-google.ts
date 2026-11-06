/**
 * The Google numbers the section shows next to the badge.
 *
 * These are **Google's** aggregate for the business, not ours, and they are
 * deliberately not structured data: the JSON-LD derives its `aggregateRating`
 * from the published rows so that what Google reads and what the page shows are
 * the same six reviews. Typing 4.9/249 into the markup is what the roadmap
 * removed, and it does not come back through this file.
 */
export const GOOGLE_OVERALL_RATING = 5.0;
export const GOOGLE_TOTAL_REVIEWS = 6;

/**
 * Where "Dejá tu reseña en Google" points.
 *
 * Kept as one constant because the badge and the call to action must lead to the
 * same place; two copies of this URL is how one of them rots.
 */
export const GOOGLE_REVIEW_URL =
  "https://www.google.com/search?sca_esv=e2250487dc351849&sxsrf=ANbL-n5j53RmXm8D3TYAM--iQi1foYbr3A:1774276136216&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOZghCMLCXBcllZ10uaMWmxAo8z_OP6aYRx5Pb1TKl_jRj9rlvXwtC1OrtlCfCYmGSErdkkquQtz_lBU87n6ZF8dIItPXnzVJZtQ88FDQ9q6w-s0XRw%3D%3D&q=Autos+usados+Santa+Fe+Opiniones&sa=X&ved=2ahUKEwi9ndTWnbaTAxWQp5UCHbasH28Q0bkNegQIJxAH&biw=1358&bih=682&dpr=1";
