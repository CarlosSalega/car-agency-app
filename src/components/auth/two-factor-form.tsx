"use client";

import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "totp" | "backup";

const ERROR_COPY: Record<string, string> = {
  INVALID_TWO_FACTOR_COOKIE:
    "Tu verificación venció. Volvé a iniciar sesión para empezar de nuevo.",
  TOO_MANY_ATTEMPTS:
    "Demasiados intentos fallidos. Esperá unos minutos antes de reintentar.",
  INVALID_CODE: "El código no es válido o ya venció. Probá con el siguiente.",
  INVALID_BACKUP_CODE: "Ese código de respaldo no es válido o ya se usó.",
};

/**
 * Second step of a sign-in that returned `twoFactorRedirect`.
 *
 * The password already succeeded; what is missing is the session, which
 * better-auth deliberately deleted and replaced with a short-lived `2fa-*`
 * cookie. That cookie is the only thing tying this page to the pending sign-in,
 * so an expired or missing one is a "start over", never a retry loop.
 */
export function TwoFactorForm() {
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isSubmitting) return;

    const value = code.trim();

    if (!value) {
      setError("Ingresá el código.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch(
        mode === "totp"
          ? "/api/auth/two-factor/verify-totp"
          : "/api/auth/two-factor/verify-backup-code",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: value }),
          credentials: "include",
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          ERROR_COPY[body?.code] ??
            "No pudimos verificar el código. Intentá de nuevo.",
        );
        return;
      }

      toast.success("Verificación correcta");
      window.location.href = "/admin";
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-card mx-auto w-full max-w-sm border-0 py-8">
      <CardHeader>
        <CardTitle className="flex items-center justify-center gap-2 text-center">
          <ShieldCheck className="size-5" />
          Verificación en dos pasos
        </CardTitle>

        <CardDescription className="text-center">
          {mode === "totp"
            ? "Ingresá el código de 6 dígitos de tu aplicación de autenticación."
            : "Ingresá uno de los códigos de respaldo que guardaste al activar 2FA."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="code">
              {mode === "totp" ? "Código" : "Código de respaldo"}
            </Label>

            <Input
              id="code"
              autoFocus
              autoComplete="one-time-code"
              inputMode={mode === "totp" ? "numeric" : "text"}
              maxLength={mode === "totp" ? 6 : 32}
              placeholder={mode === "totp" ? "123456" : "XXXXX-XXXXX"}
              value={code}
              disabled={isSubmitting}
              aria-invalid={!!error}
              aria-describedby="code-error"
              onChange={(event) => setCode(event.target.value)}
              className={error ? "border-destructive" : ""}
            />

            <div className="flex min-h-5 items-center">
              {error && (
                <p
                  id="code-error"
                  className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                >
                  <AlertCircle className="size-3" />
                  {error}
                </p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="text-primary-foreground bg-primary hover:bg-primary/90 w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Verificando..." : "Verificar"}
          </Button>

          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mx-auto flex items-center gap-2 text-sm underline-offset-4 hover:underline"
            onClick={() => {
              setMode(mode === "totp" ? "backup" : "totp");
              setCode("");
              setError("");
            }}
          >
            <KeyRound className="size-3" />
            {mode === "totp"
              ? "Usar un código de respaldo"
              : "Usar el código de la app"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
