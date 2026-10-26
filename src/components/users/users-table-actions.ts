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
  const [sendingVerificationFor, setSendingVerificationFor] = useState<
    string | null
  >(null);

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

  /**
   * Asks the server to mail a verification link. The address is resolved from
   * the database row, never sent from here, so this cannot be pointed at an
   * arbitrary inbox.
   */
  const sendVerification = async (user: UserWithCount) => {
    if (sendingVerificationFor) return;

    setSendingVerificationFor(user.id);

    try {
      const res = await fetch(`/api/users/${user.id}/verify-email`, {
        method: "POST",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error ?? "No se pudo enviar la verificación");
      }

      toast.success(body?.message ?? "Enviamos un enlace de verificación");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo enviar la verificación",
      );
    } finally {
      setSendingVerificationFor(null);
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
    sendVerification,
  };
}
