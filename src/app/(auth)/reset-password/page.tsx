import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Nueva contraseña",
};

/**
 * Landing for the reset link.
 *
 * better-auth's `/reset-password/:token` endpoint verifies the token and
 * redirects here with `?token=`. A missing token means the link was truncated
 * or hand-edited, and the form says so instead of posting a request that can
 * only fail.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return <ResetPasswordForm token={token} />;
}
