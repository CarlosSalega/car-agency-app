"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function PasswordInput({
  className,
  disabled,
  ...props
}: React.ComponentProps<"input">) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        className={cn("pr-10", className)}
        disabled={disabled}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        disabled={disabled}
        className={cn(
          "text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2",
          "focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none",
          disabled && "pointer-events-none opacity-50",
        )}
        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
