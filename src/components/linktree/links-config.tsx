"use client";

import type { LinkTreeCategory, LinkTreeLink } from "@prisma/client";

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
import { ActiveStatusBadge } from "@/components/status-badges";
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
import {
  LINKTREE_ICON_KEYS,
  LINKTREE_ICON_LABELS,
  renderLinkTreeIcon,
} from "@/data/contact";

import { DeleteButton, EditButton } from "../admin/admin-action-buttons";

const ITEMS_PER_PAGE = 10;

const linkFormSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "El título es requerido")
    .max(80, "El título no puede exceder 80 caracteres"),
  href: z
    .string()
    .trim()
    .min(1, "El enlace es requerido")
    .max(500, "El enlace no puede exceder 500 caracteres"),
  iconKey: z.string().trim().optional(),
  sortOrder: z
    .number()
    .int("El orden debe ser un número entero")
    .min(1, "El orden debe estar entre 1 y 5")
    .max(5, "El orden debe estar entre 1 y 5"),
  isActive: z.enum(["true", "false"]),
});

type LinkFormValues = z.infer<typeof linkFormSchema>;

interface LinkTreeLinksConfigProps {
  category: LinkTreeCategory;
  links: LinkTreeLink[];
  onLinksChange: (links: LinkTreeLink[]) => void;
  currentPage: number;
  baseUrl: string;
}

