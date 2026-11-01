import type { LeadSummary } from "@/lib/leads/metrics";

import { Card } from "@/components/ui/card";

interface LeadsMetricsCardsProps {
  summary: LeadSummary;
}

/**
 * The four numbers the owner opens the panel for.
 *
 * The rate is labelled as conversion *of closed inquiries* on purpose: `WON`
 * is set by hand by the staff, so it measures how diligently the pipeline is
 * updated as much as how many cars were actually sold. Calling it "tasa de
 * ventas" would turn a discipline metric into a claim.
 */
export function LeadsMetricsCards({ summary }: LeadsMetricsCardsProps) {
  const conversion = `${Math.round(summary.conversionRate * 100)}%`;

  const cards = [
    {
      title: "Consultas totales",
      value: String(summary.total),
      hint: "Desde el inicio",
    },
    {
      title: "Esta semana",
      value: String(summary.thisWeek),
      hint: "Desde el lunes",
    },
    {
      title: "Esperando respuesta",
      value: String(summary.pending),
      hint: "Sin contestar todavía",
    },
    {
      title: "Tasa de cierre",
      value: conversion,
      hint: "De las consultas cerradas",
      detail:
        summary.closed === 0
          ? "Todavía no hay consultas cerradas"
          : `${summary.won === 1 ? "1 ganada" : `${summary.won} ganadas`} de ${summary.closed} cerradas`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="gap-0 px-6 py-5">
          <p className="text-muted-foreground text-sm font-medium">
            {card.title}
          </p>
          <p className="mt-3 text-3xl font-bold tabular-nums">{card.value}</p>
          {/* Two lines reserved on purpose: the rate card carries one line more
              than the others, and without this the grid stretches the three
              short cards to match, leaving dead space under them and pushing
              the numbers out of line. */}
          <div className="mt-1 min-h-8">
            <p className="text-muted-foreground text-xs leading-4">
              {card.hint}
            </p>
            {card.detail ? (
              <p className="text-muted-foreground text-xs leading-4">
                {card.detail}
              </p>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
