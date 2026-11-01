"use client";

import type { AdminReview, ReviewFormValues } from "./review-types";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { type FormEvent, useEffect, useId, useState } from "react";
import { toast } from "sonner";

interface ReviewFormDialogProps {
  /** `null` opens the dialog in creation mode. */
  review: AdminReview | null;
  open: boolean;
  onClose: () => void;
  /** Called after the server accepted the write, so the list can re-query. */
  onSaved: () => void;
}

const MAX_TEXT = 2000;

/**
 * The rating options, as `items` for the Select root.
 *
 * Base UI's `Select.Value` prints the raw value unless the root is given `items`,
 * which would render "5" next to a list that says "5 estrellas". The labels are
 * Spanish because the panel is; the values stay the numbers the API validates.
 */
const RATING_OPTIONS = [5, 4, 3, 2, 1].map((stars) => ({
  value: String(stars),
  label: `${stars} ${stars === 1 ? "estrella" : "estrellas"}`,
}));

/** `YYYY-MM-DD` in UTC, the only shape `<input type="date">` accepts. */
function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

/**
 * The date travels as a whole UTC instant at noon.
 *
 * Noon, not midnight, because the label under the card is computed on whole UTC
 * days: a midnight instant ships as the previous day for anyone west of UTC, and
 * the panel would silently shift the date by one every time an admin saved.
 */
function toReviewedAt(day: string): string | null {
  if (!day) return null;
  return new Date(`${day}T12:00:00.000Z`).toISOString();
}

const emptyForm = (): ReviewFormValues => ({
  authorName: "",
  rating: 5,
  text: "",
  reviewedAt: toDateInputValue(new Date()),
  photoPath: "",
  sortOrder: 0,
  isPublished: false,
});

/**
 * Create and edit for a testimonial, in one dialog because it is the same form
 * and the same endpoint shape.
 *
 * `isPublished` starts **unchecked** for a new review: the row can be written
 * before the text is final, and the landing only ever shows what was published
 * on purpose.
 */
export function ReviewFormDialog({
  review,
  open,
  onClose,
  onSaved,
}: ReviewFormDialogProps) {
  const authorId = useId();
  const ratingId = useId();
  const textId = useId();
  const dateId = useId();
  const photoId = useId();
  const sortId = useId();
  const publishedId = useId();

  const [form, setForm] = useState<ReviewFormValues>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  // The dialog instance is reused between "new" and "edit", so the form is reset
  // whenever the row it is editing changes.
  useEffect(() => {
    if (!open) return;

    setForm(
      review
        ? {
            authorName: review.authorName,
            rating: review.rating,
            text: review.text,
            reviewedAt: toDateInputValue(review.reviewedAt),
            photoPath: review.photoPath ?? "",
            sortOrder: review.sortOrder,
            isPublished: review.isPublished,
          }
        : emptyForm(),
    );
  }, [open, review]);

  const update = <K extends keyof ReviewFormValues>(
    key: K,
    value: ReviewFormValues[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const reviewedAt = toReviewedAt(form.reviewedAt);

    if (!reviewedAt) {
      toast.error("Elegí la fecha de la reseña");
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch(
        review ? `/api/reviews/${review.id}` : "/api/reviews",
        {
          method: review ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorName: form.authorName,
            rating: form.rating,
            text: form.text,
            reviewedAt,
            photoPath: form.photoPath,
            sortOrder: form.sortOrder,
            isPublished: form.isPublished,
          }),
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.success) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "No pudimos guardar la reseña",
        );
      }

      toast.success(review ? "Reseña actualizada" : "Reseña creada");
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No pudimos guardar la reseña",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {review ? `Editar reseña de ${review.authorName}` : "Nueva reseña"}
          </DialogTitle>
          <DialogDescription>
            El texto se muestra tal cual en el sitio: respetá las palabras del
            cliente.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={authorId}>Autor</Label>
              <Input
                id={authorId}
                value={form.authorName}
                onChange={(event) => update("authorName", event.target.value)}
                maxLength={80}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={ratingId}>Calificación</Label>
              <Select
                items={RATING_OPTIONS}
                value={String(form.rating)}
                onValueChange={(value) => {
                  if (value !== null) update("rating", Number(value));
                }}
              >
                <SelectTrigger id={ratingId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={dateId}>Fecha de la reseña</Label>
              <Input
                id={dateId}
                type="date"
                value={form.reviewedAt}
                onChange={(event) => update("reviewedAt", event.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={sortId}>Orden</Label>
              <Input
                id={sortId}
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(event) =>
                  update("sortOrder", Number(event.target.value))
                }
              />
              <p className="text-muted-foreground text-xs">
                Menor primero. Las que comparten número se ordenan por fecha.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={textId}>Reseña</Label>
            <Textarea
              id={textId}
              value={form.text}
              onChange={(event) => update("text", event.target.value)}
              rows={6}
              maxLength={MAX_TEXT}
              required
            />
            <p className="text-muted-foreground text-xs">
              {form.text.trim().length}/{MAX_TEXT}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={photoId}>Foto (opcional)</Label>
            <Input
              id={photoId}
              value={form.photoPath}
              onChange={(event) => update("photoPath", event.target.value)}
              placeholder="/reviews/<cliente>.webp"
            />
            <p className="text-muted-foreground text-xs">
              Ruta de un archivo dentro de <code>public/</code>. Dejala vacía si
              el cliente no tiene foto.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id={publishedId}
              type="checkbox"
              className="size-4"
              checked={form.isPublished}
              onChange={(event) => update("isPublished", event.target.checked)}
            />
            <Label htmlFor={publishedId}>Publicada en el sitio</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
