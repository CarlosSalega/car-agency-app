"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type DeleteConfigItem = {
  id: string;
  title: string;
  subtitle?: string;
};

interface DeleteConfigItemDialogProps {
  open: boolean;
  entityLabel: string;
  item: DeleteConfigItem | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteConfigItemDialog({
  open,
  entityLabel,
  item,
  loading = false,
  onCancel,
  onConfirm,
}: DeleteConfigItemDialogProps) {
  if (!item) return null;

  return (
    <ConfirmDialog
      open={open}
      title={`Eliminar ${entityLabel}`}
      description={
        <>
          ¿Estás seguro de que querés eliminar{" "}
          <span className="font-medium">{item.title}</span>?
        </>
      }
      confirmLabel="Eliminar"
      destructive
      loading={loading}
      loadingLabel="Eliminando..."
      onCancel={onCancel}
      onConfirm={() => onConfirm(item.id)}
    >
      <div className="space-y-2">
        {item.subtitle && (
          <div className="text-muted-foreground text-sm">{item.subtitle}</div>
        )}

        <div className="text-destructive text-sm">
          Esta acción no se puede deshacer.
        </div>
      </div>
    </ConfirmDialog>
  );
}
