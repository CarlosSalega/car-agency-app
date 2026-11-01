"use client";

import type { UserWithCount } from "@/types/users";

import { zodResolver } from "@hookform/resolvers/zod";
import { Role } from "@generated/prisma/enums";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

/**
 * Labels for the two selects whose values are not the labels themselves.
 * Base UI's `items` prop is what makes the trigger render the label instead of
 * the stored value.
 */
const ROLE_ITEMS = {
  [Role.ADMIN]: "Administrador",
  [Role.COLLABORATOR]: "Colaborador",
} as const;

const ACTIVE_ITEMS = { active: "Activo", inactive: "Inactivo" } as const;

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserFormDialogProps {
  open: boolean;
  user: UserWithCount | null;
  onClose: () => void;
  onSuccess: (user: UserWithCount) => void;
}

type UserFormValues = {
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
};

const userSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es requerido")
    .max(80, "El nombre no puede exceder 80 caracteres"),
  email: z
    .string()
    .trim()
    .min(1, "El email es requerido")
    .email("El formato del email es inválido")
    .toLowerCase(),
  password: z
    .string()
    .trim()
    .refine((v) => v === "" || v.length >= 6, {
      message: "La contraseña debe tener al menos 6 caracteres",
    }),
  role: z.nativeEnum(Role),
  isActive: z.boolean(),
});

const DEFAULT_FORM: UserFormValues = {
  name: "",
  email: "",
  password: "",
  role: Role.COLLABORATOR,
  isActive: true,
};

export function UserFormDialog({
  open,
  user,
  onClose,
  onSuccess,
}: UserFormDialogProps) {
  const isEditing = Boolean(user?.id);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: DEFAULT_FORM,
    mode: "onChange",
  });

  const selectedRole = watch("role");
  const isActive = watch("isActive");

  useEffect(() => {
    if (!user) {
      reset(DEFAULT_FORM);
      return;
    }

    reset({
      name: user.name ?? "",
      email: user.email ?? "",
      password: "",
      role: user.role ?? Role.COLLABORATOR,
      isActive: user.isActive ?? true,
    });
  }, [reset, user]);

  const onSubmit = async (values: UserFormValues) => {
    if (isSubmitting) return;

    if (!isEditing && !values.password.trim()) {
      setError("password", { message: "La contraseña es requerida" });
      return;
    }

    const url = isEditing ? `/api/users/${user!.id}` : "/api/users";
    const method = isEditing ? "PUT" : "POST";

    const payload: any = {
      name: values.name,
      email: values.email,
      role: values.role,
      isActive: values.isActive,
    };

    if (!isEditing || values.password.trim()) {
      payload.password = values.password;
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      toast.error(data.error ?? "Error al guardar el usuario");
      return;
    }

    toast.success(
      isEditing
        ? "Usuario actualizado exitosamente"
        : "Usuario creado exitosamente",
    );
    onSuccess(data.user);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar usuario" : "Nuevo usuario"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modificá los datos del usuario"
              : "Creá un nuevo usuario del sistema"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              disabled={isSubmitting}
              aria-invalid={!!errors.name}
              aria-describedby="user-name-error"
              {...register("name")}
              className={errors.name ? "border-destructive" : ""}
            />
            <div className="flex h-5 items-center">
              {errors.name && (
                <p
                  id="user-name-error"
                  className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                >
                  <AlertCircle className="size-3" />
                  {errors.name.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              aria-describedby="user-email-error"
              {...register("email")}
              className={errors.email ? "border-destructive" : ""}
            />
            <div className="flex h-5 items-center">
              {errors.email && (
                <p
                  id="user-email-error"
                  className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                >
                  <AlertCircle className="size-3" />
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              Contraseña {isEditing && "(dejar vacío para no modificar)"}
            </Label>
            <PasswordInput
              id="password"
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              aria-describedby="user-password-error"
              {...register("password")}
              className={errors.password ? "border-destructive" : ""}
            />
            <div className="flex h-5 items-center">
              {errors.password && (
                <p
                  id="user-password-error"
                  className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                >
                  <AlertCircle className="size-3" />
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol</Label>
            <Select
              items={ROLE_ITEMS}
              value={selectedRole}
              onValueChange={(value) =>
                setValue("role", value as Role, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger
                id="role"
                aria-invalid={!!errors.role}
                aria-describedby="user-role-error"
              >
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={Role.ADMIN}>Administrador</SelectItem>
                <SelectItem value={Role.COLLABORATOR}>Colaborador</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex h-5 items-center">
              {errors.role && (
                <p
                  id="user-role-error"
                  className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                >
                  <AlertCircle className="size-3" />
                  {errors.role.message}
                </p>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                items={ACTIVE_ITEMS}
                value={isActive ? "active" : "inactive"}
                onValueChange={(value) =>
                  setValue("isActive", value === "active", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-32">
              {isSubmitting ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
