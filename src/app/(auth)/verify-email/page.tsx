import { AlertCircle, MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Confirmar email",
};

/**
 * Landing for the verification link.
 *
 * better-auth's `/verify-email` endpoint verifies the JWT and redirects here.
 * On failure it appends `?error=<code>`; on success it redirects with no query
 * at all. That is the entire contract this page reads -- no token handling
 * happens here, and none should.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";

  if (error) {
    return (
      <Card className="bg-card mx-auto w-full max-w-sm border-0 py-8">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2 text-center">
            <AlertCircle className="text-destructive size-5" />
            No pudimos confirmar tu email
          </CardTitle>

          <CardDescription className="text-center">
            El enlace es inválido o ya venció. Pedile a un administrador que te
            envíe uno nuevo.
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
        <CardTitle className="flex items-center justify-center gap-2 text-center">
          <MailCheck className="size-5" />
          Email confirmado
        </CardTitle>

        <CardDescription className="text-center">
          Tu dirección quedó verificada. Los enlaces de recuperación de
          contraseña van a llegar acá.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Link
          href="/admin/login"
          className="text-muted-foreground hover:text-foreground block text-center text-sm underline-offset-4 hover:underline"
        >
          Ir al inicio de sesión
        </Link>
      </CardContent>
    </Card>
  );
}
