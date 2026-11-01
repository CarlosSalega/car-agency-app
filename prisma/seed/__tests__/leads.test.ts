import { describe, expect, it } from "vitest";

import { LEAD_WEEKS, SALES_PER_WEEK, buildSeedLeads } from "../leads";

const NOW = new Date("2026-11-01T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const cars = Array.from({ length: 18 }, (_, index) => ({
  id: `car-${index}`,
  sellerId: index % 2 === 0 ? "seller-1" : null,
}));

function build(
  overrides: Parameters<typeof buildSeedLeads>[0] = { cars, now: NOW },
) {
  return buildSeedLeads(overrides);
}

describe("buildSeedLeads", () => {
  it("is deterministic, so a demo does not change its numbers on every reseed", () => {
    expect(build()).toEqual(build());
  });

  it("honours the dealership premise: eight sales per completed week", () => {
    const leads = build();
    const windowStart = NOW.getTime() - LEAD_WEEKS * 7 * DAY_MS;

    // Every week except the current one is complete and carries the full 8.
    const completedWeeks = new Map<number, number>();
    for (const lead of leads) {
      if (lead.status !== "WON") continue;
      const week = Math.floor(
        (NOW.getTime() - lead.createdAt.getTime()) / (7 * DAY_MS),
      );
      // The current week is partial and is excluded from the check.
      if (week === 0) continue;
      completedWeeks.set(week, (completedWeeks.get(week) ?? 0) + 1);
    }

    expect(completedWeeks.size).toBe(LEAD_WEEKS - 1);
    for (const count of completedWeeks.values()) {
      expect(count).toBe(SALES_PER_WEEK);
    }

    expect(leads.every((lead) => lead.createdAt.getTime() >= windowStart)).toBe(
      true,
    );
  });

  it("produces a closing rate a dealership would recognise", () => {
    const leads = build();
    const won = leads.filter((lead) => lead.status === "WON").length;
    const lost = leads.filter((lead) => lead.status === "LOST").length;
    const rate = won / (won + lost);

    expect(rate).toBeGreaterThan(0.22);
    expect(rate).toBeLessThan(0.4);
  });

  it("keeps the open pipeline in the recent weeks only", () => {
    const leads = build();
    const open = leads.filter((lead) =>
      ["NEW", "CONTACTED", "NEGOTIATING"].includes(lead.status),
    );

    expect(open.length).toBeGreaterThan(0);
    for (const lead of open) {
      const daysOld = (NOW.getTime() - lead.createdAt.getTime()) / DAY_MS;
      // An inquiry still 'NEW' after a month would inflate the waiting queue.
      expect(daysOld).toBeLessThan(15);
    }
  });

  it("never places a lead in the future", () => {
    expect(
      build().every((lead) => lead.createdAt.getTime() < NOW.getTime()),
    ).toBe(true);
  });

  it("gives every lead a consent timestamp, because it is a real record", () => {
    expect(build().every((lead) => lead.consentAt instanceof Date)).toBe(true);
  });

  it("uses fixture phone numbers nobody can dial by mistake", () => {
    expect(build().every((lead) => lead.phone.includes("555"))).toBe(true);
  });

  it("attaches most inquiries to cars, and leaves some general", () => {
    const leads = build();
    const attached = leads.filter((lead) => lead.carId !== null).length;

    expect(attached / leads.length).toBeGreaterThan(0.8);
    expect(attached / leads.length).toBeLessThan(1);
    // A car's seller travels with the inquiry.
    const withSeller = leads.filter((lead) => lead.sellerId !== null);
    expect(withSeller.every((lead) => lead.carId !== null)).toBe(true);
  });

  it("concentrates the inquiries on a few cars, so the ranking has a shape", () => {
    const leads = build();
    const perCar = new Map<string, number>();
    for (const lead of leads) {
      if (!lead.carId) continue;
      perCar.set(lead.carId, (perCar.get(lead.carId) ?? 0) + 1);
    }

    const counts = [...perCar.values()].sort((a, b) => b - a);
    expect(counts[0]).toBeGreaterThanOrEqual(counts[counts.length - 1] * 3);
  });

  it("spreads a channel mix, with most traffic from instagram", () => {
    const leads = build();
    const instagram = leads.filter(
      (lead) => lead.utmSource === "instagram",
    ).length;
    const direct = leads.filter((lead) => lead.utmSource === null).length;

    expect(instagram).toBeGreaterThan(direct);
    expect(direct).toBeGreaterThan(0);
  });

  it("marks closed inquiries with a note, so a demo shows a worked pipeline", () => {
    const leads = build();

    for (const lead of leads) {
      if (lead.status === "WON" || lead.status === "LOST") {
        expect(lead.notes).toBeTruthy();
      }
    }
  });

  it("survives a catalogue with no cars", () => {
    const leads = build({ cars: [], now: NOW });

    expect(leads.length).toBeGreaterThan(0);
    expect(leads.every((lead) => lead.carId === null)).toBe(true);
  });

  it("sorts the output oldest first, which is how the seed inserts it", () => {
    const leads = build();
    const sorted = [...leads].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    expect(leads).toEqual(sorted);
  });
});

describe("popularity and photos", () => {
  it("never tops the ranking with a car that only has a placeholder photo", () => {
    const photoless = Array.from({ length: 4 }, (_, index) => ({
      id: `placeholder-${index}`,
      sellerId: null,
      hasImages: false,
    }));
    const withPhotos = Array.from({ length: 8 }, (_, index) => ({
      id: `photo-${index}`,
      sellerId: null,
      hasImages: true,
    }));

    const leads = buildSeedLeads({
      cars: [...photoless, ...withPhotos],
      now: NOW,
    });
    const perCar = new Map<string, number>();
    for (const lead of leads) {
      if (!lead.carId) continue;
      perCar.set(lead.carId, (perCar.get(lead.carId) ?? 0) + 1);
    }

    const ranked = [...perCar.entries()].sort((a, b) => b[1] - a[1]);
    // The top car must be one with photos, even though the photoless ones come
    // first in the catalogue.
    expect(ranked[0][0].startsWith("photo-")).toBe(true);
  });
});
