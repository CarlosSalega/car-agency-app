import { describe, expect, it } from "vitest";

import { demo } from "@/site/demo";
import { demoSeed } from "../";

/**
 * The demo set is the product's own catalogue: it ships with every checkout and a
 * deployment replaces it wholesale by pointing `src/site/seed.ts` at its own
 * package.
 *
 * The counts are pinned **here**, next to the data, and not in the seam test: a
 * deployment with a different inventory must not fail a test that the product
 * runs against its own demo.
 */
describe("the demo seed set", () => {
  it("ships the catalogue the product publishes", () => {
    expect(demoSeed.cars.length).toBe(18);
    expect(demoSeed.sellers.length).toBe(1);
    expect(demoSeed.users.length).toBe(1);
    expect(demoSeed.linkTree.length).toBe(4);
    expect(demoSeed.imageManifest.entries.length).toBe(18);
  });

  it("keeps one vehicle key per vehicle, because the slug and the photos are keyed by it", () => {
    const keys = demoSeed.cars.map((car) => car.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("cannot reach a person: one invented number and reserved mailboxes", () => {
    // `+54 9` followed by nothing but zeros is a valid E.164 shape whose
    // subscriber part cannot belong to anybody, and `example.com` is the domain
    // RFC 2606 reserves for exactly this. A demo catalogue that dials a real
    // number or writes to a mailbox somebody owns publishes it from every
    // deployment of this product.
    const digits = (source: string) => source.replace(/\D/g, "");
    const demoNumber = digits(demo.identity.contact.phoneRaw);

    expect(demoNumber).toMatch(/^5490+$/);

    for (const seller of demoSeed.sellers) {
      expect(digits(seller.phone), seller.key).toBe(demoNumber);
      expect(seller.email, seller.key).toMatch(/@example\.com$/);
    }

    for (const user of demoSeed.users) {
      expect(user.email, user.key).toMatch(/@example\.com$/);
    }

    for (const link of demoSeed.linkTree) {
      if (link.href.startsWith("tel:")) {
        expect(digits(link.href), link.id).toBe(demoNumber);
      }

      const whatsapp = link.href.match(/[?&]phone=(\d+)/)?.[1];
      if (whatsapp) expect(whatsapp, link.id).toBe(demoNumber);
    }
  });
});
