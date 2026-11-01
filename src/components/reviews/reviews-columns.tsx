import type { AdminColumn } from "@/components/admin/admin-table";
import type { AdminReview } from "@/components/reviews/review-types";

import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

import { ActionButtonsGroup } from "@/components/admin/admin-action-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeReviewDate } from "@/lib/reviews";

interface Params {
  onEdit: (review: AdminReview) => void;
  onTogglePublished: (review: AdminReview) => void;
  onDelete: (review: AdminReview) => void;
  /** Id of the row whose publish toggle is in flight, so it cannot double-fire. */
  pendingId: string | null;
}

/**
 * What staff read in the list: who wrote it, how it reads at a glance, and
 * whether it is live.
 *
 * The public label ("hace 3 meses") is rendered here with the same formatter the
 * landing uses. Showing a different phrase in the panel than on the site is how
 * a "hace 3 meses" ends up next to a date that says otherwise.
 */
export function getReviewsColumns({
  onEdit,
  onTogglePublished,
  onDelete,
  pendingId,
}: Params): AdminColumn<AdminReview>[] {
  return [
    {
      key: "authorName",
      header: "Autor",
      cell: (review) => (
        <div className="max-w-[220px]">
          <p className="truncate font-medium" title={review.authorName}>
            {review.authorName}
          </p>
          <p className="text-muted-foreground text-sm">
            {formatRelativeReviewDate(review.reviewedAt)}
          </p>
        </div>
      ),
    },
    {
      key: "rating",
      header: "Estrellas",
      cell: (review) => (
        <span
          className="text-warning whitespace-nowrap"
          aria-label={`${review.rating} de 5 estrellas`}
        >
          {"★".repeat(review.rating)}
          <span className="text-subtle-foreground">
            {"★".repeat(5 - review.rating)}
          </span>
        </span>
      ),
    },
    {
      key: "text",
      header: "Reseña",
      cell: (review) => (
        <p
          className="text-muted-foreground line-clamp-2 max-w-[320px] text-sm"
          title={review.text}
        >
          {review.text}
        </p>
      ),
    },
    {
      key: "isPublished",
      header: "Estado",
      cell: (review) =>
        review.isPublished ? (
          <Badge variant="secondary">Publicada</Badge>
        ) : (
          <Badge variant="outline">Oculta</Badge>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Acciones</span>,
      className: "text-right",
      cell: (review) => (
        <ActionButtonsGroup>
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              review.isPublished
                ? `Ocultar la reseña de ${review.authorName}`
                : `Publicar la reseña de ${review.authorName}`
            }
            disabled={pendingId === review.id}
            onClick={() => onTogglePublished(review)}
          >
            {review.isPublished ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Editar la reseña de ${review.authorName}`}
            onClick={() => onEdit(review)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Eliminar la reseña de ${review.authorName}`}
            onClick={() => onDelete(review)}
          >
            <Trash2 className="size-4" />
          </Button>
        </ActionButtonsGroup>
      ),
    },
  ];
}
