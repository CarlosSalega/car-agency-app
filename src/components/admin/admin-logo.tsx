import Image from "next/image";
import Link from "next/link";

import { ADMIN_HEADER_CONTENT } from "@/data/admin-header";

export function AdminLogo() {
  const { logo } = ADMIN_HEADER_CONTENT;

  return (
    <Link href="/" className="flex items-center gap-2">
      <Image
        src={logo.src}
        alt={logo.alt}
        width={logo.width}
        height={logo.height}
        className={logo.className}
      />
    </Link>
  );
}
