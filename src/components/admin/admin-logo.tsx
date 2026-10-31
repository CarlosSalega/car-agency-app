import Image from "next/image";
import Link from "next/link";

import { ADMIN_HEADER_CONTENT } from "@/data/admin-header";

export function AdminLogo() {
  const { logo, mark } = ADMIN_HEADER_CONTENT;

  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2 group-data-[collapsible=icon]:justify-center"
    >
      <Image
        src={logo.src}
        alt={logo.alt}
        width={logo.width}
        height={logo.height}
        className={logo.className}
        priority
      />
      <Image
        src={mark.src}
        alt={mark.alt}
        width={mark.width}
        height={mark.height}
        className={mark.className}
      />
    </Link>
  );
}
