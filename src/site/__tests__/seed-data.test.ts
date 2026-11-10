import { describe, expect, it } from "vitest";

import { seedData } from "@/site/seed";

// Read through the seam, so the rules below guard whatever client this
// deployment seeds -- the demo set in this repository, and the real one in the
// deployment that replaces `src/site/seed.ts`.
const {
  users: seedUsers,
  sellers: seedSellers,
  linkTree: seedLinkTreeLinks,
} = seedData;

/**
 * Guards the shape of the seed data itself.
 *
 * These assertions exist because of a real bug: three values in the seed had
 * been produced by pasting the business name where a domain was expected, so
 * they carried spaces and stray capitals. The result was
 * `facundo@Car Agency Appautomotores.com` and a `mailto:` link that could not
 * resolve. Nothing caught it, because a seed is data and data does not fail to
 * compile.
 *
 * The assertions moved with the data: the set now lives in the client package,
 * behind `src/site/seed.ts`, because the product once overwrote a deployment's
 * catalogue on every sync.
 *
 * The seed no longer carries a link-tree email at all: the domain it pointed at
 * was invented by the same rename, so it was removed instead of guessed.
 */
const allEmails = [
  ...seedUsers.map((user) => ({ source: "seedUsers", email: user.email })),
  ...seedSellers.map((seller) => ({
    source: "seedSellers",
    email: seller.email,
  })),
  ...seedLinkTreeLinks
    .filter((link) => link.href.startsWith("mailto:"))
    .map((link) => ({
      source: "seedLinkTreeLinks",
      email: link.href.slice(7),
    })),
];

const allHrefs = seedLinkTreeLinks.map((link) => link.href);

describe("seed data integrity", () => {
  it("has no email with a space or an uppercase domain", () => {
    const malformed = allEmails.filter(
      ({ email }) => /\s/.test(email) || /@[^@]*[A-Z]/.test(email),
    );

    expect(malformed).toEqual([]);
  });

  it("emails that are present are actually well formed", () => {
    // A deliberately permissive shape: one @, a non-empty local part, and a
    // dotted domain with no spaces. Not RFC 5322, just enough to catch the
    // paste accident.
    const shape = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
    const invalid = allEmails
      .map(({ source, email }) => ({ source, email }))
      .filter(({ email }) => email.length > 0 && !shape.test(email));

    expect(invalid).toEqual([]);
  });

  it("has no href containing a raw space", () => {
    // A space in a URI has to be percent-encoded. `tel:` follows RFC 3966,
    // which does not allow spaces at all.
    const withSpaces = allHrefs.filter((href) => href.includes(" "));

    expect(withSpaces).toEqual([]);
  });

  it("has every tel: href in compact international form", () => {
    const telHrefs = allHrefs.filter((href) => href.startsWith("tel:"));

    expect(telHrefs.length).toBeGreaterThan(0);
    for (const href of telHrefs) {
      expect(href).toMatch(/^tel:\+\d+$/);
    }
  });

  it("has every href with a scheme", () => {
    const schemeless = allHrefs.filter((href) => !/^[a-z]+:/i.test(href));

    expect(schemeless).toEqual([]);
  });

  it("keeps user emails unique", () => {
    const userEmails = seedUsers.map((user) => user.email.toLowerCase());

    expect(new Set(userEmails).size).toBe(userEmails.length);
  });

  it("gives every link-tree entry an id, a label and an href", () => {
    for (const link of seedLinkTreeLinks) {
      expect(link.id, `link ${link.id} is missing an id`).toBeTruthy();
      expect(link.label, `link ${link.id} is missing a label`).toBeTruthy();
      expect(link.href, `link ${link.id} is missing an href`).toBeTruthy();
    }
  });
});
