import Image from "next/image";
import Link from "next/link";

import { HEADER_CONTENT } from "@/data/header";

export function HeaderLogo() {
  const { logo, brand } = HEADER_CONTENT;

  return (
    <div className="flex w-40 justify-start">
      <Link href="/" className="flex items-center gap-2">
        <Image
          src={logo.src}
          alt={logo.alt}
          width={logo.width}
          height={logo.height}
          className={logo.className}
        />
        {/*
        <span className={brand.className}>{brand.text}</span>
        */}
      </Link>
    </div>
  );
}
