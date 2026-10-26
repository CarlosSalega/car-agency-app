import type { UserWithCount } from "@/types/users";

import { MailCheck } from "lucide-react";

import { ActionButtonsGroup, AdminColumn } from "@/components/admin";
import {
  ActiveStatusBadge,
  EmailVerifiedBadge,
  UserRoleBadge,
} from "@/components/status-badges";
import { Button } from "@/components/ui/button";

interface Params {
  onEdit: (user: UserWithCount) => void;
  onDelete: (user: UserWithCount) => void;
  onSendVerification: (user: UserWithCount) => void;
}

export function getUsersColumns({
  onEdit,
  onDelete,
  onSendVerification,
}: Params): AdminColumn<UserWithCount>[] {
  return [
    {
      key: "name",
      header: "Nombre",
      cell: (u) => u.name ?? "-",
    },
    {
      key: "email",
      header: "Email",
      cell: (u) => u.email,
    },
    {
      key: "emailVerified",
      header: "Email verificado",
      cell: (u) => <EmailVerifiedBadge emailVerified={u.emailVerified} />,
    },
    {
      key: "role",
      header: "Rol",
      cell: (u) => <UserRoleBadge role={u.role} />,
    },
    {
      key: "cars",
      header: "Vehículos",
      cell: (u) => u._count.cars,
    },
    {
      key: "status",
      header: "Estado",
      cell: (u) => <ActiveStatusBadge isActive={u.isActive} />,
    },
    {
      key: "actions",
      header: <span className="text-right">Acciones</span>,
      className: "text-right",
      cell: (u) => (
        <ActionButtonsGroup
          editOnClick={() => onEdit(u)}
          onDelete={() => onDelete(u)}
          deleteDisabled={!u.isActive}
        >
          {!u.emailVerified && u.isActive && (
            <Button
              className="hover:text-background hover:bg-info"
              variant="ghost"
              size="icon"
              onClick={() => onSendVerification(u)}
              title="Enviar verificación de email"
              aria-label="Enviar verificación de email"
            >
              <MailCheck className="size-5" />
            </Button>
          )}
        </ActionButtonsGroup>
      ),
    },
  ];
}
