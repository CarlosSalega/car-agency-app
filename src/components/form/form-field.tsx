import type React from "react";

import { AlertCircle } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  error?: any;
  errorId?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  error,
  errorId,
  required = false,
  htmlFor,
  children,
  className,
  ...props
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      <Label htmlFor={htmlFor}>
        {label} {required && "*"}
      </Label>

      {children}

      <div className="flex h-5 items-center">
        {error && "message" in error && typeof error.message === "string" && (
          <p
            id={errorId}
            className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
          >
            <AlertCircle className="size-3" />
            {error.message}
          </p>
        )}
      </div>
    </div>
  );
}
