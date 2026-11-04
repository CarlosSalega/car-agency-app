import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { glautos } from "@/site/glautos";

/**
 * The client package answers two questions that must not disagree.
 *
 * CSS cannot import TypeScript, so `theme.css` feeds the stylesheet and
 * `glautos.ts` feeds anything that needs a colour at runtime (the admin's tab
 * colour, a generated image). Two sources for one value is a bug that stays
 * invisible until somebody compares a tab with a sidebar, so a test compares them
 * now.
 */
const THEME_CSS = path.resolve(__dirname, "../glautos/theme.css");

function cssToken(source: string, name: string): string | undefined {
  return source.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();
}

describe("the GL Autos package is internally consistent", () => {
  const css = fs.readFileSync(THEME_CSS, "utf8");

  it("declares the same brand colours in CSS and in TypeScript", () => {
    expect(cssToken(css, "brand")?.toLowerCase()).toBe(
      glautos.theme.brand.toLowerCase(),
    );
    expect(cssToken(css, "brand-foreground")?.toLowerCase()).toBe(
      glautos.theme.brandForeground.toLowerCase(),
    );
  });

  it("derives the tel: link from the published number", () => {
    expect(glautos.whatsapp.telHref).toBe(
      `tel:${glautos.identity.contact.phoneRaw}`,
    );
  });

  it("gives wa.me digits, because the API rejects the +", () => {
    expect(glautos.whatsapp.digits).toMatch(/^\d+$/);
    expect(glautos.whatsapp.digits).toBe(
      glautos.identity.contact.phoneRaw.replace(/\D/g, ""),
    );
  });

  it("prefills the WhatsApp links with the client's own words", () => {
    expect(glautos.whatsapp.href).toContain(glautos.whatsapp.digits);
    expect(decodeURIComponent(glautos.whatsapp.href)).toContain(
      glautos.identity.contact.whatsappPrompt,
    );
  });

  it("gives every static page a title and a description", () => {
    for (const [page, copy] of Object.entries(glautos.seo.pages)) {
      expect(copy.title.trim(), page).not.toBe("");
      expect(copy.description.trim(), page).not.toBe("");
    }
  });

  it("publishes hours the footer can render", () => {
    expect(glautos.identity.hours.length).toBeGreaterThan(0);
    expect(glautos.identity.hoursDisplay.length).toBeGreaterThan(0);
    for (const window of glautos.identity.hours) {
      expect(window.opens).toMatch(/^\d{2}:\d{2}$/);
      expect(window.closes).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it("ships assets with the dimensions the metadata will claim", () => {
    for (const asset of [glautos.assets.preview]) {
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      expect(asset.src.startsWith("/")).toBe(true);
    }
  });
});
