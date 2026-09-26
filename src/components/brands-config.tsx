"use client";

import type { Brand, Model } from "@prisma/client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
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

type BrandWithModels = Brand & {
  models: Model[];
};

interface BrandsConfigProps {
  brands: BrandWithModels[];
  onBrandsChange: (brands: BrandWithModels[]) => void;
  currentPage: number;
  baseUrl: string;
}

const ITEMS_PER_PAGE = 10;

const brandFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es requerido")
    .max(60, "El nombre no puede exceder 60 caracteres"),
});

type BrandFormValues = z.infer<typeof brandFormSchema>;

export function BrandsConfig({
  brands,
  onBrandsChange,
  currentPage,
  baseUrl,
}: BrandsConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [deleting, setDeleting] = useState<DeleteConfigItem | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: { name: "" },
    mode: "onChange",
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: "" });
    setIsOpen(true);
  };

  const openEdit = (b: Brand) => {
    setEditing(b);
    reset({ name: b.name });
    setIsOpen(true);
  };

  const openDelete = (brand: BrandWithModels) => {
    setDeleting({
      id: brand.id,
      title: brand.name,
      subtitle: `Modelos: ${brand.models?.length || 0}`,
    });
    setIsDeleteOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/brands/${id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Error al eliminar la marca");
        return;
      }

      onBrandsChange(brands.filter((b) => b.id !== id));
      toast.success("Marca eliminada");
      setIsDeleteOpen(false);
      setDeleting(null);
    } catch {
      toast.error("Error al eliminar la marca");
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (data: BrandFormValues) => {
    if (isSubmitting) return;

    try {
      const url = editing ? `/api/brands/${editing.id}` : "/api/brands";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Error al guardar la marca");
        return;
      }

      if (editing) {
        onBrandsChange(
          brands.map((b) =>
            b.id === json.brand.id
              ? {
                  ...b,
                  ...json.brand,
                  models: b.models ?? [],
                }
              : b,
          ),
        );
        toast.success("Marca actualizada");
      } else {
        onBrandsChange([
          {
            ...json.brand,
            models: [],
          },
          ...brands,
        ]);
        toast.success("Marca creada");
      }

      setIsOpen(false);
    } catch {
      toast.error("Error al guardar la marca");
    }
  };

  const totalPages = Math.ceil(brands.length / ITEMS_PER_PAGE);
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const pagedBrands = brands.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const columns: AdminColumn<BrandWithModels>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (brand) => <span className="font-medium">{brand.name}</span>,
    },
    {
      key: "models",
      header: "Modelos",
      cell: (brand) => brand.models?.length || 0,
    },
    {
      key: "actions",
      header: <span className="text-right">Acciones</span>,
      className: "text-right",
      cell: (brand) => (
        <div className="flex justify-end gap-2">
          <EditButton onClick={() => openEdit(brand)} />
          <DeleteButton onClick={() => openDelete(brand)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Agregar Marca
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar Marca" : "Nueva Marca"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la Marca</Label>
                <Input
                  id="name"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.name}
                  aria-describedby="brand-name-error"
                  {...register("name")}
                  className={errors.name ? "border-destructive" : ""}
                />

                <div className="flex h-5 items-center">
                  {errors.name && (
                    <p
                      id="brand-name-error"
                      className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                    >
                      <AlertCircle className="size-3" />
                      {errors.name.message}
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
        data={pagedBrands}
        columns={columns}
        rowKey={(brand) => brand.id}
        emptyState="No hay marcas registradas"
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
        entityLabel="la marca"
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
