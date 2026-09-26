"use client";
import type { Brand, Model } from "@generated/prisma/client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { EditButton, DeleteButton } from "./admin/admin-action-buttons";
type BrandWithModels = Brand & {
  models: Model[];
};

type ModelRow = Model & {
  brandName: string;
};

interface ModelsConfigProps {
  brands: BrandWithModels[];
  currentPage: number;
  baseUrl: string;
}

const ITEMS_PER_PAGE = 10;

const modelFormSchema = z.object({
  brandId: z.string().min(1, "La marca es requerida"),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es requerido")
    .max(60, "El nombre no puede exceder 60 caracteres"),
});

type ModelFormValues = z.infer<typeof modelFormSchema>;

export function ModelsConfig({
  brands,
  currentPage,
  baseUrl,
}: ModelsConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Model | null>(null);
  const [deleting, setDeleting] = useState<DeleteConfigItem | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ModelFormValues>({
    resolver: zodResolver(modelFormSchema),
    defaultValues: { name: "", brandId: "" },
    mode: "onChange",
  });

  const selectedBrandId = watch("brandId");

  const models: ModelRow[] = brands.flatMap((brand) =>
    (brand.models ?? []).map((model) => ({
      ...model,
      brandName: brand.name,
    })),
  );

  const totalPages = Math.ceil(models.length / ITEMS_PER_PAGE);
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const pagedModels = models.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const columns: AdminColumn<ModelRow>[] = [
    {
      key: "brand",
      header: "Marca",
      cell: (model) => model.brandName,
    },
    {
      key: "name",
      header: "Modelo",
      cell: (model) => <span className="font-medium">{model.name}</span>,
    },
    {
      key: "actions",
      header: <span className="text-right">Acciones</span>,
      className: "text-right",
      cell: (model) => (
        <div className="flex justify-end gap-2">
          <EditButton onClick={() => openEdit(model)} />
          <DeleteButton onClick={() => openDelete(model)} />
        </div>
      ),
    },
  ];
  const openCreate = () => {
    setEditing(null);
    reset({ name: "", brandId: brands[0]?.id || "" });
    setIsOpen(true);
  };
  const openEdit = (m: Model) => {
    setEditing(m);
    reset({ name: m.name, brandId: m.brandId });
    setIsOpen(true);
  };

  const openDelete = (model: ModelRow) => {
    setDeleting({
      id: model.id,
      title: model.name,
      subtitle: model.brandName,
    });
    setIsDeleteOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/models/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Error al eliminar el modelo");
        return;
      }
      toast.success("Modelo eliminado");
      setIsDeleteOpen(false);
      setDeleting(null);
      window.location.reload();
    } catch {
      toast.error("Error al eliminar el modelo");
    } finally {
      setIsDeleting(false);
    }
  };
  const onSubmit = async (data: ModelFormValues) => {
    if (isSubmitting) return;
    try {
      const url = editing ? `/api/models/${editing.id}` : "/api/models";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok) {
        toast.error(
          json?.error || `Error al guardar el modelo (${res.status})`,
        );
        return;
      }

      toast.success(editing ? "Modelo actualizado" : "Modelo creado");
      window.location.reload();
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar el modelo");
    }
  };
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger
            render={
              <Button onClick={openCreate} disabled={brands.length === 0}>
                <Plus className="mr-2 size-4" />
                Agregar Modelo
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar Modelo" : "Nuevo Modelo"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="brandId">Marca</Label>
                <Select
                  value={selectedBrandId}
                  onValueChange={(value) =>
                    setValue("brandId", value ?? "", {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  required
                >
                  <SelectTrigger
                    aria-invalid={!!errors.brandId}
                    aria-describedby="model-brandId-error"
                  >
                    <SelectValue placeholder="Seleccionar marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex h-5 items-center">
                  {errors.brandId && (
                    <p
                      id="model-brandId-error"
                      className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                    >
                      <AlertCircle className="size-3" />
                      {errors.brandId.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nombre del Modelo</Label>
                <Input
                  id="name"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.name}
                  aria-describedby="model-name-error"
                  {...register("name")}
                  className={errors.name ? "border-destructive" : ""}
                />

                <div className="flex h-5 items-center">
                  {errors.name && (
                    <p
                      id="model-name-error"
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
      {brands.length === 0 ? (
        <div className="text-muted-foreground py-8 text-center">
          Primero debes crear al menos una marca para poder agregar modelos.
        </div>
      ) : (
        <AdminTable
          data={pagedModels}
          columns={columns}
          rowKey={(model) => model.id}
          emptyState="No hay modelos registrados"
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
      )}

      <DeleteConfigItemDialog
        open={isDeleteOpen}
        entityLabel="el modelo"
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
