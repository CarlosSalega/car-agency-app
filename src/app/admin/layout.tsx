import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { AdminHeader, AdminLoadingFallback } from "@/components/admin";
import { Suspense } from "react";

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

    return children;
  }

  if (isLoginPage) {
    redirect("/admin");
  }

  return (
    <>
      <AdminHeader user={session.user} />
      <Suspense fallback={<AdminLoadingFallback />}>{children}</Suspense>
    </>
  );
}
