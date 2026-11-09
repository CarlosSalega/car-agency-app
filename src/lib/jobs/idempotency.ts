/**
 * The key that makes "publish this vehicle on this channel" one row.
 *
 * A queue without idempotency keys is a queue that publishes a vehicle twice
 * when a request is retried, and a marketplace listing costs money and creates
 * a duplicate the agency has to clean up by hand. The key is derived from the
 * logical operation only — never a timestamp, an object id or a random value —
 * so two callers that mean the same thing produce the same string.
 *
 * The operation is `(kind, channel, account, vehicle)`, which is exactly what a
 * publication is uniquely identified by in the schema: one `Publication` per
 * `[carId, channel, accountId]`. `kind` separates publish from update, pause
 * and close because they are different remote calls on the same listing.
 */

export interface JobKeyParts {
  /** `publish`, `update`, `pause`, `close`. */
  readonly kind: string;
  /** The `Channel` enum value, e.g. `MERCADOLIBRE`. */
  readonly channel: string;
  /** `ChannelAccount.id`: the same vehicle can exist on two accounts. */
  readonly accountId: string;
  /** `Car.id`. */
  readonly carId: string;
}

const SEPARATOR = ":";

/**
 * `kind:channel:accountId:carId`, with every part URI-encoded.
 *
 * Encoding matters: without it a part containing the separator could shift the
 * boundary and two different operations would collide (`a:b` + `c` versus `a` +
 * `b:c`). `encodeURIComponent` escapes `:`, so that collision cannot happen,
 * and the key stays readable in a database dump.
 */
export function buildIdempotencyKey(parts: JobKeyParts): string {
  return [parts.kind, parts.channel, parts.accountId, parts.carId]
    .map((part) => {
      if (typeof part !== "string" || part.length === 0) {
        throw new Error(
          "buildIdempotencyKey needs a non-empty kind, channel, accountId and carId: an empty part would merge two different operations into one job.",
        );
      }

      return encodeURIComponent(part);
    })
    .join(SEPARATOR);
}
