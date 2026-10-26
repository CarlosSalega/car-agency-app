"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";

/**
 * Sets a new password from a reset token.
 *
 * The token arrives as a query parameter, put there by better-auth's
 * `/reset-password/:token` redirect. It is passed down from the server page
 * instead of read with `useSearchParams`, which would force a Suspense
 * boundary for no benefit.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onChange",
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    if (isSubmitting) return;

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: data.password, token }),
      });

      if (!res.ok) {
        toast.error("El enlace es inválido o ya venció. Pedí uno nuevo.");
        return;
      }

      toast.success("Contraseña actualizada. Ya podés iniciar sesión.");
      window.location.href = "/admin/login";
    } catch {
      toast.error("Error de conexión con el servidor");
    }
  };

  if (!token) {
    return (
      <Card className="bg-card mx-auto w-full max-w-sm border-0 py-8">
        <CardHeader>
          <CardTitle className="text-center">Enlace inválido</CardTitle>

          <CardDescription className="text-center">
            El enlace que abriste está incompleto. Pedí uno nuevo.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
          >
            Pedir un enlace nuevo
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card mx-auto w-full max-w-sm border-0 py-8">
      <CardHeader>
        <CardTitle className="text-center">Nueva contraseña</CardTitle>

        <CardDescription className="text-center">
          Elegí una contraseña de al menos 8 caracteres.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>

              <PasswordInput
                id="password"
                placeholder="••••••••"
                autoFocus
                disabled={isSubmitting}
                aria-invalid={!!errors.password}
                aria-describedby="password-error"
                {...register("password")}
                className={errors.password ? "border-destructive" : ""}
              />

              <div className="flex h-5 items-center">
                {errors.password && (
                  <p
                    id="password-error"
                    className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                  >
                    <AlertCircle className="size-3" />
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Repetir contraseña</Label>

              <PasswordInput
                id="confirmPassword"
                placeholder="••••••••"
                disabled={isSubmitting}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby="confirm-password-error"
                {...register("confirmPassword")}
                className={errors.confirmPassword ? "border-destructive" : ""}
              />

              <div className="flex h-5 items-center">
                {errors.confirmPassword && (
                  <p
                    id="confirm-password-error"
                    className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                  >
                    <AlertCircle className="size-3" />
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
