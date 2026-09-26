"use client";

import type { Brand } from "@generated/prisma/client";

import { Edit, Trash2, Plus } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  initialBrands: Brand[];
}

export function BrandsTable({ initialBrands }: Props) {
  const [brands, setBrands] = useState<Brand[]>(initialBrands || []);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState({ name: "" });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "" });
    setIsOpen(true);
  };

  const openEdit = (b: Brand) => {
    setEditing(b);
    setForm({ name: b.name });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar marca?")) return;
    try {
      const res = await fetch(`/api/brands/${id}`, { method: "DELETE" });
      if (res.ok) {
        setBrands(brands.filter((b) => b.id !== id));
        toast.success("Marca eliminada exitosamente");
      } else {
        toast.error((await res.json()).error || "Error al eliminar");
      }
    } catch (err) {
      toast.error("Error al eliminar marca");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editing ? `/api/brands/${editing.id}` : "/api/brands";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) return toast.error(json.error || "Error al guardar");
      if (editing) {
        setBrands(brands.map((b) => (b.id === json.brand.id ? json.brand : b)));
        toast.success("Marca actualizada exitosamente");
      } else {
        setBrands([json.brand, ...brands]);
        toast.success("Marca creada exitosamente");
      }
      setIsOpen(false);
    } catch (err) {
      toast.error("Error al guardar marca");
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2" /> Nueva Marca
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Creada</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((b) => (
              <TableRow key={b.id}>
                <TableCell
                  className="max-w-[240px] truncate font-medium"
                  title={b.name}
                >
                  {b.name}
                </TableCell>
                <TableCell>{b.createdAt.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(b)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(b.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Marca" : "Nueva Marca"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Guardar</Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
