"use client";

import type { AdminReview } from "@/components/reviews/review-types";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AdminTable } from "@/components/admin";
import { ReviewFormDialog } from "@/components/reviews/review-form-dialog";
import { getReviewsColumns } from "@/components/reviews/reviews-columns";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface ReviewsTableProps {
  reviews: AdminReview[];
}

/**
 * The panel's review list.
 *
 * It renders what the server component queried and asks for that query again
 * after every write with `router.refresh()`. Publishing in particular has to come
 * from the server: the row's `isPublished` and the server-rendered public page
 * are the same truth, and local state cannot know that.
 */
export function ReviewsTable({ reviews }: ReviewsTableProps) {
  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminReview | null>(null);
  const [deleting, setDeleting] = useState<AdminReview | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setIsFormOpen(true);
  };

  const openEdit = (review: AdminReview) => {
    setEditing(review);
    setIsFormOpen(true);
  };

  const togglePublished = async (review: AdminReview) => {
    if (pendingId) return;

    setPendingId(review.id);

    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !review.isPublished }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.success) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "No pudimos cambiar la visibilidad",
        );
      }

      toast.success(
        review.isPublished
          ? "La reseña ya no se muestra en el sitio"
          : "La reseña ya se muestra en el sitio",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No pudimos cambiar la visibilidad",
      );
    } finally {
      setPendingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || isDeleting) return;

    setIsDeleting(true);

    try {
      const res = await fetch(`/api/reviews/${deleting.id}`, {
        method: "DELETE",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.success) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "No pudimos eliminar la reseña",
        );
      }

      toast.success("Reseña eliminada");
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No pudimos eliminar la reseña",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = getReviewsColumns({
    onEdit: openEdit,
    onTogglePublished: togglePublished,
    onDelete: setDeleting,
    pendingId,
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reseñas</h1>
          <p className="text-muted-foreground text-sm">
            Las que están publicadas se muestran en la portada y alimentan el
            puntaje que lee Google.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-muted-foreground text-sm">
            {reviews.length === 1 ? "1 reseña" : `${reviews.length} reseñas`}
          </p>
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            Agregar reseña
          </Button>
        </div>
      </div>

      <AdminTable
        data={reviews}
        columns={columns}
        rowKey={(review) => review.id}
        emptyState={
          <div className="py-10 text-center">
            <p className="font-medium">Todavía no hay reseñas</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Cargá la primera con &quot;Agregar reseña&quot;. Mientras no haya
              ninguna publicada, la sección no aparece en la portada.
            </p>
          </div>
        }
      />

      <ReviewFormDialog
        review={editing}
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSaved={() => {
          setIsFormOpen(false);
          setEditing(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Eliminar reseña"
        description={
          deleting
            ? `Se va a borrar la reseña de ${deleting.authorName}. No se puede deshacer; si solo querés sacarla del sitio, usá "Ocultar".`
            : undefined
        }
        confirmLabel="Eliminar"
        destructive
        loading={isDeleting}
        loadingLabel="Eliminando…"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
