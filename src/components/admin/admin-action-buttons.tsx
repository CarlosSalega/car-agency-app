import { Eye, Edit, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface ViewButtonProps {
  href: string;
  label?: string;
}

export function ViewButton({ href, label = "Ver" }: ViewButtonProps) {
  return (
    <Button
      className="hover:text-background hover:bg-info"
      variant="ghost"
      size="icon"
      render={
        <Link href={href}>
          <Eye className="size-5" />
        </Link>
      }
      title={label}
      aria-label={label}
    />
  );
}

interface EditButtonProps {
  href?: string;
  onClick?: () => void;
  label?: string;
}

export function EditButton({
  href,
  onClick,
  label = "Editar",
}: EditButtonProps) {
  if (href) {
    return (
      <Button
        className="hover:text-background hover:bg-warning"
        variant="ghost"
        size="icon"
        render={
          <Link href={href}>
            <Edit className="size-5" />
          </Link>
        }
        title={label}
        aria-label={label}
      />
    );
  }

  return (
    <Button
      className="hover:text-background hover:bg-warning"
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Edit className="size-5" />
    </Button>
  );
}

interface DeleteButtonProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}

export function DeleteButton({
  onClick,
  label = "Eliminar",
  disabled = false,
}: DeleteButtonProps) {
  return (
    <Button
      className="hover:text-background hover:bg-destructive"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <Trash2 className="size-5" />
    </Button>
  );
}

interface ActionButtonsGroupProps {
  viewHref?: string;
  viewLabel?: string;
  viewOpenInNewTab?: boolean;
  editHref?: string;
  editOnClick?: () => void;
  editLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteDisabled?: boolean;
}

export function ActionButtonsGroup({
  viewHref,
  viewLabel,
  editHref,
  editOnClick,
  editLabel,
  onDelete,
  deleteLabel,
  deleteDisabled,
}: ActionButtonsGroupProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      {viewHref && <ViewButton href={viewHref} label={viewLabel} />}
      {(editHref || editOnClick) && (
        <EditButton href={editHref} onClick={editOnClick} label={editLabel} />
      )}
      {onDelete && (
        <DeleteButton
          onClick={onDelete}
          label={deleteLabel}
          disabled={deleteDisabled}
        />
      )}
    </div>
  );
}
