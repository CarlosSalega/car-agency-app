import { ReactNode } from "react";

export interface ConfirmOptions<T> {
  title: string;
  description?: ReactNode;
  content?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  data: T;
}
