import type { LeadStatus } from "@generated/prisma/enums";

import type { DashboardLead } from "@/components/leads/lead-types";

import { leadStatusMap } from "@/components/status-badges";
import {
  bucketByChannel,
  bucketByStatus,
  bucketByWeek,
  summarize,
  topCars,
} from "@/lib/leads/metrics";

import { formatLeadWeekLabel } from "./lead-format";
import { LeadsChannelChart } from "./leads-channel-chart";
import { LeadsMetricsCards } from "./leads-metrics-cards";
import { LeadsStatusChart } from "./leads-status-chart";
import { LeadsTopCarsTable } from "./leads-top-cars-table";
import { LeadsWaitingQueue } from "./leads-waiting-queue";
import { LeadsWeeklyChart } from "./leads-weekly-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** The window the weekly chart shows, in weeks. */
const WEEKS = 12;
const TOP_CARS_LIMIT = 5;
const QUEUE_LIMIT = 5;

/** In the order staff walk the pipeline, which is also the order to read it. */
const STATUSES: readonly LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "NEGOTIATING",
  "WON",
  "LOST",
];

interface LeadsDashboardProps {
  /**
   * Every lead the metrics need and nothing else. The aggregation itself lives
   * in `lib/leads/metrics.ts`, which is tested on its own; this component only
   * arranges the results.
   */
  leads: readonly DashboardLead[];
  /** Injected instead of read from the clock, so a test can pin the week. */
  now: Date;
}

/**
 * The panel landing page: are inquiries coming in, which cars generate them,
 * and who is waiting for an answer.
 *
 * Read by the dealership owner, not by an engineer. That is why every chart has
 * a sentence for the empty case, why the conversion rate is labelled as a
 * closed-lead figure, and why the queue is a list of cars and dates rather than
 * a funnel.
 *
 * A server component: only the charts ship JavaScript.
 */
export function LeadsDashboard({ leads, now }: LeadsDashboardProps) {
  const summary = summarize(leads, now);

  const weekly = bucketByWeek(leads, WEEKS, now).map((bucket) => ({
    label: formatLeadWeekLabel(bucket.weekStart),
    count: bucket.count,
  }));

  const channels = bucketByChannel(leads);

  const statuses = bucketByStatus(leads, STATUSES).map((bucket) => ({
    status: bucket.status,
    label: leadStatusMap[bucket.status].label,
    count: bucket.count,
  }));

  const cars = topCars(leads, TOP_CARS_LIMIT);

  // Not an aggregation: `summarize` already counted them. This only orders the
  // `NEW` ones the way the queue has to read them, oldest first.
  const queue = leads
    .filter((lead) => lead.status === "NEW")
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .slice(0, QUEUE_LIMIT);

  return (
    <section aria-labelledby="consultas-heading" className="space-y-6">
      <div className="space-y-1">
        <h2 id="consultas-heading" className="text-xl font-semibold">
          Consultas
        </h2>
        <p className="text-muted-foreground text-sm">
          Cuántas llegan, por qué auto y cuántas esperan respuesta.
        </p>
      </div>

      {summary.total === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Todavía no llegó ninguna consulta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Cuando alguien envíe el formulario de un vehículo, acá vas a ver
              cuántas consultas llegan, por qué auto y cuántas esperan
              respuesta. Los números de abajo arrancan en cero.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <LeadsMetricsCards summary={summary} />

      <p className="text-muted-foreground text-xs">
        La tasa de cierre cuenta solo las consultas cerradas (ganadas o
        perdidas): una consulta en curso todavía no tiene resultado.
      </p>

      <LeadsWeeklyChart data={weekly} />

      <div className="grid gap-4 lg:grid-cols-2">
        <LeadsChannelChart data={channels} />
        <LeadsStatusChart data={statuses} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LeadsTopCarsTable rows={cars} />
        <LeadsWaitingQueue leads={queue} pending={summary.pending} />
      </div>
    </section>
  );
}
