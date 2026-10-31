"use client";

import type { LeadStatus } from "@generated/prisma/enums";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useTransition } from "react";

import { LEAD_STATUS_OPTIONS } from "@/components/status-badges";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ALL_LEAD_STATUSES = "ALL";

export type LeadStatusFilterValue = LeadStatus | typeof ALL_LEAD_STATUSES;

/**
 * Status filter for the panel list.
 *
 * Filtering happens in the server component from the `status` search param, not
 * in the browser: `/admin/leads` already queries Prisma directly, and doing the
 * work there keeps the count, the pagination and the filter reading the same
 * data. The select therefore only rewrites the URL.
 */
export function LeadsStatusFilter({ value }: { value: LeadStatusFilterValue }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectId = useId();

  const options = [
    { value: ALL_LEAD_STATUSES, label: "Todas" },
    ...LEAD_STATUS_OPTIONS,
  ];

  const handleChange = (next: LeadStatusFilterValue) => {
    const params = new URLSearchParams(searchParams.toString());

    if (next === ALL_LEAD_STATUSES) {
      params.delete("status");
    } else {
      params.set("status", next);
    }

    const query = params.toString();

    startTransition(() => {
      router.push(query ? `/admin/leads?${query}` : "/admin/leads");
    });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={selectId}>Estado</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) handleChange(next as LeadStatusFilterValue);
        }}
        disabled={isPending}
      >
        <SelectTrigger id={selectId} className="w-[200px]">
          <SelectValue placeholder="Todas" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
