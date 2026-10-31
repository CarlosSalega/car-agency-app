import { Inbox } from "lucide-react";

interface LeadsEmptyStateProps {
  /** True when a status filter is applied, so "nothing yet" would be a lie. */
  filtered: boolean;
}

/**
 * The table's empty state. Two different facts, two different messages: an
 * unfiltered empty list means no inquiry ever arrived, a filtered one means the
 * selected status has none.
 */
export function LeadsEmptyState({ filtered }: LeadsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <Inbox className="text-muted-foreground size-8" aria-hidden="true" />
      <p className="text-foreground font-medium">
        {filtered
          ? "No hay consultas con ese estado"
          : "Todavía no hay consultas"}
      </p>
      <p className="text-muted-foreground text-sm">
        {filtered
          ? "Probá con otro estado o limpiá el filtro."
          : "Cuando alguien envíe el formulario de un vehículo, la consulta aparece acá."}
      </p>
    </div>
  );
}
