"use client";

import { useCallback, useState } from "react";
import { ReactNode } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  content?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export function useConfirm() {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(
    null,
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    setState(options);

    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const handleCancel = () => {
    resolver?.(false);
    setState(null);
    setResolver(null);
  };

  const handleConfirm = () => {
    resolver?.(true);
    setState(null);
    setResolver(null);
  };

  const ConfirmModal = state ? (
    <ConfirmDialog
      open
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      destructive={state.destructive}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    >
      {state.content}
    </ConfirmDialog>
  ) : null;

  return Object.assign(confirm, { ConfirmModal });
}
