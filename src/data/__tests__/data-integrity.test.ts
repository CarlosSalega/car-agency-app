import { describe, expect, it } from "vitest";

import { DEFAULT_LINKTREE_LINKS } from "../contact";
import { activeSite } from "@/site/active";

/**
 * Guards the data the public site renders, the same way
 * `prisma/seed/__tests__/data-integrity.test.ts` guards the seed.
 *
 * That seed guard did not catch the three mangled values that shipped for
 * months, because two of them lived outside the seed: the fallback link list
 * here and `SITE_CONFIG.twitterHandle`. All three had been produced by pasting
 * the business name where a domain or a handle belonged, so they carried raw
 * spaces (`facebook.com/people/<brand name>/…`, `@<brand name>automotores`) and
 * were never valid URIs.
 *
 * `DEFAULT_LINKTREE_LINKS` is only used when the `linkTreeLink` table is empty,
 * which is exactly why a broken entry there can go unnoticed: nothing renders
 * it in a seeded environment. Data does not fail to compile, so it needs a test.
 */
const RAW_SPACE = " ";

describe("public link data integrity", () => {
  it("has no href containing a raw space", () => {
    const withSpaces = DEFAULT_LINKTREE_LINKS.filter((link) =>
      link.href.includes(RAW_SPACE),
    ).map((link) => `${link.id}: ${link.href}`);

    expect(withSpaces).toEqual([]);
  });

  it("has every href in a form a client can resolve", () => {
    for (const link of DEFAULT_LINKTREE_LINKS) {
      if (link.href.startsWith("tel:")) {
        // RFC 3966: no spaces, no formatting, compact international form.
        expect(link.href, link.id).toMatch(/^tel:\+\d+$/);
        continue;
      }

      // `new URL` rejects the spaces and stray capitals that a paste accident
      // leaves behind, which is what this guard is for.
      expect(
        () => new URL(link.href),
        `${link.id} is not a URL: ${link.href}`,
      ).not.toThrow();
    }
  });

  it("gives every entry an id, a label and an href, with unique ids", () => {
    for (const link of DEFAULT_LINKTREE_LINKS) {
      expect(link.id, `an entry is missing an id`).toBeTruthy();
      expect(link.label, `link ${link.id} is missing a label`).toBeTruthy();
      expect(link.href, `link ${link.id} is missing an href`).toBeTruthy();
    }

    const ids = DEFAULT_LINKTREE_LINKS.map((link) => link.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the site name free of stray whitespace", () => {
    expect(activeSite.identity.name).not.toMatch(/\s{2,}|\s$/);
    expect(activeSite.identity.name.length).toBeGreaterThan(0);
  });
});
