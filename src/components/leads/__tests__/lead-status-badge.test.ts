import { LeadStatus } from "@generated/prisma/enums";
import { describe, expect, it } from "vitest";

import { getLeadBadge, leadStatusMap } from "@/components/status-badges";

/**
 * The panel has one dark theme driven by tokens in `globals.css`. A Tailwind
 * colour scale or a raw hex in a badge renders a different colour in light and
 * dark and ignores every future theme change, so the class names are asserted
 * to be semantic tokens, not just "some classes".
 *
 * The map is the only place a lead status becomes visible text, so a status the
 * enum gains and the map forgets would ship an untranslated value.
 */
const TOKEN_CLASS =
  /^(bg|text|border)-(background|card|foreground|muted|muted-foreground|subtle-foreground|border|primary|primary-foreground|success|success-foreground|warning|warning-foreground|info|info-foreground|destructive|destructive-foreground|accent|accent-foreground)$/;

const SCALE_CLASS =
  /\b(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

describe("lead status badges", () => {
  it("gives every LeadStatus a Spanish label", () => {
    for (const status of Object.values(LeadStatus)) {
      expect(leadStatusMap[status], status).toBeDefined();
      expect(leadStatusMap[status].label, status).not.toBe("");
      // Labels are user-facing, so they are Spanish: lowercase words, no enum
      // screaming case leaking into the UI.
      expect(leadStatusMap[status].label, status).not.toBe(status);
    }
  });

  it("uses only semantic token classes, never a colour scale or a hex", () => {
    for (const status of Object.values(LeadStatus)) {
      const { className } = leadStatusMap[status];

      expect(className, status).not.toMatch(SCALE_CLASS);
      expect(className, status).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(className, status).not.toMatch(/\bdark:/);

      for (const token of className.split(/\s+/).filter(Boolean)) {
        expect(token, `${status}: ${token}`).toMatch(TOKEN_CLASS);
      }
    }
  });

  it("falls back to a neutral token badge for an unknown status", () => {
    expect(getLeadBadge("SOMETHING_ELSE")).toMatchObject({
      label: "SOMETHING_ELSE",
      className: expect.stringContaining("bg-muted"),
    });
  });
});
