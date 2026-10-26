"use client";

import type { PaginationProps } from "@/components/pagination/pagination";
import type { UserWithCount } from "@/types/users";

import { UserPlus } from "lucide-react";

import { AdminTable } from "@/components/admin";
import { Button } from "@/components/ui/button";
import {
  DeleteUserDialog,
  getUsersColumns,
  UserFormDialog,
  useUsersTable,
} from "@/components/users";

interface UsersTableProps {
  initialUsers: UserWithCount[];
  pagination?: PaginationProps;
}

export function UsersTable({ initialUsers, pagination }: UsersTableProps) {
  const {
    users,
    isLoading,
    isDeactivating,
    editingUser,
    userToDelete,
    setEditingUser,
    setUserToDelete,
    upsertUser,
    deactivateUser,
    sendVerification,
  } = useUsersTable(initialUsers);

  const columns = getUsersColumns({
    onEdit: setEditingUser,
    onDelete: setUserToDelete,
    onSendVerification: sendVerification,
  });

  return (
    <>
      <div className="mb-6 flex flex-row-reverse">
        <Button
          onClick={() =>
            setEditingUser({
              id: "",
              name: "",
              email: "",
              emailVerified: false,
              role: "COLLABORATOR",
              isActive: true,
              createdAt: new Date(),
              _count: { cars: 0 },
            })
          }
        >
          <UserPlus className="mr-2 size-4" />
          Agregar Usuario
        </Button>
      </div>

      <AdminTable
        data={users}
        columns={columns}
        rowKey={(u) => u.id}
        isLoading={isLoading}
        emptyState="No hay usuarios"
        pagination={pagination}
      />

      <UserFormDialog
        user={editingUser}
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSuccess={upsertUser}
      />

      <DeleteUserDialog
        user={userToDelete}
        open={!!userToDelete}
        loading={isDeactivating}
        onCancel={() => setUserToDelete(null)}
        onConfirm={deactivateUser}
      />
    </>
  );
}
