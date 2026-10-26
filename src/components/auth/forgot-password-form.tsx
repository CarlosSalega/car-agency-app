"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";

/**
 * Requests a password reset link.
 *
 * The screen after submitting is identical whether the address exists, the
 * provider failed or the network dropped. Any difference here would answer
 * "does this email have an account?", which is exactly what
 * `request-password-reset` is built to hide.
 */
export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
    mode: "onChange",
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    if (isSubmitting) return;

    try {
      await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });
    } catch {
      // Swallowed on purpose. A network error must land on the same screen as
      // a successful send; surfacing it would leak whether the request was
      // even attempted.
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Card className="bg-card mx-auto w-full max-w-sm border-0 py-8">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-center">
            <MailCheck className="size-5" />
            Revisá tu correo
          </CardTitle>

          <CardDescription className="text-center">
            Si el email pertenece a una cuenta, te enviamos un enlace para
            restablecer la contraseña. Vence en una hora y se puede usar una
            sola vez.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Link
            href="/admin/login"
            className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
          >
            Volver al inicio de sesión
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card mx-auto w-full max-w-sm border-0 py-8">
      <CardHeader>
        <CardTitle className="text-center">Recuperar contraseña</CardTitle>

        <CardDescription className="text-center">
          Ingresá tu email y te enviamos un enlace para elegir una nueva.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>

            <Input
              id="email"
              type="email"
              placeholder="usuario@ejemplo.com"
              autoFocus
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              aria-describedby="email-error"
              {...register("email")}
              className={errors.email ? "border-destructive" : ""}
            />

            <div className="flex h-5 items-center">
              {errors.email && (
                <p
                  id="email-error"
                  className="text-destructive animate-in fade-in flex items-center gap-1 text-sm"
                >
                  <AlertCircle className="size-3" />
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Enviando..." : "Enviar enlace"}
          </Button>

          <Link
            href="/admin/login"
            className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
          >
            Volver al inicio de sesión
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
