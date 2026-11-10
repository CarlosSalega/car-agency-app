import type { SeedSeller } from "./types";

/**
 * A fictional seller for the demo catalogue.
 *
 * The seed used to carry a real person's name, phone and the dealership's own
 * e-mail domain. That is somebody's personal data in a repository that ships to
 * every deployment, so the demo seller is invented instead: every digit of the
 * phone is a zero, so no call or message can reach a person, and the address uses
 * `example.com`, which RFC 2606 reserves for exactly this.
 *
 * The `key` is the identifier `cars.ts` in this folder points at; it has no
 * meaning of its own beyond keeping the catalogue attached to this seller.
 */
export const seedSellers: SeedSeller[] = [
  {
    key: "vendedor-demo",
    firstName: "Demo",
    lastName: "Vendedor",
    phone: "+54 9 000 000 0000",
    email: "vendedor@example.com",
    isActive: true,
  },
];
