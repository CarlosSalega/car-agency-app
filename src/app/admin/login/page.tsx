import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { HEADER_CONTENT } from "@/data/header";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    redirect("/admin");
  }

  const { logo } = HEADER_CONTENT;

  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col items-center space-y-8">
        <Link href="/" className="inline-flex items-center gap-2">
          <Image
            src={logo.src}
            alt={logo.alt}
            width={logo.width}
            height={logo.height}
            className="size-16"
          />
        </Link>

        <LoginForm />
      </div>
    </div>
  );
}
