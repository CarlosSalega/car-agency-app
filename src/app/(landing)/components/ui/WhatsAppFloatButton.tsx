"use client";

import Link from "next/link";
import { track } from "@/lib/meta-pixel";

export function WhatsAppFloatButton() {
  // wa.me wants digits only: the env var carries a leading "+", so passing it
  // through produced https://wa.me/+5493425777646 here while /ventas already
  // normalised its own copy. Same rule in both places.
  const phone = (
    process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? "+5493425777646"
  ).replace(/\D/g, "");
  const message = encodeURIComponent(
    "Hola! Vi tu página y quiero consultar por un auto 🚗",
  );

  return (
    <Link
      href={`https://wa.me/${phone}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp"
      className="group fixed right-4 bottom-4 z-50"
      onClick={() => track("Contact", { method: "whatsapp" })}
    >
      <div className="relative flex size-16 items-center justify-center rounded-full transition-all duration-300 hover:scale-110">
        <img
          src="/whatsapp-fixed.svg"
          alt=""
          aria-hidden="true"
          width={64}
          height={64}
          className="size-16"
        />

        <span
          aria-hidden="true"
          className="absolute right-full mr-3 translate-x-2 rounded-md bg-black px-3 py-1 text-xs whitespace-nowrap text-white opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
        >
          Escribinos
        </span>
      </div>
    </Link>
  );
}
