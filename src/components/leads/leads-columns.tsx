import type { AdminColumn } from "@/components/admin/admin-table";
import type { LeadWithRelations } from "@/components/leads/lead-types";

import { Eye } from "lucide-react";
import Link from "next/link";

import { ActionButtonsGroup } from "@/components/admin/admin-action-buttons";
import { formatLeadDateTime } from "@/components/leads/lead-format";
import { LeadStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";

interface Params {
  onOpen: (lead: LeadWithRelations) => void;
}

export function getLeadsColumns({
  onOpen,
}: Params): AdminColumn<LeadWithRelations>[] {
  return [
    {
      key: "name",
      header: "Nombre",
      cell: (lead) => (
        <div className="max-w-[220px]">
          <p className="truncate font-medium" title={lead.name}>
            {lead.name}
          </p>
          <p className="text-muted-foreground truncate text-sm">
            {lead.email ?? "Sin email"}
          </p>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Teléfono",
      cell: (lead) => (
        <a
          className="text-foreground underline-offset-4 hover:underline"
          href={`tel:${lead.phone}`}
        >
          {lead.phone}
        </a>
      ),
    },
    {
      key: "car",
      header: "Vehículo",
      // The car can be gone: the relation is `onDelete: SetNull`, so a lead
      // outlives the vehicle it was about.
      cell: (lead) =>
        lead.car ? (
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href={`/autos/${lead.car.slug}`}
            title={lead.car.title}
          >
            {lead.car.title}
          </Link>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "seller",
      header: "Vendedor",
      cell: (lead) =>
        lead.seller ? (
          `${lead.seller.lastName} ${lead.seller.firstName}`
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "createdAt",
      header: "Recibida",
      cell: (lead) => formatLeadDateTime(lead.createdAt),
    },
    {
      key: "status",
      header: "Estado",
      cell: (lead) => <LeadStatusBadge status={lead.status} />,
    },
    {
      key: "actions",
      header: <span className="text-right">Acciones</span>,
      className: "text-right",
      cell: (lead) => (
        <ActionButtonsGroup>
          <Button
            className="hover:text-background hover:bg-info"
            variant="ghost"
            size="icon"
            onClick={() => onOpen(lead)}
            title="Ver consulta"
            aria-label="Ver consulta"
          >
            <Eye className="size-5" />
          </Button>
        </ActionButtonsGroup>
      ),
    },
  ];
}
