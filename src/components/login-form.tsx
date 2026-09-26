"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onChange",
  });

  const onSubmit = async (data: LoginInput) => {
    if (isSubmitting) return;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      let result: any = null;
      try {
        result = await res.json();
      } catch {}

      if (!res.ok) {
        toast.error("Credenciales inválidas");
        return;
      }

      toast.success("¡Inicio de sesión exitoso!");
      reset();
      window.location.href = "/admin";
    } catch (err) {
      toast.error("Error de conexión con el servidor");
    }
  };

  return (
    <Card className="bg-card mx-auto w-full max-w-sm border-0 py-8">
      <CardHeader>
        <CardTitle className="text-center">Iniciar Sesión</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>

              <PasswordInput
                id="password"
                placeholder="••••••••"
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
          </div>

          <Button
            type="submit"
            className="text-accent w-full bg-black/95 hover:bg-black/80"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="bg-black/80 text-base">Ingresando...</span>
            ) : (
              <span className="bg-black/80 text-base">Ingresar</span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
