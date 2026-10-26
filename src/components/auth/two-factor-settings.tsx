"use client";

import { AlertCircle, Check, Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
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
import { PasswordInput } from "@/components/ui/password-input";

type Phase = "idle" | "enable-password" | "setup" | "disable-password";

const ERROR_COPY: Record<string, string> = {
  INVALID_PASSWORD: "La contraseña no es correcta.",
  INVALID_CODE: "El código no es válido o ya venció.",
  INVALID_TWO_FACTOR_COOKIE:
    "Tu sesión venció. Recargá la página e intentá de nuevo.",
};

/**
 * Per-user 2FA settings.
 *
 * Three steps, all owned by better-auth: `enable` returns the TOTP URI and the
 * backup codes but leaves `twoFactorEnabled` false; only a correct code through
 * `verify-totp` flips it. That gap is deliberate -- it is what stops a user from
 * locking themselves out with an app that never scanned the QR.
 */
export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpURI, setTotpURI] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setPhase("idle");
    setPassword("");
    setCode("");
    setTotpURI("");
    setBackupCodes([]);
    setCopied(false);
    setError("");
  };

  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });

    const data = await res.json().catch(() => null);

    return { res, data };
  };

  const onStartEnable = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      const { res, data } = await post("/api/auth/two-factor/enable", {
        password,
      });

      if (!res.ok) {
        setError(ERROR_COPY[data?.code] ?? "No pudimos activar 2FA.");
        return;
      }

      setTotpURI(data?.totpURI ?? "");
      setBackupCodes(Array.isArray(data?.backupCodes) ? data.backupCodes : []);
      setPassword("");
      setPhase("setup");
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onConfirm = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      const { res, data } = await post("/api/auth/two-factor/verify-totp", {
        code: code.trim(),
      });

      if (!res.ok) {
        setError(ERROR_COPY[data?.code] ?? "No pudimos verificar el código.");
        return;
      }

      toast.success("2FA activado");
      reset();
      router.refresh();
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDisable = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      const { res, data } = await post("/api/auth/two-factor/disable", {
        password,
      });

      if (!res.ok) {
        setError(ERROR_COPY[data?.code] ?? "No pudimos desactivar 2FA.");
        return;
      }

      toast.success("2FA desactivado");
      reset();
      router.refresh();
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopied(true);
      toast.success("Códigos copiados");
    } catch {
      toast.error("No pudimos copiar los códigos");
    }
  };

  if (phase === "setup") {
    return (
      <Card className="bg-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Confirmá tu aplicación
          </CardTitle>

          <CardDescription>
            Escaneá el código con Google Authenticator, 1Password, Authy o
            cualquier app TOTP. Después ingresá el código de 6 dígitos para
            terminar.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="rounded-lg bg-white p-3">
              {totpURI ? (
                <QRCodeSVG value={totpURI} size={176} />
              ) : (
                <p className="text-destructive text-sm">
                  El servidor no devolvió un código QR.
                </p>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1">
                <Label>Códigos de respaldo</Label>
                <p className="text-muted-foreground text-sm">
                  Cada uno funciona una sola vez. Guardalos ahora: no se vuelven
                  a mostrar.
                </p>
              </div>

              <div className="bg-muted rounded-md p-3 font-mono text-sm">
                {backupCodes.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-1">
                    {backupCodes.map((backupCode) => (
                      <li key={backupCode}>{backupCode}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">
                    Sin códigos de respaldo
                  </span>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyBackupCodes}
                disabled={backupCodes.length === 0}
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                Copiar
              </Button>
            </div>
          </div>

          <form onSubmit={onConfirm} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-code">Código de la app</Label>

              <Input
                id="confirm-code"
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                disabled={isSubmitting}
                aria-invalid={!!error}
                onChange={(event) => setCode(event.target.value)}
                className={error ? "border-destructive" : ""}
              />

              <div className="flex min-h-5 items-center">
                {error && (
                  <p className="text-destructive animate-in fade-in flex items-center gap-1 text-sm">
                    <AlertCircle className="size-3" />
                    {error}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Verificando..." : "Activar 2FA"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (phase === "enable-password") {
    return (
      <Card className="bg-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Activar 2FA
          </CardTitle>

          <CardDescription>
            Confirmá tu contraseña para empezar. Después vas a escanear un
            código QR.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onStartEnable} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="enable-password">Contraseña</Label>

              <PasswordInput
                id="enable-password"
                autoFocus
                placeholder="••••••••"
                value={password}
                disabled={isSubmitting}
                aria-invalid={!!error}
                onChange={(event) => setPassword(event.target.value)}
                className={error ? "border-destructive" : ""}
              />

              <div className="flex min-h-5 items-center">
                {error && (
                  <p className="text-destructive animate-in fade-in flex items-center gap-1 text-sm">
                    <AlertCircle className="size-3" />
                    {error}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Generando..." : "Continuar"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (phase === "disable-password") {
    return (
      <Card className="bg-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldOff className="size-5" />
            Desactivar 2FA
          </CardTitle>

          <CardDescription>
            A partir de este momento alcanzará con la contraseña para entrar.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onDisable} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-password">Contraseña</Label>

              <PasswordInput
                id="disable-password"
                autoFocus
                placeholder="••••••••"
                value={password}
                disabled={isSubmitting}
                aria-invalid={!!error}
                onChange={(event) => setPassword(event.target.value)}
                className={error ? "border-destructive" : ""}
              />

              <div className="flex min-h-5 items-center">
                {error && (
                  <p className="text-destructive animate-in fade-in flex items-center gap-1 text-sm">
                    <AlertCircle className="size-3" />
                    {error}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Desactivando..." : "Desactivar 2FA"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={reset}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="size-5" />
          ) : (
            <ShieldOff className="size-5" />
          )}
          Autenticación en dos pasos
        </CardTitle>

        <CardDescription>
          {enabled
            ? "Está activa. Para entrar hace falta la contraseña y un código de tu app."
            : "Sumá un código de tu aplicación de autenticación además de la contraseña."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Button
          type="button"
          variant={enabled ? "outline" : "default"}
          onClick={() =>
            setPhase(enabled ? "disable-password" : "enable-password")
          }
        >
          {enabled ? "Desactivar 2FA" : "Activar 2FA"}
        </Button>
      </CardContent>
    </Card>
  );
}
