// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LeadWithRelations } from "../lead-types";
import { LeadsTable } from "../leads-table";

/**
 * Pins what staff actually read in the lead dialog.
 *
 * Attribution that only reaches the database is attribution nobody uses: the
 * point of T1.5 is that the person answering the phone sees the channel. The
 * dialog renders on open, so a check against the server-rendered HTML proves
 * nothing — an earlier attempt to grep the page for the campaign passed only
 * because the value was sitting in serialized React props.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/leads",
  // The status filter reads the URL, and the table renders it.
  useSearchParams: () => new URLSearchParams(),
}));

function buildLead(
  overrides: Partial<LeadWithRelations> = {},
): LeadWithRelations {
  const base: LeadWithRelations = {
    id: "lead-1",
    name: "Ana Pérez",
    phone: "351 555 0123",
    email: null,
    message: "¿Está disponible?",
    status: "NEW",
    source: "http://localhost:3000/autos/volkswagen-taos-2025",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    referrer: null,
    consentAt: new Date("2026-10-30T12:00:00Z"),
    notes: null,
    createdAt: new Date("2026-10-30T12:00:00Z"),
    updatedAt: new Date("2026-10-30T12:00:00Z"),
    car: { title: "Volkswagen Taos 2025", slug: "volkswagen-taos-2025" },
    seller: null,
  };

  return { ...base, ...overrides };
}

describe("lead detail attribution", () => {
  it("shows source, medium and campaign as one channel line", async () => {
    const { dialog } = await openDialogWith(
      buildLead({
        utmSource: "instagram",
        utmMedium: "cpc",
        utmCampaign: "hilux-octubre",
        referrer: "l.instagram.com/stories/marca/123",
      }),
    );

    expect(
      within(dialog).getByText("instagram · cpc · hilux-octubre"),
    ).toBeTruthy();
    expect(
      within(dialog).getByText(/desde l\.instagram\.com\/stories\/marca\/123/),
    ).toBeTruthy();
  });

  it("falls back to a readable label when the visitor arrived with no campaign", async () => {
    const { dialog } = await openDialogWith(buildLead());

    expect(within(dialog).getByText("Directo")).toBeTruthy();
  });

  it("still shows the page on our site that produced the inquiry", async () => {
    const { dialog } = await openDialogWith(buildLead());

    expect(
      within(dialog).getByText(/en http:\/\/localhost:3000\/autos\//),
    ).toBeTruthy();
  });
});

/** Renders one lead and opens its dialog. */
async function openDialogWith(lead: LeadWithRelations) {
  const user = userEvent.setup();
  render(<LeadsTable leads={[lead]} status="NEW" />);
  await user.click(screen.getByRole("button", { name: "Ver consulta" }));

  return { user, dialog: await screen.findByRole("dialog") };
}
