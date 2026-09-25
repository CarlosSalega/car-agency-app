"use client";

import type { UserWithCount } from "@/types/users";

import { useState } from "react";
import { toast } from "sonner";

export function useUsersTable(initialUsers: UserWithCount[]) {
  const [users, setUsers] = useState(initialUsers);
  const [editingUser, setEditingUser] = useState<UserWithCount | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserWithCount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const upsertUser = (user: UserWithCount) => {
    setUsers((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.map((u) =>
            u.id === user.id ? { ...user, _count: u._count } : u,
          )
        : [{ ...user, _count: { cars: 0 } }, ...prev],
    );
  };

  const deactivateUser = async (user: UserWithCount) => {
    if (isDeactivating) return;
    setIsDeactivating(true);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al desactivar el usuario");
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: false } : u)),
      );
      toast.success("Usuario desactivado exitosamente");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al desactivar el usuario",
      );
    } finally {
      setUserToDelete(null);
      setIsDeactivating(false);
      setIsLoading(false);
    }
  };

  return {
    users,
    isLoading,
    isDeactivating,
    editingUser,
    userToDelete,
    setEditingUser,
    setUserToDelete,
    upsertUser,
    deactivateUser,
  };
}
