/**
 * The review domain's pure side.
 *
 * Deliberately free of database and `next/cache` imports, so the label formatter
 * can be reached from a client component without pulling Prisma into the bundle.
 * The reads live in `@/lib/queries/reviews`, the same split as `lib/cars` and
 * `lib/queries/cars`.
 */
export * from "./landing-json-ld";
export * from "./review-date";
