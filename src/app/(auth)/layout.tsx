import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HEADER_CONTENT } from "@/data/header";

/**
 * Shell for the pages that must be reachable **before** a session exists:
 * password reset and, later, email verification and the second factor.
 *
 * They live outside `/admin` on purpose. `/admin`'s layout sends every
 * session-less request to `/admin/login`, so hosting recovery there would mean
 * carving exceptions into the guard -- each one a hole a future route inherits.
 * Here the guard stays absolute and this route group stays public by
 * construction.
 */

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

        {children}
      </div>
    </div>
  );
}
