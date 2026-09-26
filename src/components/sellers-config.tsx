"use client";

import type { Seller } from "@generated/prisma/client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AdminTable, type AdminColumn } from "@/components/admin";
import {
  DeleteConfigItemDialog,
  type DeleteConfigItem,
} from "@/components/admin/delete-config-item-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { EditButton, DeleteButton } from "./admin/admin-action-buttons";

const ITEMS_PER_PAGE = 10;

const sellerFormSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "El nombre es requerido")
    .max(60, "El nombre no puede exceder 60 caracteres"),
  lastName: z
    .string()
    .trim()
    .min(1, "El apellido es requerido")
    .max(60, "El apellido no puede exceder 60 caracteres"),
  phone: z
    .string()
    .trim()
    .min(1, "El teléfono es requerido")
    .max(30, "El teléfono no puede exceder 30 caracteres"),
  email: z.union([z.string().trim().email("Email inválido"), z.literal("")]),
});

type SellerFormValues = z.infer<typeof sellerFormSchema>;

interface SellersConfigProps {
  sellers: Seller[];
  onSellersChange: (sellers: Seller[]) => void;
  currentPage: number;
  baseUrl: string;
}

const sortSellers = (items: Seller[]) =>
  [...items].sort((a, b) => {
    const last = a.lastName.localeCompare(b.lastName, "es", {
      sensitivity: "base",
    });
    if (last !== 0) return last;
    return a.firstName.localeCompare(b.firstName, "es", {
      sensitivity: "base",
    });
  });

export function SellersConfig({
  sellers,
  onSellersChange,
  currentPage,
  baseUrl,
}: SellersConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Seller | null>(null);
  const [deleting, setDeleting] = useState<DeleteConfigItem | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SellerFormValues>({
    resolver: zodResolver(sellerFormSchema),
    defaultValues: { firstName: "", lastName: "", phone: "", email: "" },
    mode: "onChange",
  });

  const totalPages = Math.ceil(sellers.length / ITEMS_PER_PAGE);
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const pagedSellers = useMemo(
    () =>
      sellers.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE),
    [sellers, safePage],
  );

  const columns: AdminColumn<Seller>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (s) => (
        <span className="font-medium">
          {s.lastName} {s.firstName}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Teléfono",
      cell: (s) => s.phone,
    },
    {
      key: "email",
      header: "Email",
      cell: (s) => s.email ?? "-",
    },
    {
      key: "actions",
      header: <span className="text-right">Acciones</span>,
      className: "text-right",
      cell: (s) => (
        <div className="flex justify-end gap-2">
          <EditButton onClick={() => openEdit(s)} />
          <DeleteButton onClick={() => openDelete(s)} />
        </div>
      ),
    },
  ];

  const openCreate = () => {
    setEditing(null);
    reset({ firstName: "", lastName: "", phone: "", email: "" });
    setIsOpen(true);
  };

  const openEdit = (s: Seller) => {
    setEditing(s);
    reset({
      firstName: s.firstName,
      lastName: s.lastName,
      phone: s.phone,
      email: s.email ?? "",
    });
    setIsOpen(true);
  };

  const openDelete = (s: Seller) => {
    const subtitle = [s.phone, s.email].filter(Boolean).join(" · ");
    setDeleting({
      id: s.id,
      title: `${s.lastName} ${s.firstName}`,
      subtitle: subtitle || undefined,
    });
    setIsDeleteOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/sellers/${id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Error al eliminar el vendedor");
        return;
      }

      onSellersChange(sellers.filter((s) => s.id !== id));
      toast.success("Vendedor eliminado");
      setIsDeleteOpen(false);
      setDeleting(null);
    } catch {
      toast.error("Error al eliminar el vendedor");
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (data: SellerFormValues) => {
    if (isSubmitting) return;

    try {
      const url = editing ? `/api/sellers/${editing.id}` : "/api/sellers";
      const method = editing ? "PUT" : "POST";

      const payload = {
        ...data,
        email: data.email.trim() ? data.email.trim() : undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Error al guardar el vendedor");
        return;
      }

      if (editing) {
        onSellersChange(
          sortSellers(
            sellers.map((s) => (s.id === json.seller.id ? json.seller : s)),
          ),
        );
        toast.success("Vendedor actualizado");
      } else {
        onSellersChange(sortSellers([json.seller, ...sellers]));
        toast.success("Vendedor creado");
      }

      setIsOpen(false);
    } catch {
      toast.error("Error al guardar el vendedor");
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger
            render={
              <Button onClick={openCreate}>
                <Plus className="mr-2 size-4" />
                Agregar Vendedor
              </Button>
            }
          />

          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar Vendedor" : "Nuevo Vendedor"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.firstName}
                  aria-describedby="seller-firstName-error"
                  {...register("firstName")}
                  className={errors.firstName ? "border-destructive" : ""}
                />
                <div className="flex h-5 items-center">
                  {errors.firstName && (
                    <p
                      id="seller-firstName-error"
                      className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                    >
                      <AlertCircle className="size-3" />
                      {errors.firstName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.lastName}
                  aria-describedby="seller-lastName-error"
                  {...register("lastName")}
                  className={errors.lastName ? "border-destructive" : ""}
                />
                <div className="flex h-5 items-center">
                  {errors.lastName && (
                    <p
                      id="seller-lastName-error"
                      className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                    >
                      <AlertCircle className="size-3" />
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.phone}
                  aria-describedby="seller-phone-error"
                  {...register("phone")}
                  className={errors.phone ? "border-destructive" : ""}
                />
                <div className="flex h-5 items-center">
                  {errors.phone && (
                    <p
                      id="seller-phone-error"
                      className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                    >
                      <AlertCircle className="size-3" />
                      {errors.phone.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (opcional)</Label>
                <Input
                  id="email"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.email}
                  aria-describedby="seller-email-error"
                  {...register("email")}
                  className={errors.email ? "border-destructive" : ""}
                />
                <div className="flex h-5 items-center">
                  {errors.email && (
                    <p
                      id="seller-email-error"
                      className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                    >
                      <AlertCircle className="size-3" />
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-w-32"
                >
                  {isSubmitting
                    ? "Guardando..."
                    : editing
                      ? "Actualizar"
                      : "Crear"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <AdminTable
        data={pagedSellers}
        columns={columns}
        rowKey={(s) => s.id}
        emptyState="No hay vendedores registrados"
        pagination={
          totalPages > 1
            ? {
                currentPage: safePage,
                totalPages,
                baseUrl,
              }
            : undefined
        }
      />

      <DeleteConfigItemDialog
        open={isDeleteOpen}
        entityLabel="el vendedor"
        item={deleting}
        loading={isDeleting}
        onCancel={() => {
          setIsDeleteOpen(false);
          setDeleting(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
