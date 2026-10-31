// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { cloneElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardLead } from "@/components/leads/lead-types";

import { LeadsDashboard } from "../leads-dashboard";

/**
 * jsdom measures every element as 0x0 and ships no `ResizeObserver`, so
 * recharts' `ResponsiveContainer` never hands a chart a size and nothing
 * renders. Instead of asserting on rendered SVG paths, the container is
 * replaced by a fixed-size wrapper: the chart still mounts for real, it just
 * gets its dimensions from the test.
 */
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();

  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: ReactElement<{ width?: number; height?: number }>;
    }) => <div>{cloneElement(children, { width: 480, height: 240 })}</div>,
  };
});

/**
 * 2026-11-04 is a Wednesday, and Argentina's week starts on Monday 2026-11-02
 * at 03:00Z, so the fixtures below split cleanly into "this week" and before.
 */
const NOW = new Date("2026-11-04T12:00:00.000Z");

function lead(overrides: Partial<DashboardLead> = {}): DashboardLead {
  return {
    name: "Ana Pérez",
    status: "NEW",
    createdAt: new Date("2026-11-03T15:00:00.000Z"),
    utmSource: null,
    car: null,
    ...overrides,
  };
}

/**
 * Five leads: two still waiting, one won, one lost, one negotiating. The
 * expected numbers below are the ones a dealership owner would read off the
 * page, so they are written out by hand rather than recomputed with the same
 * functions the dashboard uses.
 */
const FIXTURE: DashboardLead[] = [
  lead({
    createdAt: new Date("2026-10-30T15:00:00.000Z"),
    utmSource: "instagram",
    car: { title: "Toyota Hilux 2022" },
  }),
  lead({
    createdAt: new Date("2026-11-03T15:00:00.000Z"),
    car: { title: "Volkswagen Taos 2025" },
  }),
  lead({
    status: "WON",
    createdAt: new Date("2026-11-02T15:00:00.000Z"),
    utmSource: "google",
    car: { title: "Toyota Hilux 2022" },
  }),
  lead({
    status: "LOST",
    createdAt: new Date("2026-10-28T15:00:00.000Z"),
    utmSource: "instagram",
  }),
  lead({
    status: "NEGOTIATING",
    createdAt: new Date("2026-11-04T10:00:00.000Z"),
    car: { title: "Toyota Hilux 2022" },
  }),
];

/** The card whose title is exactly `title`. */
function card(title: string): HTMLElement {
  const element = screen.getByText(title).closest("[data-slot='card']");
  if (!element) throw new Error(`No card titled "${title}"`);

  return element as HTMLElement;
}

describe("LeadsDashboard with no leads", () => {
  it("shows human messages instead of empty axes and still reads as a finished page", () => {
    const { container } = render(<LeadsDashboard leads={[]} now={NOW} />);

    // The state the owner actually sees first: the database is empty today.
    expect(screen.getByText("Todavía no llegó ninguna consulta")).toBeTruthy();
    expect(
      screen.getByText("Todavía no hay consultas en las últimas 12 semanas."),
    ).toBeTruthy();
    expect(
      screen.getByText("Todavía no hay canales para mostrar."),
    ).toBeTruthy();
    expect(
      screen.getByText("Todavía no hay estados para mostrar."),
    ).toBeTruthy();
    expect(screen.getByText("Todavía no hay autos consultados.")).toBeTruthy();
    expect(
      screen.getByText("No hay consultas esperando respuesta."),
    ).toBeTruthy();

    // No chart is mounted at all, so there are no axes to mislead anyone.
    expect(container.querySelectorAll(".recharts-surface")).toHaveLength(0);

    // The counters are zero, not blank, and the rate is honest about it.
    expect(within(card("Consultas totales")).getByText("0")).toBeTruthy();
    expect(within(card("Esta semana")).getByText("0")).toBeTruthy();
    expect(within(card("Esperando respuesta")).getByText("0")).toBeTruthy();
    expect(within(card("Tasa de cierre")).getByText("0%")).toBeTruthy();
    expect(
      within(card("Tasa de cierre")).getByText("De las consultas cerradas"),
    ).toBeTruthy();
  });
});

describe("LeadsDashboard with leads", () => {
  it("shows the counters the metrics compute for the fixture", () => {
    const { container } = render(<LeadsDashboard leads={FIXTURE} now={NOW} />);

    expect(within(card("Consultas totales")).getByText("5")).toBeTruthy();
    expect(within(card("Esta semana")).getByText("3")).toBeTruthy();
    expect(within(card("Esperando respuesta")).getByText("2")).toBeTruthy();

    // 1 won of 2 closed, labelled as closed-lead conversion, not a fact.
    const rate = within(card("Tasa de cierre"));
    expect(rate.getByText("50%")).toBeTruthy();
    expect(rate.getByText("De las consultas cerradas")).toBeTruthy();

    // With data the charts replace their empty messages.
    expect(screen.queryByText("Todavía no llegó ninguna consulta")).toBeNull();
    expect(container.querySelectorAll(".recharts-surface")).toHaveLength(3);
  });

  it("ranks the most consulted cars and queues the new leads oldest first", () => {
    render(<LeadsDashboard leads={FIXTURE} now={NOW} />);

    const carRows = within(card("Autos más consultados")).getAllByRole("row");
    // Header plus the two cars that have inquiries.
    expect(carRows).toHaveLength(3);
    expect(carRows[1].textContent).toContain("Toyota Hilux 2022");
    expect(carRows[1].textContent).toContain("3");
    expect(carRows[2].textContent).toContain("Volkswagen Taos 2025");

    const queued = within(card("Consultas sin responder")).getAllByRole("link");
    expect(queued).toHaveLength(2);
    expect(queued[0].getAttribute("href")).toBe("/admin/leads");
    expect(queued[0].textContent).toContain("Toyota Hilux 2022");
    expect(queued[1].textContent).toContain("Volkswagen Taos 2025");
  });
});