export function LinkTreeLinksConfig({
  category,
  links,
  onLinksChange,
  currentPage,
  baseUrl,
}: LinkTreeLinksConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<LinkTreeLink | null>(null);
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
  } = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: {
      label: "",
      href: "",
      iconKey: "none",
      sortOrder: 1,
      isActive: "true",
    },
    mode: "onChange",
  });

  const selectedIconKey = watch("iconKey");
  const selectedSortOrder = watch("sortOrder");
  const selectedIsActive = watch("isActive");

  const filtered = useMemo(() => {
    return [...links]
      .filter((l) => l.category === category)
      .sort((a, b) => {
        const order = a.sortOrder - b.sortOrder;
        if (order !== 0) return order;
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
  }, [links, category]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const safePage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const paged = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const openCreate = () => {
    setEditing(null);
    reset({
      label: "",
      href: "",
      iconKey: "none",
      sortOrder: Math.min(filtered.length + 1, 5),
      isActive: "true",
    });
    setIsOpen(true);
  };

  const openEdit = (item: LinkTreeLink) => {
    setEditing(item);
    reset({
      label: item.label,
      href: item.href,
      iconKey: item.iconKey ?? "none",
      sortOrder: item.sortOrder ?? 0,
      isActive: item.isActive ? "true" : "false",
    });
    setIsOpen(true);
  };

  const openDelete = (item: LinkTreeLink) => {
    setDeleting({
      id: item.id,
      title: item.label,
      subtitle: item.href,
    });
    setIsDeleteOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/linktree-links/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Error al eliminar el enlace");
        return;
      }

      onLinksChange(links.filter((l) => l.id !== id));
      toast.success("Enlace eliminado");
      setIsDeleteOpen(false);
      setDeleting(null);
    } catch {
      toast.error("Error al eliminar el enlace");
    } finally {
      setIsDeleting(false);
    }
  };

  const onSubmit = async (data: LinkFormValues) => {
    if (isSubmitting) return;

    const payload = {
      category,
      label: data.label.trim(),
      href: data.href.trim(),
      iconKey:
        data.iconKey?.trim() && data.iconKey !== "none"
          ? data.iconKey.trim()
          : null,
      sortOrder: data.sortOrder,
      isActive: data.isActive === "true",
    };

    try {
      const url = editing
        ? `/api/linktree-links/${editing.id}`
        : "/api/linktree-links";
      const method = editing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "Error al guardar el enlace");
        return;
      }

      const saved: LinkTreeLink = {
        ...json.link,
        createdAt: new Date(json.link.createdAt),
        updatedAt: new Date(json.link.updatedAt),
      };

      if (editing) {
        onLinksChange(links.map((l) => (l.id === saved.id ? saved : l)));
        toast.success("Enlace actualizado");
      } else {
        onLinksChange([saved, ...links]);
        toast.success("Enlace creado");
      }

      setIsOpen(false);
    } catch {
      toast.error("Error al guardar el enlace");
    }
  };

  const columns: AdminColumn<LinkTreeLink>[] = [
    {
      key: "label",
      header: "Título",
      cell: (row) => <span className="font-medium">{row.label}</span>,
    },
    {
      key: "href",
      header: "Enlace",
      cell: (row) =>
        row.href ? (
          <a
            href={row.href}
            target={row.href.startsWith("http") ? "_blank" : undefined}
            rel={
              row.href.startsWith("http") ? "noopener noreferrer" : undefined
            }
            className="text-primary line-clamp-1 underline underline-offset-4"
          >
            {row.href}
          </a>
        ) : (
          "-"
        ),
    },
    {
      key: "iconKey",
      header: "Icono",
      cell: (row) => {
        const icon = renderLinkTreeIcon(row.iconKey);
        return icon ? (
          <span
            title={row.iconKey ?? ""}
            className="inline-flex items-center [&_svg]:size-4"
          >
            {icon}
          </span>
        ) : (
          "-"
        );
      },
    },
    {
      key: "sortOrder",
      header: "Orden",
      cell: (row) => row.sortOrder,
    },
    {
      key: "isActive",
      header: "Estado",
      cell: (row) => (
        <ActiveStatusBadge
          isActive={row.isActive}
          activeLabel="Activo"
          inactiveLabel="Inactivo"
        />
      ),
    },
    {
      key: "actions",
      header: <span className="text-right">Acciones</span>,
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <EditButton onClick={() => openEdit(row)} />
          <DeleteButton onClick={() => openDelete(row)} />
        </div>
      ),
    },
  ];

  const title = category === "CONTACT" ? "Contacto" : "Redes";

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Agregar enlace
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? `Editar enlace (${title})`
                  : `Nuevo enlace (${title})`}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="label">Título</Label>
                <Input
                  id="label"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.label}
                  aria-describedby="link-label-error"
                  {...register("label")}
                  className={errors.label ? "border-destructive" : ""}
                />
                <div className="flex h-5 items-center">
                  {errors.label ? (
                    <p
                      id="link-label-error"
                      className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                    >
                      <AlertCircle className="size-3" />
                      {errors.label.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="href">Enlace (href)</Label>
                <Input
                  id="href"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.href}
                  aria-describedby="link-href-error"
                  {...register("href")}
                  className={errors.href ? "border-destructive" : ""}
                />
                <div className="flex h-5 items-center">
                  {errors.href ? (
                    <p
                      id="link-href-error"
                      className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                    >
                      <AlertCircle className="size-3" />
                      {errors.href.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Icono</Label>
                  <Select
                    value={selectedIconKey ?? "none"}
                    onValueChange={(v) =>
                      setValue("iconKey", v, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin icono" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin icono</SelectItem>
                      {LINKTREE_ICON_KEYS.map((k) => (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-2">
                            <span className="inline-flex items-center [&_svg]:size-4">
                              {renderLinkTreeIcon(k)}
                            </span>
                            {LINKTREE_ICON_LABELS[k] ?? k}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sortOrder">Orden</Label>
                  <Select
                    value={String(selectedSortOrder ?? 1)}
                    onValueChange={(v) =>
                      setValue("sortOrder", Number(v), {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="sortOrder">
                      <SelectValue placeholder="Elegí el orden" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={selectedIsActive}
                    onValueChange={(v) =>
                      setValue("isActive", v as "true" | "false", {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Activo</SelectItem>
                      <SelectItem value="false">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
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
        data={paged}
        columns={columns}
        rowKey={(row) => row.id}
        emptyState="No hay enlaces registrados"
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
        entityLabel="el enlace"
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
