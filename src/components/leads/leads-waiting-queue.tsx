import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { DashboardLead } from "@/components/leads/lead-types";

import { formatLeadDateTime } from "@/components/leads/lead-format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface LeadsWaitingQueueProps {
  /** The `NEW` leads, oldest first, already capped by the dashboard. */
  leads: readonly DashboardLead[];
  /** How many are waiting in total, so a capped list can say what it hides. */
  pending: number;
}

/**
 * Who is waiting for an answer.
 *
 * The queue is ordered oldest first, not newest first: the inquiry that has
 * been ignored the longest is the one costing the dealership money, and a
 * newest-first list would bury it.
 *
 * Each row links to the leads section rather than to a lead: the dashboard
 * query deliberately reads only the fields the metrics need, and the panel's
 * list is where the contact data lives.
 */
export function LeadsWaitingQueue({ leads, pending }: LeadsWaitingQueueProps) {
  return (
    <Card className="py-6">
      <CardHeader>
        <CardTitle>Consultas sin responder</CardTitle>
        <CardDescription>Las más viejas primero</CardDescription>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
            <p className="text-foreground text-sm font-medium">
              No hay consultas esperando respuesta.
            </p>
            <p className="text-muted-foreground text-xs">
              Todo lo que llegó ya tiene respuesta.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-1">
              {leads.map((lead, index) => (
                <li
                  key={`${lead.createdAt.getTime()}-${lead.car?.title ?? "sin-auto"}-${index}`}
                >
                  <Link
                    href="/admin/leads"
                    className="hover:bg-accent focus-visible:ring-ring flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="min-w-0">
                      <span className="text-foreground block truncate text-sm font-medium">
                        <span className="text-foreground">{lead.name}</span>
                        <span className="text-muted-foreground">
                          {" · "}
                          {lead.car?.title ?? "Consulta general"}
                        </span>
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {formatLeadDateTime(lead.createdAt)}
                      </span>
                    </span>
                    <ChevronRight
                      className="text-muted-foreground size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>

            {pending > leads.length ? (
              <p className="text-muted-foreground mt-2 text-xs">
                Y {pending - leads.length} más.{" "}
                <Link
                  href="/admin/leads"
                  className="text-foreground underline underline-offset-4"
                >
                  Ver todas
                </Link>
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
