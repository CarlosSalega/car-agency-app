import { Badge } from "@/components/ui/badge";

type CarStatusKey =
  | "AVAILABLE"
  | "BY_APPOINTMENT"
  | "RESERVED"
  | "SOLD"
  | "INACTIVE";

export interface CarBadgeInfo {
  label: string;
  className: string;
}

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
