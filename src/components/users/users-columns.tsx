import type { UserWithCount } from "@/types/users";

import { ActionButtonsGroup, AdminColumn } from "@/components/admin";
import { UserRoleBadge, ActiveStatusBadge } from "@/components/status-badges";

interface Params {
  onEdit: (user: UserWithCount) => void;
  onDelete: (user: UserWithCount) => void;
}

export function getUsersColumns({
  onEdit,
  onDelete,
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
        />
      ),
    },
  ];
}
