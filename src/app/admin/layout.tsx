import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminLoadingFallback, AdminShell } from "@/components/admin";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const isLoginPage =
    pathname === "/admin/login" || pathname.startsWith("/admin/login/");

  const session = await getSession();

  if (!session) {
    if (!isLoginPage) {
      redirect("/admin/login");
    }

    // Returned before the shell, so the login page has no sidebar. The
    // `x-pathname` special case and the cookie exemption in `proxy.ts` both
    // still apply.
    return children;
  }

  if (isLoginPage) {
    redirect("/admin");
  }

  return (
    <AdminShell user={session.user}>
      <Suspense fallback={<AdminLoadingFallback />}>{children}</Suspense>
    </AdminShell>
  );
}
