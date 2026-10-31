"use client";

import type { LeadWithRelations } from "@/components/leads/lead-types";

import { formatLeadDateTime } from "@/components/leads/lead-format";
import { LEAD_STATUS_OPTIONS } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface LeadDetailDialogProps {
  lead: LeadWithRelations | null;
  onClose: () => void;
  /** Called after the server accepted the change, so the list can re-query. */
  onSaved: () => void;
}

const MAX_NOTE = 2000;

/**
 * The one screen that opens a lead: the visitor's message plus the two things
 * staff can change, the status and the internal note.
 *
 * Every save goes through `PATCH /api/leads/[id]`, which writes the status and
 * its audit row in one transaction. The dialog keeps no copy of the list: it
 * reports the save and closes, and the server component re-reads the data.
 */
export function LeadDetailDialog({
  lead,
  onClose,
  onSaved,
}: LeadDetailDialogProps) {
  const statusId = useId();
  const notesId = useId();

  const [status, setStatus] = useState(lead?.status ?? "NEW");
  const [notes, setNotes] = useState(lead?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // The dialog instance is reused across rows, so its form is reset whenever a
  // different lead is opened.
  useEffect(() => {
    setStatus(lead?.status ?? "NEW");
    setNotes(lead?.notes ?? "");
  }, [lead]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lead || isSaving) return;

    setIsSaving(true);

    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok || !body?.success) {
        throw new Error(
          typeof body?.error === "string"
            ? body.error
            : "No pudimos guardar la consulta",
        );
      }

      toast.success("Consulta actualizada");
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No pudimos guardar la consulta",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(lead)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {lead ? `Consulta de ${lead.name}` : "Consulta"}
          </DialogTitle>
          <DialogDescription>
            {lead?.car ? `Sobre ${lead.car.title}` : "Sin vehículo asociado"}
            {lead?.createdAt
              ? ` · Recibida el ${formatLeadDateTime(lead.createdAt)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {lead && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Teléfono</p>
                <a
                  className="text-foreground underline-offset-4 hover:underline"
                  href={`tel:${lead.phone}`}
                >
                  {lead.phone}
                </a>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Email</p>
                <p className="text-foreground">{lead.email ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Vendedor</p>
                <p className="text-foreground">
                  {lead.seller
                    ? `${lead.seller.lastName} ${lead.seller.firstName}`
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Origen</p>
                <p className="text-foreground break-all">
                  {lead.source ?? "-"}
                </p>
              </div>
            </div>

            {lead.message && (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Mensaje</p>
                <p className="bg-muted text-foreground rounded-md p-3 whitespace-pre-line">
                  {lead.message}
                </p>
              </div>
            )}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={statusId}>Estado</Label>
            <Select
              value={status}
              onValueChange={(next) => {
                if (next !== null) setStatus(next);
              }}
              disabled={isSaving}
            >
              <SelectTrigger id={statusId} className="w-full">
                <SelectValue placeholder="Nueva" />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={notesId}>Nota interna</Label>
            <Textarea
              id={notesId}
              value={notes}
              maxLength={MAX_NOTE}
              disabled={isSaving}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Qué hablamos con la persona, qué falta, cuándo volver a llamar"
            />
            <p className="text-muted-foreground text-xs">
              Solo la ve el equipo. No se muestra en el sitio.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !lead}>
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
