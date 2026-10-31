"use client";

import type { LeadStatusFilterValue } from "@/components/leads/leads-status-filter";
import type { LeadWithRelations } from "@/components/leads/lead-types";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminTable } from "@/components/admin";
import { LeadDetailDialog } from "@/components/leads/lead-detail-dialog";
import { getLeadsColumns } from "@/components/leads/leads-columns";
import { LeadsEmptyState } from "@/components/leads/leads-empty-state";
import {
  ALL_LEAD_STATUSES,
  LeadsStatusFilter,
} from "@/components/leads/leads-status-filter";

interface LeadsTableProps {
  leads: LeadWithRelations[];
  status: LeadStatusFilterValue;
}

/**
 * The panel's lead list. It renders what the server component queried and,
 * after a save, asks for that query again with `router.refresh()`: a lead whose
 * new status no longer matches the active filter has to leave the list, and
 * local state cannot know that.
 */
export function LeadsTable({ leads, status }: LeadsTableProps) {
  const router = useRouter();
  const [selectedLead, setSelectedLead] = useState<LeadWithRelations | null>(
    null,
  );

  const columns = getLeadsColumns({ onOpen: setSelectedLead });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <LeadsStatusFilter value={status} />
        <p className="text-muted-foreground text-sm">
          {leads.length === 1 ? "1 consulta" : `${leads.length} consultas`}
        </p>
      </div>

      <AdminTable
        data={leads}
        columns={columns}
        rowKey={(lead) => lead.id}
        emptyState={<LeadsEmptyState filtered={status !== ALL_LEAD_STATUSES} />}
      />

      <LeadDetailDialog
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onSaved={() => {
          setSelectedLead(null);
          router.refresh();
        }}
      />
    </>
  );
}
