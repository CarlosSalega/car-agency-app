import type { LeadStatus } from "@generated/prisma/enums";

import { Badge } from "@/components/ui/badge";

type CarStatusKey =
  | "AVAILABLE"
  | "BY_APPOINTMENT"
  | "RESERVED"
  | "SOLD"
  | "INACTIVE";

export interface StatusBadgeInfo {
  label: string;
  className: string;
}

export type CarBadgeInfo = StatusBadgeInfo;

export const carStatusMap: Record<CarStatusKey, CarBadgeInfo> = {
  AVAILABLE: {
    label: "Disponible",
    className: "bg-success text-success-foreground",
  },
  BY_APPOINTMENT: {
    label: "Con cita previa",
    className: "bg-warning text-warning-foreground",
  },
  RESERVED: {
    label: "Reservado",
    className: "bg-info text-info-foreground",
  },
  SOLD: {
    label: "Vendido",
    className: "bg-accent text-foreground",
  },
  INACTIVE: {
    label: "Inactivo",
    className: "bg-muted text-muted-foreground",
  },
};

export function getCarBadge(status: string): CarBadgeInfo {
  return (
    carStatusMap[status as CarStatusKey] ?? {
      label: status,
      className: "bg-muted text-muted-foreground",
    }
  );
}

interface CarStatusBadgeProps {
  status: string;
}

export function CarStatusBadge({ status }: CarStatusBadgeProps) {
  const statusInfo = carStatusMap[status as CarStatusKey] || {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return <Badge className={statusInfo.className}>{statusInfo.label}</Badge>;
}

type UserRole = "ADMIN" | "COLLABORATOR";

const userRoleMap: Record<UserRole, { label: string; className: string }> = {
  ADMIN: {
    label: "Administrador",
    className: "bg-primary text-primary-foreground",
  },
  COLLABORATOR: {
    label: "Colaborador",
    className: "bg-accent text-foreground",
  },
};

/**
 * Lead statuses, in the order staff walk them: an inquiry arrives `NEW` and
 * ends `WON` or `LOST`.
 *
 * Typed with the generated enum instead of a local union so a status added to
 * Prisma fails to compile until it gets a label here, rather than shipping the
 * raw enum value into the panel.
 */
export const leadStatusMap: Record<LeadStatus, StatusBadgeInfo> = {
  NEW: {
    label: "Nueva",
    className: "bg-info text-info-foreground",
  },
  CONTACTED: {
    label: "Contactada",
    className: "bg-warning text-warning-foreground",
  },
  NEGOTIATING: {
    label: "En negociación",
    className: "bg-primary text-primary-foreground",
  },
  WON: {
    label: "Ganada",
    className: "bg-success text-success-foreground",
  },
  LOST: {
    label: "Perdida",
    className: "bg-muted text-muted-foreground",
  },
};

/**
 * Neutral token colours for a status the map does not know yet, e.g. a row
 * written after the enum grew and before this build shipped.
 */
const LEAD_STATUS_FALLBACK_CLASS = "bg-muted text-muted-foreground";

export function getLeadBadge(status: string): StatusBadgeInfo {
  return (
    leadStatusMap[status as LeadStatus] ?? {
      label: status,
      className: LEAD_STATUS_FALLBACK_CLASS,
    }
  );
}

interface LeadStatusBadgeProps {
  status: string;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  const statusInfo = leadStatusMap[status as LeadStatus];

  return (
    <Badge className={statusInfo?.className ?? LEAD_STATUS_FALLBACK_CLASS}>
      {statusInfo?.label ?? status}
    </Badge>
  );
}

/**
 * Options for the status filter and the status dialog, derived from the map so
 * the label a badge shows and the label a select offers cannot drift apart.
 */
export const LEAD_STATUS_OPTIONS: ReadonlyArray<{
  value: LeadStatus;
  label: string;
}> = (["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST"] as LeadStatus[]).map(
  (value) => ({ value, label: leadStatusMap[value].label }),
);

interface UserRoleBadgeProps {
  role: string;
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  const roleInfo = userRoleMap[role as UserRole] || {
    label: role,
    className: "bg-muted text-muted-foreground",
  };

  return <Badge className={roleInfo.className}>{roleInfo.label}</Badge>;
}

const activeStatusMap = {
  active: {
    label: "Activo",
    className: "bg-success text-success-foreground",
  },
  inactive: {
    label: "Inactivo",
    className: "bg-muted text-muted-foreground",
  },
};

interface ActiveStatusBadgeProps {
  isActive: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}

export function ActiveStatusBadge({
  isActive,
  activeLabel,
  inactiveLabel,
}: ActiveStatusBadgeProps) {
  const statusInfo = isActive
    ? activeStatusMap.active
    : activeStatusMap.inactive;

  const label = isActive
    ? activeLabel || statusInfo.label
    : inactiveLabel || statusInfo.label;

  return <Badge className={statusInfo.className}>{label}</Badge>;
}

interface EmailVerifiedBadgeProps {
  emailVerified: boolean;
}

/**
 * Verification is informational, never a gate: accounts are admin-provisioned
 * and `requireEmailVerification` stays false. The badge exists because a
 * mistyped address silently sends password resets to the wrong inbox.
 */
export function EmailVerifiedBadge({ emailVerified }: EmailVerifiedBadgeProps) {
  return (
    <Badge
      className={
        emailVerified
          ? "bg-success text-success-foreground"
          : "bg-warning text-warning-foreground"
      }
    >
      {emailVerified ? "Verificado" : "Sin verificar"}
    </Badge>
  );
}
